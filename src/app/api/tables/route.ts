import { NextResponse } from "next/server";
import { z } from "zod";
import { placeOrder, voidLine, voidOrder } from "@/server/orders";
import { currentStaff } from "@/server/staff";
import { floorPlan, giveBack, markRefunded, settleTable, takePayment } from "@/server/tables";

export const dynamic = "force-dynamic";

/** `GET /tables` — the floor: who's seated, what they've had, what they owe. */
export async function GET() {
  if (!(await currentStaff())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  return NextResponse.json(
    { tables: await floorPlan() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const tableId = z.string().min(1).max(40);
const method = z.enum(["cash", "card", "other"]);

const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("order"),
    tableId,
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
  }),
  z.object({
    action: z.literal("pay"),
    tableId,
    /** Cents. */
    amount: z.number().int().positive().max(10_000_000),
    method,
    note: z.string().max(200).default(""),
  }),
  z.object({ action: z.literal("settle"), tableId, method }),
  z.object({ action: z.literal("giveBack"), tableId, method }),
  z.object({
    action: z.literal("voidLine"),
    lineId: z.string().min(1).max(64),
    qty: z.number().int().min(1).max(50),
    reason: z.string().max(200),
  }),
  z.object({ action: z.literal("voidRound"), orderNo: z.string().min(1).max(40), reason: z.string().max(200) }),
  z.object({ action: z.literal("refunded"), orderNo: z.string().min(1).max(40) }),
]);

/** Everything staff do to a table: ring in, take money, take things off, close. */
export async function POST(request: Request) {
  const me = await currentStaff();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "That request didn't look right." }, { status: 400 });
  }

  try {
    const body = parsed.data;
    switch (body.action) {
      case "order": {
        /* A round rung in by staff goes on the tab: no card, no tip, no split —
           the table settles the whole thing when they leave. */
        const result = await placeOrder(
          { mode: "table", tableId: body.tableId, lines: body.lines, tip: 0, split: 1, paymentMethod: "card" },
          { staff: me },
        );
        return NextResponse.json(result, { status: result.ok ? 201 : 409 });
      }
      case "pay": {
        const result = await takePayment(body.tableId, body.amount, body.method, body.note, me);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "settle": {
        const result = await settleTable(body.tableId, body.method, me);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "giveBack": {
        const result = await giveBack(body.tableId, body.method, me);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "voidLine": {
        const result = await voidLine(body.lineId, body.qty, body.reason, me);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "voidRound": {
        const result = await voidOrder(body.orderNo, body.reason, me);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "refunded": {
        const result = await markRefunded(body.orderNo, me);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
    }
  } catch (err) {
    console.error("[api/tables] failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: "That didn't go through.",
        detail: process.env.NODE_ENV === "production" ? undefined : String(err),
      },
      { status: 500 },
    );
  }
}
