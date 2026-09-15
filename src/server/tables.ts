import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema, transaction } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import type { ActionResult } from "@/lib/api-types";
import { money } from "@/lib/money";
import { audit, type Staff } from "./staff";

/**
 * The floor.
 *
 * A table's tab collects every round ordered while those guests are seated —
 * whether it came from a phone at the table or was rung in by staff. Money comes
 * off it two ways: a guest paying for their own round on their phone, or staff
 * taking a payment against the tab (cash, the card terminal), in as many parts
 * as the table wants.
 */

export type PaymentMethod = "cash" | "card" | "other";

export interface TabLine {
  lineId: string;
  dishId: string;
  name: string;
  qty: number;
  voidedQty: number;
  exclusions: string[];
  note: string;
  /** Cents, for what was actually served. */
  lineTotal: number;
}

export interface TabRound {
  orderNo: string;
  status: string;
  channel: string;
  paymentStatus: string;
  voided: boolean;
  voidReason: string | null;
  voidedBy: string | null;
  placedAt: string;
  /** Cents. Zero-weighted in the tab's totals when voided. */
  total: number;
  lines: TabLine[];
}

export interface TabPayment {
  amount: number;
  method: string;
  note: string;
  at: string;
}

export interface TableTab {
  tableId: string;
  label: string;
  sessionId: string | null;
  openedAt: string | null;
  rounds: TabRound[];
  payments: TabPayment[];
  /** Everything served on this tab, voids excluded, in cents. */
  total: number;
  /** Paid for on guests' own phones. */
  paidByGuests: number;
  /** Taken by staff against the tab. */
  paidAtTable: number;
  /** What the table still owes. */
  outstanding: number;
  /**
   * Money taken at the table beyond what it now owes — a round was voided after
   * it had been paid for in cash or at the terminal. That money belongs to the
   * guests, and the tab can't close until it's handed back.
   */
  overpaid: number;
  /** Rounds paid on a phone and then voided — money to give back. */
  refundsDue: number;
  /** Rolled up across the whole tab, so the floor can read it at a glance. */
  items: { name: string; qty: number }[];
}

export async function floorPlan(): Promise<TableTab[]> {
  await ensureDb();

  const tables = await db
    .select()
    .from(schema.tables)
    .where(eq(schema.tables.active, true))
    .orderBy(asc(schema.tables.id));

  const sessions = await db
    .select()
    .from(schema.tableSessions)
    .where(eq(schema.tableSessions.status, "open"));

  const sessionIds = sessions.map((s) => s.id);

  const [orders, payments] = sessionIds.length
    ? await Promise.all([
        db
          .select()
          .from(schema.orders)
          .where(inArray(schema.orders.sessionId, sessionIds))
          .orderBy(asc(schema.orders.createdAt)),
        db
          .select()
          .from(schema.payments)
          .where(inArray(schema.payments.sessionId, sessionIds))
          .orderBy(asc(schema.payments.createdAt)),
      ])
    : [[], []];

  // A charge that failed or never happened is not on anyone's tab.
  const visible = orders.filter((o) => o.status !== "awaiting_payment" && o.paymentStatus !== "failed");

  const lines = visible.length
    ? await db
        .select()
        .from(schema.orderLines)
        .where(
          inArray(
            schema.orderLines.orderId,
            visible.map((o) => o.id),
          ),
        )
    : [];

  /* Numeric where the labels are numeric, so Table 10 doesn't sort before 2. */
  const sorted = tables.slice().sort((a, b) => {
    const an = Number(a.id);
    const bn = Number(b.id);
    return Number.isFinite(an) && Number.isFinite(bn) ? an - bn : a.id.localeCompare(b.id);
  });

  return sorted.map((table) => {
    const session = sessions.find((s) => s.tableId === table.id) ?? null;
    const mine = session ? visible.filter((o) => o.sessionId === session.id) : [];
    const takenHere = session ? payments.filter((p) => p.sessionId === session.id) : [];

    const rounds: TabRound[] = mine.map((o) => ({
      orderNo: o.orderNo,
      status: o.status,
      channel: o.channel,
      paymentStatus: o.paymentStatus,
      voided: o.status === "cancelled",
      voidReason: o.voidReason,
      voidedBy: o.voidedBy,
      placedAt: o.createdAt.toISOString(),
      total: o.total,
      lines: lines
        .filter((l) => l.orderId === o.id)
        .map((l) => ({
          lineId: l.id,
          dishId: l.dishId,
          name: l.dishName,
          qty: l.qty - l.voidedQty,
          voidedQty: l.voidedQty,
          exclusions: (l.exclusions as string[]) ?? [],
          note: l.note,
          lineTotal: l.unitPrice * (l.qty - l.voidedQty),
        })),
    }));

    const live = rounds.filter((r) => !r.voided);
    const total = live.reduce((a, r) => a + r.total, 0);
    const paidByGuests = live.filter((r) => r.paymentStatus === "paid").reduce((a, r) => a + r.total, 0);
    const owedOnTab = live.filter((r) => r.paymentStatus === "on_tab").reduce((a, r) => a + r.total, 0);
    const paidAtTable = takenHere.reduce((a, p) => a + p.amount, 0);
    const refundsDue = rounds
      .filter((r) => r.paymentStatus === "refund_due")
      .reduce((a, r) => a + r.total, 0);

    const rollup = new Map<string, number>();
    for (const round of live) {
      for (const line of round.lines) {
        if (line.qty > 0) rollup.set(line.name, (rollup.get(line.name) ?? 0) + line.qty);
      }
    }

    return {
      tableId: table.id,
      label: table.label,
      sessionId: session?.id ?? null,
      openedAt: session?.openedAt.toISOString() ?? null,
      rounds,
      payments: takenHere.map((p) => ({
        amount: p.amount,
        method: p.method,
        note: p.note,
        at: p.createdAt.toISOString(),
      })),
      total,
      paidByGuests,
      paidAtTable,
      outstanding: Math.max(0, owedOnTab - paidAtTable),
      overpaid: Math.max(0, paidAtTable - owedOnTab),
      refundsDue,
      items: [...rollup.entries()].map(([name, qty]) => ({ name, qty })),
    };
  });
}

async function openSession(tableId: string) {
  const [session] = await db
    .select()
    .from(schema.tableSessions)
    .where(and(eq(schema.tableSessions.tableId, tableId), eq(schema.tableSessions.status, "open")))
    .limit(1);
  return session ?? null;
}

async function balanceFor(sessionId: string): Promise<{ owed: number; overpaid: number }> {
  const [owed] = await db
    .select({ n: sql<number>`coalesce(sum(${schema.orders.total}), 0)::int` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.sessionId, sessionId),
        eq(schema.orders.paymentStatus, "on_tab"),
        sql`${schema.orders.status} <> 'cancelled'`,
      ),
    );
  const [paid] = await db
    .select({ n: sql<number>`coalesce(sum(${schema.payments.amount}), 0)::int` })
    .from(schema.payments)
    .where(eq(schema.payments.sessionId, sessionId));
  const balance = Number(owed?.n ?? 0) - Number(paid?.n ?? 0);
  return { owed: Math.max(0, balance), overpaid: Math.max(0, -balance) };
}

/**
 * Takes part of what a table owes — one guest paying cash for their share, the
 * rest by card later. Refuses more than is owed: a slip that pays more than the
 * bill is a mistake to catch, not a balance to carry.
 */
export async function takePayment(
  tableId: string,
  amount: number,
  method: PaymentMethod,
  note: string,
  actor: Staff,
): Promise<ActionResult> {
  await ensureDb();
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Enter an amount above zero." };

  const session = await openSession(tableId);
  if (!session) return { ok: false, error: "That table has no open tab." };

  const { owed } = await balanceFor(session.id);
  if (owed === 0) return { ok: false, error: "Nothing is owed on that tab." };
  if (amount > owed) return { ok: false, error: `That's more than the ${money(owed)} still owed.` };

  await db.insert(schema.payments).values({
    id: crypto.randomUUID(),
    sessionId: session.id,
    amount,
    method,
    staffId: actor.id,
    note: note.trim().slice(0, 200),
  });

  await audit(actor, "payment_taken", `Table ${tableId}`, { amount, method, owedBefore: owed });
  return { ok: true };
}

/**
 * Closes a tab. Whatever is still owed is recorded as one final payment by the
 * method given, the rounds on the tab are marked paid, and the table is free —
 * the next order there starts a fresh tab.
 *
 * Refuses while a paid-then-voided round is still waiting on its refund, so a
 * table can't leave with money owed back to it unnoticed.
 */
export async function settleTable(
  tableId: string,
  method: PaymentMethod,
  actor: Staff,
): Promise<{ ok: true; settled: number } | { ok: false; error: string }> {
  await ensureDb();

  const session = await openSession(tableId);
  if (!session) return { ok: false, error: "That table has no open tab." };

  const [refunds] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.sessionId, session.id), eq(schema.orders.paymentStatus, "refund_due")));
  if (Number(refunds?.n ?? 0) > 0) {
    return {
      ok: false,
      error: "A round on this tab is waiting on a refund. Refund it, then mark it refunded, before settling.",
    };
  }

  const { owed, overpaid } = await balanceFor(session.id);
  /* Closing now would bury money that belongs to the guests: they paid for a
     round that has since been voided. It has to be handed back and recorded
     first, or the till is over by that much and nobody knows why. */
  if (overpaid > 0) {
    return {
      ok: false,
      error: `This table has paid ${money(overpaid)} more than it owes. Give it back and record it before settling.`,
    };
  }

  await transaction(async (tx) => {
    if (owed > 0) {
      await tx.insert(schema.payments).values({
        id: crypto.randomUUID(),
        sessionId: session.id,
        amount: owed,
        method,
        staffId: actor.id,
        note: "Settled",
      });
    }
    await tx
      .update(schema.orders)
      .set({ paymentStatus: "paid" })
      .where(and(eq(schema.orders.sessionId, session.id), eq(schema.orders.paymentStatus, "on_tab")));
    await tx
      .update(schema.tableSessions)
      .set({ status: "settled", settledAt: new Date() })
      .where(and(eq(schema.tableSessions.id, session.id), eq(schema.tableSessions.status, "open")));
  });

  await audit(actor, "table_settled", `Table ${tableId}`, { finalPayment: owed, method });
  return { ok: true, settled: owed };
}

/**
 * Records money handed back to a table that overpaid — cash returned, or a
 * terminal refund. Stored as a negative payment so the tab still adds up.
 */
export async function giveBack(
  tableId: string,
  method: PaymentMethod,
  actor: Staff,
): Promise<ActionResult> {
  await ensureDb();
  const session = await openSession(tableId);
  if (!session) return { ok: false, error: "That table has no open tab." };

  const { overpaid } = await balanceFor(session.id);
  if (overpaid === 0) return { ok: false, error: "Nothing is owed back to that table." };

  await db.insert(schema.payments).values({
    id: crypto.randomUUID(),
    sessionId: session.id,
    amount: -overpaid,
    method,
    staffId: actor.id,
    note: "Given back",
  });

  await audit(actor, "change_given", `Table ${tableId}`, { amount: overpaid, method });
  return { ok: true };
}

/**
 * Marks a voided, already-paid round as refunded. The refund itself happens in
 * the payment provider; this records that it did, and is owners only.
 */
export async function markRefunded(orderNo: string, actor: Staff): Promise<ActionResult> {
  await ensureDb();
  if (actor.role !== "owner") return { ok: false, error: "Only an owner can record a refund." };

  const updated = await db
    .update(schema.orders)
    .set({ paymentStatus: "refunded" })
    .where(and(eq(schema.orders.orderNo, orderNo), eq(schema.orders.paymentStatus, "refund_due")))
    .returning({ total: schema.orders.total });
  if (updated.length === 0) return { ok: false, error: "That order isn't waiting on a refund." };

  await audit(actor, "refund_recorded", orderNo, { amount: updated[0].total });
  return { ok: true };
}

/* --- Tables themselves ---------------------------------------------------- */

export interface TableRow {
  id: string;
  label: string;
  active: boolean;
}

export async function listTables(): Promise<TableRow[]> {
  await ensureDb();
  const rows = await db.select().from(schema.tables);
  return rows.sort((a, b) => {
    const an = Number(a.id);
    const bn = Number(b.id);
    return Number.isFinite(an) && Number.isFinite(bn) ? an - bn : a.id.localeCompare(b.id);
  });
}

export async function addTable(rawId: string, actor: Staff): Promise<ActionResult> {
  await ensureDb();
  const id = rawId.trim();
  if (!/^[A-Za-z0-9-]{1,12}$/.test(id)) {
    return { ok: false, error: "Use up to 12 letters, numbers or dashes — 21, T3, Bar-1." };
  }
  const [existing] = await db.select().from(schema.tables).where(eq(schema.tables.id, id)).limit(1);
  if (existing) {
    if (existing.active) return { ok: false, error: "That table already exists." };
    await db.update(schema.tables).set({ active: true }).where(eq(schema.tables.id, id));
  } else {
    await db.insert(schema.tables).values({ id, label: `Table ${id}`, active: true });
  }
  await audit(actor, "table_added", `Table ${id}`);
  return { ok: true };
}

export async function retireTable(id: string, actor: Staff): Promise<ActionResult> {
  await ensureDb();
  if (await openSession(id)) return { ok: false, error: "Settle that table's tab first." };
  await db.update(schema.tables).set({ active: false }).where(eq(schema.tables.id, id));
  await audit(actor, "table_retired", `Table ${id}`);
  return { ok: true };
}
