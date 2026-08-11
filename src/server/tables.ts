import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureDb } from "@/db/bootstrap";

/**
 * The floor.
 *
 * A table's tab collects every round ordered while those guests are seated —
 * whether the round came from a phone at the table or was rung in by staff on a
 * restaurant device. Two ways in, one bill.
 */

export interface TabLine {
  dishId: string;
  name: string;
  qty: number;
  exclusions: string[];
  note: string;
  /** Cents. */
  lineTotal: number;
}

export interface TabRound {
  orderNo: string;
  status: string;
  channel: string;
  paymentStatus: string;
  placedAt: string;
  /** Cents. */
  total: number;
  lines: TabLine[];
}

export interface TableTab {
  tableId: string;
  label: string;
  sessionId: string | null;
  openedAt: string | null;
  rounds: TabRound[];
  /** Everything consumed, in cents. */
  total: number;
  /** The part nobody has paid for yet, in cents. */
  outstanding: number;
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
  const orders = sessionIds.length
    ? await db
        .select()
        .from(schema.orders)
        .where(inArray(schema.orders.sessionId, sessionIds))
        .orderBy(asc(schema.orders.createdAt))
    : [];

  const lines = orders.length
    ? await db
        .select()
        .from(schema.orderLines)
        .where(
          inArray(
            schema.orderLines.orderId,
            orders.map((o) => o.id),
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
    const mine = session ? orders.filter((o) => o.sessionId === session.id) : [];

    const rounds: TabRound[] = mine.map((o) => ({
      orderNo: o.orderNo,
      status: o.status,
      channel: o.channel,
      paymentStatus: o.paymentStatus,
      placedAt: o.createdAt.toISOString(),
      total: o.total,
      lines: lines
        .filter((l) => l.orderId === o.id)
        .map((l) => ({
          dishId: l.dishId,
          name: l.dishName,
          qty: l.qty,
          exclusions: (l.exclusions as string[]) ?? [],
          note: l.note,
          lineTotal: l.unitPrice * l.qty,
        })),
    }));

    const rollup = new Map<string, number>();
    for (const round of rounds) {
      for (const line of round.lines) {
        rollup.set(line.name, (rollup.get(line.name) ?? 0) + line.qty);
      }
    }

    return {
      tableId: table.id,
      label: table.label,
      sessionId: session?.id ?? null,
      openedAt: session?.openedAt.toISOString() ?? null,
      rounds,
      total: rounds.reduce((a, r) => a + r.total, 0),
      outstanding: rounds
        .filter((r) => r.paymentStatus !== "paid")
        .reduce((a, r) => a + r.total, 0),
      items: [...rollup.entries()].map(([name, qty]) => ({ name, qty })),
    };
  });
}

export async function tabFor(tableId: string): Promise<TableTab | null> {
  const plan = await floorPlan();
  return plan.find((t) => t.tableId === tableId) ?? null;
}

/**
 * Closes a tab: whatever is still on it is settled, and the table is free.
 *
 * Rounds the guests already paid for on their own phones are left alone — this
 * only clears what the tab still owes.
 */
export async function settleTable(tableId: string): Promise<{ settled: number } | null> {
  await ensureDb();

  const [session] = await db
    .select()
    .from(schema.tableSessions)
    .where(and(eq(schema.tableSessions.tableId, tableId), eq(schema.tableSessions.status, "open")))
    .limit(1);
  if (!session) return null;

  const open = await db
    .select({ id: schema.orders.id, total: schema.orders.total })
    .from(schema.orders)
    .where(and(eq(schema.orders.sessionId, session.id), eq(schema.orders.paymentStatus, "on_tab")));

  if (open.length) {
    await db
      .update(schema.orders)
      .set({ paymentStatus: "paid" })
      .where(
        inArray(
          schema.orders.id,
          open.map((o) => o.id),
        ),
      );
  }

  await db
    .update(schema.tableSessions)
    .set({ status: "settled", settledAt: new Date() })
    .where(eq(schema.tableSessions.id, session.id));

  return { settled: open.reduce((a, o) => a + o.total, 0) };
}
