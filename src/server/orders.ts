import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  RESTAURANT,
  asapReadyAt,
  formatClock,
  formatOrderTime,
  minuteOfDay,
} from "@/config/restaurant";
import { db, schema } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import type { OrderSummary, PlacedOrder, PlaceOrderResult } from "@/lib/api-types";
import type { BagLine } from "@/lib/bag";
import { computeTotals } from "@/lib/totals";
import { dishLookup } from "./menu";
import { paymentProvider } from "./payments";
import { redeemPromo, validatePromo } from "./promos";

export const placeOrderSchema = z.object({
  mode: z.enum(["table", "pickup"]),
  tableId: z.string().max(40).optional(),
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
  /** Staff orders are rung in on a restaurant device and go on the tab unpaid. */
  channel?: "guest" | "staff";
}

/**
 * `POST /orders`.
 *
 * Prices, discount, tax and the total are all recomputed here from the
 * restaurant's own menu. Whatever the browser thought the bill was is only ever
 * a display; this is the number that gets charged.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  context: PlaceOrderContext = {},
): Promise<PlaceOrderResult> {
  await ensureDb();

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
    const names = soldOut.map((l) => dishes[l.dishId].name).join(", ");
    return {
      ok: false,
      error: `Just sold out: ${names}. Take it off the order to continue.`,
      field: "lines",
    };
  }

  const pickup = input.mode === "pickup";
  const channel = context.channel ?? "guest";
  let pickupAt: Date | null = null;

  if (!pickup) {
    /* A table has to be one the restaurant actually has. Otherwise a guest can
       type any number into the URL and send food to a table that isn't there. */
    if (!input.tableId) {
      return { ok: false, error: "Scan the code on your table to order.", field: "lines" };
    }
    const [table] = await db
      .select({ id: schema.tables.id })
      .from(schema.tables)
      .where(and(eq(schema.tables.id, input.tableId), eq(schema.tables.active, true)))
      .limit(1);
    if (!table) {
      return { ok: false, error: "That table isn't in service. Ask one of us.", field: "lines" };
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

  let percentOff = 0;
  let promoCode: string | undefined;
  if (input.promoCode) {
    const promo = await validatePromo(input.promoCode);
    // An expired code silently costs the guest the discount they were shown, so
    // stop rather than charge them more than the screen said.
    if (!promo.valid) return { ok: false, error: promo.message, field: "promo" };
    percentOff = promo.percentOff;
    promoCode = input.promoCode.trim().toUpperCase();
  }

  const prices = Object.fromEntries(Object.entries(dishes).map(([id, d]) => [id, d.price]));
  const bag: BagLine[] = input.lines.map((l) => ({
    key: l.dishId,
    id: l.dishId,
    qty: l.qty,
    excl: l.exclusions,
    note: l.note,
  }));

  const totals = computeTotals({
    prices,
    bag,
    mode: input.mode,
    percentOff,
    tip: input.tip,
    split: input.split,
  });

  /* Staff ring an order in on a restaurant device and it goes on the table's
     tab, settled when the guests leave. A guest paying on their own phone is
     charged there and then. */
  const onTab = channel === "staff";

  let paymentStatus = "on_tab";
  let paymentRef: string | null = null;

  if (!onTab) {
    /* The whole bill is charged to the card that pays. `split` is what each
       person owes so the table can settle between themselves — charging only
       one share here would have handed the restaurant a quarter of the money. */
    const payment = await paymentProvider().createIntent({
      amount: totals.total,
      currency: RESTAURANT.currency,
      method: input.paymentMethod,
      metadata: { mode: input.mode, tableId: input.tableId ?? "" },
    });
    if (payment.status === "failed") {
      return { ok: false, error: payment.error ?? "The payment was declined.", field: "payment" };
    }
    paymentStatus = payment.status === "succeeded" ? "paid" : "pending";
    paymentRef = payment.id || null;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date();
  const tableLabel = input.tableId ? `Table ${input.tableId}` : null;
  const sessionId = input.mode === "table" ? await openSessionFor(input.tableId!) : null;

  /* The order number and the collection code both have to be unique, and both
     are decided at the last possible moment. Under load two orders can still
     land on the same code, so the insert is retried rather than lost. */
  let orderNo = "";
  let pickupCode: string | null = null;
  let inserted = false;
  let lastError: unknown;

  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    orderNo = await nextOrderNo();
    pickupCode = pickup ? await freshPickupCode() : null;
    try {
      await db.insert(schema.orders).values({
        id,
        orderNo,
        mode: input.mode,
        tableId: input.tableId ?? null,
        tableLabel,
        sessionId,
        channel,
        guestId: context.guestId ?? null,
        status: "placed",
        subtotal: totals.sub,
        discount: totals.discount,
        service: totals.service,
        tax: totals.tax,
        tip: totals.tip,
        total: totals.total,
        split: input.split,
        promoCode: promoCode ?? null,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        paymentRef,
        customerName: pickup ? (input.customerName?.trim() ?? null) : null,
        customerPhone: pickup ? (input.customerPhone?.trim() ?? null) : null,
        pickupCode,
        pickupAt,
        createdAt,
      });
      inserted = true;
    } catch (err) {
      lastError = err;
    }
  }

  if (!inserted) throw lastError ?? new Error("Could not record the order.");

  await db.insert(schema.orderLines).values(
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

  if (promoCode) await redeemPromo(promoCode);

  const order: PlacedOrder = {
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
  };

  return { ok: true, order };
}

/** "asap" resolves to the kitchen's lead time; a slot has to be real and today. */
function resolvePickupTime(raw: string | undefined): { ok: true; at: Date } | { ok: false; error: string } {
  if (!raw || raw === "asap") return { ok: true, at: asapReadyAt() };

  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) {
    return { ok: false, error: "Pick a collection time." };
  }

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
 * collides with another order still waiting to be collected.
 */
async function freshPickupCode(): Promise<string> {
  const digits = RESTAURANT.pickup.codeDigits;
  const min = 10 ** (digits - 1);
  const span = 9 * min;

  const active = await db
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
  // 50 misses means the room is impossibly busy; fall back to something unique.
  return String(min + (Date.now() % span));
}

/**
 * `#LS-2417`, from a database sequence.
 *
 * This used to be `count(*) + 2401`. Two guests tapping Pay in the same second
 * were handed the same number and one of the orders died on the unique index —
 * six concurrent orders reliably lost four of them.
 */
async function nextOrderNo(): Promise<string> {
  const rows = (await db.execute(sql`SELECT nextval('order_no_seq')::int AS n`)) as unknown;
  const n = readNextval(rows);
  return `#LS-${n}`;
}

/** postgres-js hands back an array, PGlite an object with `rows`. */
function readNextval(result: unknown): number {
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] })?.rows ?? []);
  const first = rows[0] as { n?: number | string } | undefined;
  return Number(first?.n ?? 0);
}

/** The open tab for a table, opening one if these guests have just sat down. */
async function openSessionFor(tableId: string): Promise<string> {
  const [existing] = await db
    .select({ id: schema.tableSessions.id })
    .from(schema.tableSessions)
    .where(and(eq(schema.tableSessions.tableId, tableId), eq(schema.tableSessions.status, "open")))
    .limit(1);
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  try {
    await db.insert(schema.tableSessions).values({ id, tableId, status: "open" });
    return id;
  } catch {
    /* Two rounds ordered at once both tried to open the tab; the partial unique
       index kept one. Use whichever won. */
    const [won] = await db
      .select({ id: schema.tableSessions.id })
      .from(schema.tableSessions)
      .where(
        and(eq(schema.tableSessions.tableId, tableId), eq(schema.tableSessions.status, "open")),
      )
      .limit(1);
    if (won) return won.id;
    throw new Error(`Could not open a tab for table ${tableId}`);
  }
}

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
    .where(eq(schema.orders.guestId, guestId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit);
  return withLines(rows);
}

/**
 * The kitchen display: everything not yet collected.
 *
 * Ordered by when the food is *needed*, not when it was ordered — an order
 * placed at noon for 8pm collection must not sit at the top of the pass all
 * afternoon.
 */
export async function kitchenQueue(): Promise<OrderSummary[]> {
  await ensureDb();
  const rows = await db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.status, ["placed", "in_kitchen", "ready"]))
    .orderBy(sql`coalesce(${schema.orders.pickupAt}, ${schema.orders.createdAt})`)
    .limit(60);
  return withLines(rows);
}

/** Staff look an order up by the six digits the guest is holding. */
export async function findByPickupCode(code: string): Promise<OrderSummary | null> {
  await ensureDb();
  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.pickupCode, code.trim()))
    .orderBy(desc(schema.orders.createdAt))
    .limit(1);
  const [found] = await withLines(rows);
  return found ?? null;
}

export async function setOrderStatus(orderNo: string, status: string): Promise<void> {
  await ensureDb();
  await db.update(schema.orders).set({ status }).where(eq(schema.orders.orderNo, orderNo));
}

async function withLines(rows: (typeof schema.orders.$inferSelect)[]): Promise<OrderSummary[]> {
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
    status: r.status,
    total: r.total,
    pickupCode: r.pickupCode ?? undefined,
    pickupLabel: r.pickupAt ? formatClock(r.pickupAt) : undefined,
    customerName: r.customerName ?? undefined,
    customerPhone: r.customerPhone ?? undefined,
    lines: lines
      .filter((l) => l.orderId === r.id)
      .map((l) => ({
        dishId: l.dishId,
        name: l.dishName,
        qty: l.qty,
        exclusions: (l.exclusions as string[]) ?? [],
        note: l.note,
      })),
  }));
}
