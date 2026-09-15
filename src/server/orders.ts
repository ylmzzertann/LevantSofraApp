import { and, desc, eq, gt, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  RESTAURANT,
  asapReadyAt,
  formatClock,
  formatOrderTime,
  minuteOfDay,
} from "@/config/restaurant";
import { db, rowsOf, schema, transaction, type Tx } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import type {
  ActionResult,
  GuestOrderView,
  OrderStatus,
  OrderSummary,
  PlacedOrder,
  PlaceOrderResult,
} from "@/lib/api-types";
import type { BagLine } from "@/lib/bag";
import { computeTotals, type Totals } from "@/lib/totals";
import { dishLookup } from "./menu";
import { paymentProvider } from "./payments";
import { claimPromo, releasePromo, validatePromo } from "./promos";
import { audit, type Staff } from "./staff";
import { verifyTableKey } from "./table-keys";

export const placeOrderSchema = z.object({
  mode: z.enum(["table", "pickup"]),
  tableId: z.string().max(40).optional(),
  /** The signature printed in the table's QR. Guests need it; staff don't. */
  tableKey: z.string().max(64).optional(),
  lines: z
    .array(
      z.object({
        dishId: z.string().min(1),
        qty: z.number().int().min(1).max(50),
        exclusions: z.array(z.string().max(80)).max(20).default([]),
        note: z.string().max(280).default(""),
      }),
    )
    .min(1)
    .max(80),
  /** Pickup only. */
  customerName: z.string().max(80).optional(),
  customerPhone: z.string().max(40).optional(),
  /** ISO timestamp, or "asap". */
  pickupAt: z.string().max(40).optional(),
  promoCode: z.string().max(40).optional(),
  tip: z.number().min(0).max(1),
  split: z.number().int().min(1).max(4),
  paymentMethod: z.enum(["card", "apple", "google"]),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export interface PlaceOrderContext {
  /** The device placing it, so history can be scoped to its owner. */
  guestId?: string;
  /** Set when a signed-in member of staff rings the order in. */
  staff?: Staff;
}

class PromoGone extends Error {}

/**
 * `POST /orders`.
 *
 * Prices, discount, tax and the total are all recomputed here from the
 * restaurant's own menu. Whatever the browser thought the bill was is only ever
 * a display; this is the number that gets charged.
 *
 * The order of operations matters. The order and its lines are written in one
 * transaction first, as `awaiting_payment` — invisible to the kitchen. Only then
 * is the card charged, and only a successful charge releases the order to the
 * pass. Charging first, as this used to, meant a database failure after the
 * charge took the guest's money for an order that didn't exist.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  context: PlaceOrderContext = {},
): Promise<PlaceOrderResult> {
  await ensureDb();

  const staffMember = context.staff ?? null;
  const channel = staffMember ? "staff" : "guest";
  const pickup = input.mode === "pickup";

  if (staffMember && pickup) {
    return { ok: false, error: "Staff ring rounds in against a table.", field: "table" };
  }

  const dishes = await dishLookup();

  if (input.lines.some((l) => !dishes[l.dishId])) {
    return {
      ok: false,
      error: "Something on the menu changed. Reload and try again.",
      field: "lines",
    };
  }

  const soldOut = input.lines.filter((l) => !dishes[l.dishId].available);
  if (soldOut.length) {
    const names = [...new Set(soldOut.map((l) => dishes[l.dishId].name))].join(", ");
    return {
      ok: false,
      error: `Just sold out: ${names}. Take it off the order to continue.`,
      field: "lines",
    };
  }

  let pickupAt: Date | null = null;

  if (!pickup) {
    if (!input.tableId) {
      return { ok: false, error: "Scan the code on your table to order.", field: "table" };
    }
    const [table] = await db
      .select({ id: schema.tables.id })
      .from(schema.tables)
      .where(and(eq(schema.tables.id, input.tableId), eq(schema.tables.active, true)))
      .limit(1);
    if (!table) {
      return { ok: false, error: "That table isn't in service. Ask one of us.", field: "table" };
    }
    /* Knowing a table number isn't enough to order to it — a guest needs the
       signed code from the sticker on that table. Staff are already trusted. */
    if (!staffMember && !verifyTableKey(input.tableId, input.tableKey)) {
      return {
        ok: false,
        error: "This table's code didn't check out. Scan the QR on your table again.",
        field: "table",
      };
    }
  }

  if (pickup) {
    if (!input.customerName?.trim()) {
      return { ok: false, error: "We need a name to call out.", field: "pickup" };
    }
    const resolved = resolvePickupTime(input.pickupAt);
    if (!resolved.ok) return { ok: false, error: resolved.error, field: "pickup" };
    pickupAt = resolved.at;
  }

  // Staff rounds go on the tab at menu price — no promo, no tip, no split.
  const promoInput = staffMember ? undefined : input.promoCode?.trim().toUpperCase() || undefined;
  let percentOff = 0;
  if (promoInput) {
    const preview = await validatePromo(promoInput);
    // Stop rather than charge more than the screen showed the guest.
    if (!preview.valid) return { ok: false, error: preview.message, field: "promo" };
    percentOff = preview.percentOff;
  }

  const tipRate = staffMember ? 0 : input.tip;
  const split = staffMember ? 1 : input.split;
  const prices = Object.fromEntries(Object.entries(dishes).map(([id, d]) => [id, d.price]));
  const bag: BagLine[] = input.lines.map((l) => ({
    key: l.dishId,
    id: l.dishId,
    qty: l.qty,
    excl: l.exclusions,
    note: l.note,
  }));
  const totals = computeTotals({ prices, bag, mode: input.mode, percentOff, tip: tipRate, split });

  const id = crypto.randomUUID();
  const createdAt = new Date();
  const tableLabel = input.tableId && !pickup ? `Table ${input.tableId}` : null;

  let orderNo = "";
  let pickupCode: string | null = null;
  let lastError: unknown = null;
  let written = false;

  /* The order number, the collection code and a table's tab can all collide
     with another order written at the same instant. A collision aborts the
     transaction, so the whole thing is retried rather than lost. */
  for (let attempt = 0; attempt < 5 && !written; attempt++) {
    try {
      await transaction(async (tx) => {
        if (promoInput) {
          const claimed = await claimPromo(tx, promoInput);
          if (claimed === null || claimed !== percentOff) throw new PromoGone();
        }

        const sessionId = pickup ? null : await openSessionFor(tx, input.tableId!);
        orderNo = await nextOrderNo(tx);
        pickupCode = pickup ? await freshPickupCode(tx) : null;

        await tx.insert(schema.orders).values({
          id,
          orderNo,
          mode: input.mode,
          tableId: pickup ? null : input.tableId!,
          tableLabel,
          sessionId,
          channel,
          guestId: context.guestId ?? null,
          status: staffMember ? "placed" : "awaiting_payment",
          subtotal: totals.sub,
          discount: totals.discount,
          service: totals.service,
          tax: totals.tax,
          tip: totals.tip,
          total: totals.total,
          split,
          promoCode: promoInput ?? null,
          paymentMethod: staffMember ? "tab" : input.paymentMethod,
          paymentStatus: staffMember ? "on_tab" : "pending",
          paymentRef: null,
          customerName: pickup ? input.customerName!.trim() : null,
          customerPhone: pickup ? (input.customerPhone?.trim() || null) : null,
          pickupCode,
          pickupAt,
          createdAt,
        });

        await tx.insert(schema.orderLines).values(
          input.lines.map((l) => ({
            id: crypto.randomUUID(),
            orderId: id,
            dishId: l.dishId,
            dishName: dishes[l.dishId].name,
            unitPrice: dishes[l.dishId].price,
            qty: l.qty,
            exclusions: l.exclusions,
            note: l.note,
          })),
        );
      });
      written = true;
    } catch (err) {
      if (err instanceof PromoGone) {
        return { ok: false, error: "That code has just been used up.", field: "promo" };
      }
      lastError = err;
    }
  }

  if (!written) throw lastError ?? new Error("Could not record the order.");

  if (staffMember) {
    await audit(staffMember, "round_rung_in", orderNo, {
      table: input.tableId,
      total: totals.total,
      items: input.lines.map((l) => `${l.qty}× ${dishes[l.dishId].name}`),
    });
  } else {
    /* The whole bill is charged to the card that pays. `split` is what each
       person owes so the table can settle between themselves. */
    let charged = false;
    let paymentRef: string | null = null;
    let failure = "The payment was declined.";
    try {
      const payment = await paymentProvider().createIntent({
        amount: totals.total,
        currency: RESTAURANT.currency,
        method: input.paymentMethod,
        metadata: { orderNo, mode: input.mode, tableId: input.tableId ?? "" },
      });
      charged = payment.status === "succeeded";
      paymentRef = payment.id || null;
      if (payment.error) failure = payment.error;
    } catch (err) {
      console.error("[orders] payment provider failed", err);
    }

    if (!charged) {
      /* Nothing was taken, so nothing reaches the kitchen: cancel the record and
         give back the promo use it claimed. */
      await db
        .update(schema.orders)
        .set({ status: "cancelled", paymentStatus: "failed", paymentRef })
        .where(eq(schema.orders.id, id));
      if (promoInput) await releasePromo(promoInput);
      return { ok: false, error: failure, field: "payment" };
    }

    /* The card has been charged. Releasing the order to the pass must not be
       lost to one transient database error, or the guest pays for food nobody
       starts cooking — so it's retried, and failing that, shouted about. */
    let released = false;
    for (let attempt = 0; attempt < 4 && !released; attempt++) {
      try {
        await db
          .update(schema.orders)
          .set({ status: "placed", paymentStatus: "paid", paymentRef })
          .where(eq(schema.orders.id, id));
        released = true;
      } catch (err) {
        if (attempt === 3) {
          console.error(`[orders] ${orderNo} was CHARGED but could not be released to the kitchen`, err);
          throw err;
        }
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }
  }

  return {
    ok: true,
    order: {
      orderNo,
      date: formatOrderTime(createdAt),
      mode: input.mode,
      where: pickup ? "Pickup" : (tableLabel ?? "Table"),
      totals,
      lines: input.lines.map((l) => ({
        dishId: l.dishId,
        name: dishes[l.dishId].name,
        qty: l.qty,
        exclusions: l.exclusions,
        note: l.note,
        lineTotal: dishes[l.dishId].price * l.qty,
      })),
      ...(pickup
        ? {
            pickupCode: pickupCode ?? undefined,
            pickupLabel: pickupAt ? formatClock(pickupAt) : undefined,
            customerName: input.customerName?.trim(),
          }
        : {}),
    } satisfies PlacedOrder,
  };
}

/** "asap" resolves to the kitchen's lead time; a slot has to be real and today. */
function resolvePickupTime(
  raw: string | undefined,
): { ok: true; at: Date } | { ok: false; error: string } {
  if (!raw || raw === "asap") return { ok: true, at: asapReadyAt() };

  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Pick a collection time." };

  const earliest = asapReadyAt().getTime() - 60_000; // a minute of slack for slow taps
  if (at.getTime() < earliest) {
    return { ok: false, error: "That time has passed. Choose a later one." };
  }
  if (at.getTime() > Date.now() + 24 * 60 * 60_000) {
    return { ok: false, error: "We only take orders for today." };
  }

  const minute = minuteOfDay(at);
  if (minute < RESTAURANT.hours.open || minute > RESTAURANT.hours.close) {
    return { ok: false, error: "We're closed then. Choose a time while we're open." };
  }
  return { ok: true, at };
}

/**
 * Six digits the guest shows at the counter. Never starts with a zero — a code
 * read aloud or typed into a till shouldn't lose its leading digit — and never
 * collides with another order still waiting to be collected. A race past this
 * check hits the partial unique index and the transaction retries.
 */
async function freshPickupCode(tx: Tx): Promise<string> {
  const digits = RESTAURANT.pickup.codeDigits;
  const min = 10 ** (digits - 1);
  const span = 9 * min;

  const active = await tx
    .select({ code: schema.orders.pickupCode })
    .from(schema.orders)
    .where(
      and(
        isNotNull(schema.orders.pickupCode),
        ne(schema.orders.status, "completed"),
        ne(schema.orders.status, "cancelled"),
      ),
    );
  const taken = new Set(active.map((r) => r.code));

  for (let i = 0; i < 50; i++) {
    const code = String(min + Math.floor(Math.random() * span));
    if (!taken.has(code)) return code;
  }
  return String(min + (Date.now() % span));
}

/** `#LS-2417`, from a database sequence — never from `count(*)`. */
async function nextOrderNo(tx: Tx): Promise<string> {
  const result = await tx.execute(sql`SELECT nextval('order_no_seq')::int AS n`);
  const [row] = rowsOf<{ n: number | string }>(result);
  return `#LS-${Number(row?.n ?? 0)}`;
}

/** The open tab for a table, opening one if these guests have just sat down. */
async function openSessionFor(tx: Tx, tableId: string): Promise<string> {
  const [existing] = await tx
    .select({ id: schema.tableSessions.id })
    .from(schema.tableSessions)
    .where(and(eq(schema.tableSessions.tableId, tableId), eq(schema.tableSessions.status, "open")))
    .limit(1);
  if (existing) return existing.id;

  /* If another round opens the same tab at the same instant, the partial unique
     index rejects one insert, its transaction aborts, and the retry finds the
     tab the other one opened. */
  const id = crypto.randomUUID();
  await tx.insert(schema.tableSessions).values({ id, tableId, status: "open" });
  return id;
}

/* --- Reading orders ------------------------------------------------------- */

/** A guest never sees an order whose charge failed or hasn't gone through yet. */
const visibleToGuests = () =>
  and(ne(schema.orders.paymentStatus, "failed"), ne(schema.orders.status, "awaiting_payment"));

/**
 * `GET /orders/history` — **this device's** orders only.
 *
 * It used to return every order in the restaurant to anyone who asked, pickup
 * codes and phone numbers included.
 */
export async function orderHistory(guestId: string | null, limit = 20): Promise<OrderSummary[]> {
  await ensureDb();
  if (!guestId) return [];
  const rows = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.guestId, guestId), visibleToGuests()))
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit);
  return withLines(rows, false);
}

/**
 * One order, for the guest who placed it — so a reloaded confirmation screen
 * still shows the collection code and can follow the order through the kitchen.
 * Anyone else asking gets nothing, not even confirmation that it exists.
 */
export async function guestOrder(orderNo: string, guestId: string | null): Promise<GuestOrderView | null> {
  await ensureDb();
  if (!guestId) return null;

  const [row] = await db
    .select()
    .from(schema.orders)
    .where(
      and(eq(schema.orders.orderNo, orderNo), eq(schema.orders.guestId, guestId), visibleToGuests()),
    )
    .limit(1);
  if (!row) return null;

  const lines = await db.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, row.id));
  const totals: Totals = {
    sub: row.subtotal,
    discount: row.discount,
    service: row.service,
    tax: row.tax,
    tip: row.tip,
    preTip: row.total - row.tip,
    total: row.total,
    perPerson: row.split > 1 ? Math.round(row.total / row.split) : row.total,
  };

  return {
    orderNo: row.orderNo,
    date: formatOrderTime(row.createdAt),
    mode: row.mode as GuestOrderView["mode"],
    where: row.mode === "pickup" ? "Pickup" : (row.tableLabel ?? "Table"),
    status: row.status as OrderStatus,
    paymentStatus: row.paymentStatus,
    voided: row.voidedAt !== null,
    totals,
    lines: lines
      .map((l) => ({ l, served: l.qty - l.voidedQty }))
      .filter(({ served }) => served > 0)
      .map(({ l, served }) => ({
        dishId: l.dishId,
        name: l.dishName,
        qty: served,
        exclusions: (l.exclusions as string[]) ?? [],
        note: l.note,
        lineTotal: l.unitPrice * served,
      })),
    pickupCode: row.pickupCode ?? undefined,
    pickupLabel: row.pickupAt ? formatClock(row.pickupAt) : undefined,
    customerName: row.customerName ?? undefined,
  };
}

/** How long a voided ticket stays on the pass, so nobody keeps cooking it. */
const VOID_VISIBLE_MINUTES = 20;

/**
 * The kitchen display: everything not yet collected, plus anything voided in
 * the last few minutes — a ticket that silently vanished would still be on the
 * grill.
 *
 * Ordered by when the food is *needed*, not when it was ordered.
 */
export async function kitchenQueue(): Promise<OrderSummary[]> {
  await ensureDb();
  const since = new Date(Date.now() - VOID_VISIBLE_MINUTES * 60_000);
  const rows = await db
    .select()
    .from(schema.orders)
    .where(
      or(
        inArray(schema.orders.status, ["placed", "in_kitchen", "ready"]),
        and(eq(schema.orders.status, "cancelled"), gt(schema.orders.voidedAt, since)),
      ),
    )
    .orderBy(sql`coalesce(${schema.orders.pickupAt}, ${schema.orders.createdAt})`)
    .limit(80);
  return withLines(rows, true);
}

/* --- Changing orders ------------------------------------------------------ */

/**
 * Which way a ticket may move. Anything else is refused: a completed order must
 * not be dragged back onto the pass, and cancelling goes through `voidOrder`,
 * which demands a reason and records who did it.
 */
const TRANSITIONS: Record<string, OrderStatus[]> = {
  placed: ["in_kitchen", "ready", "completed"],
  in_kitchen: ["placed", "ready", "completed"],
  ready: ["in_kitchen", "completed"],
  completed: [],
  cancelled: [],
  awaiting_payment: [],
};

export async function setOrderStatus(
  orderNo: string,
  next: OrderStatus,
  actor: Staff,
): Promise<ActionResult> {
  await ensureDb();
  const [order] = await db
    .select({ id: schema.orders.id, status: schema.orders.status })
    .from(schema.orders)
    .where(eq(schema.orders.orderNo, orderNo))
    .limit(1);
  if (!order) return { ok: false, error: "No such order." };

  if (!(TRANSITIONS[order.status] ?? []).includes(next)) {
    return { ok: false, error: `A ${order.status.replace("_", " ")} order can't move to ${next.replace("_", " ")}.` };
  }

  // Conditional on the status we checked, so two tablets can't both advance it.
  const moved = await db
    .update(schema.orders)
    .set({ status: next })
    .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, order.status)))
    .returning({ id: schema.orders.id });
  if (moved.length === 0) return { ok: false, error: "Someone else just changed that ticket." };

  await audit(actor, "status_changed", orderNo, { from: order.status, to: next });
  return { ok: true };
}

/**
 * Takes a whole order off.
 *
 * Anyone on staff can void a round that's still on a table's tab — nothing has
 * been paid for it. Voiding an order the guest already paid for is a refund, so
 * it's for owners only, and it's flagged `refund_due` until the money is
 * actually returned through the payment provider.
 */
export async function voidOrder(orderNo: string, reason: string, actor: Staff): Promise<ActionResult> {
  await ensureDb();
  const why = reason.trim();
  if (why.length < 3) return { ok: false, error: "Give a reason — it goes on the record." };

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.orderNo, orderNo)).limit(1);
  if (!order) return { ok: false, error: "No such order." };
  if (order.status === "cancelled") return { ok: false, error: "That order is already voided." };
  if (order.status === "awaiting_payment") return { ok: false, error: "That order was never placed." };

  const paid = order.paymentStatus === "paid";
  if (paid && actor.role !== "owner") {
    return { ok: false, error: "That order is already paid — an owner has to void it and refund it." };
  }
  if (order.sessionId) {
    const [session] = await db
      .select({ status: schema.tableSessions.status })
      .from(schema.tableSessions)
      .where(eq(schema.tableSessions.id, order.sessionId))
      .limit(1);
    if (session?.status === "settled") {
      return { ok: false, error: "That table's tab is already settled." };
    }
  }

  await db
    .update(schema.orders)
    .set({
      status: "cancelled",
      voidedAt: new Date(),
      voidedBy: actor.name,
      voidReason: why,
      paymentStatus: paid ? "refund_due" : order.paymentStatus,
    })
    .where(and(eq(schema.orders.id, order.id), ne(schema.orders.status, "cancelled")));

  await audit(actor, "order_voided", orderNo, {
    total: order.total,
    reason: why,
    refundDue: paid,
  });
  return { ok: true };
}

/**
 * Takes plates off a round that's still on a tab — "they only had one of the
 * two coffees". The line keeps its row with `voided_qty` raised, so the ticket
 * shows what was struck, and the round's totals are recomputed from the prices
 * it was rung in at.
 */
export async function voidLine(
  lineId: string,
  qty: number,
  reason: string,
  actor: Staff,
): Promise<ActionResult> {
  await ensureDb();
  const why = reason.trim();
  if (why.length < 3) return { ok: false, error: "Give a reason — it goes on the record." };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: "Void at least one." };

  const [line] = await db.select().from(schema.orderLines).where(eq(schema.orderLines.id, lineId)).limit(1);
  if (!line) return { ok: false, error: "No such line." };

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, line.orderId)).limit(1);
  if (!order || order.status === "cancelled") return { ok: false, error: "That round is already voided." };
  if (order.paymentStatus !== "on_tab") {
    return {
      ok: false,
      error: "That round was paid on the guest's phone — void the whole round to refund it.",
    };
  }
  if (order.sessionId) {
    const [session] = await db
      .select({ status: schema.tableSessions.status })
      .from(schema.tableSessions)
      .where(eq(schema.tableSessions.id, order.sessionId))
      .limit(1);
    if (session?.status === "settled") return { ok: false, error: "That table's tab is already settled." };
  }

  const remaining = line.qty - line.voidedQty;
  if (qty > remaining) return { ok: false, error: `Only ${remaining} left on that line.` };

  await transaction(async (tx) => {
    await tx
      .update(schema.orderLines)
      .set({ voidedQty: line.voidedQty + qty })
      .where(and(eq(schema.orderLines.id, lineId), eq(schema.orderLines.voidedQty, line.voidedQty)));

    const lines = await tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, order.id));
    const served = lines.map((l) => ({ ...l, served: l.qty - l.voidedQty })).filter((l) => l.served > 0);

    const totals = computeTotals({
      prices: Object.fromEntries(served.map((l) => [l.id, l.unitPrice])),
      bag: served.map((l) => ({ key: l.id, id: l.id, qty: l.served, excl: [], note: "" })),
      mode: order.mode as "table" | "pickup",
      percentOff: 0,
      tip: 0,
      split: 1,
    });

    await tx
      .update(schema.orders)
      .set({
        subtotal: totals.sub,
        discount: totals.discount,
        service: totals.service,
        tax: totals.tax,
        tip: totals.tip,
        total: totals.total,
        // Nothing left on the round means the round itself is gone.
        ...(served.length === 0
          ? { status: "cancelled", voidedAt: new Date(), voidedBy: actor.name, voidReason: why }
          : {}),
      })
      .where(eq(schema.orders.id, order.id));
  });

  await audit(actor, "line_voided", order.orderNo, {
    dish: line.dishName,
    qty,
    reason: why,
    unitPrice: line.unitPrice,
  });
  return { ok: true };
}

/* --- Shaping -------------------------------------------------------------- */

async function withLines(
  rows: (typeof schema.orders.$inferSelect)[],
  forStaff: boolean,
): Promise<OrderSummary[]> {
  if (rows.length === 0) return [];
  const lines = await db
    .select()
    .from(schema.orderLines)
    .where(
      inArray(
        schema.orderLines.orderId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((r) => ({
    orderNo: r.orderNo,
    date: formatOrderTime(r.createdAt),
    mode: r.mode as OrderSummary["mode"],
    where: r.mode === "pickup" ? "Pickup" : (r.tableLabel ?? "Table"),
    status: r.status as OrderStatus,
    paymentStatus: r.paymentStatus,
    total: r.total,
    voided: r.voidedAt !== null,
    voidReason: forStaff ? (r.voidReason ?? undefined) : undefined,
    pickupCode: r.pickupCode ?? undefined,
    pickupLabel: r.pickupAt ? formatClock(r.pickupAt) : undefined,
    customerName: r.customerName ?? undefined,
    customerPhone: forStaff ? (r.customerPhone ?? undefined) : undefined,
    lines: lines
      .filter((l) => l.orderId === r.id)
      .filter((l) => forStaff || l.qty - l.voidedQty > 0)
      .map((l) => ({
        ...(forStaff ? { lineId: l.id } : {}),
        dishId: l.dishId,
        name: l.dishName,
        qty: l.qty - l.voidedQty,
        voidedQty: l.voidedQty,
        exclusions: (l.exclusions as string[]) ?? [],
        note: l.note,
      })),
  }));
}

/** Guest-safe order numbers travel in URLs without the `#`. */
export function orderNoFromRef(ref: string): string | null {
  const clean = decodeURIComponent(ref).replace(/^#/, "").toUpperCase();
  return /^LS-\d{1,9}$/.test(clean) ? `#${clean}` : null;
}
