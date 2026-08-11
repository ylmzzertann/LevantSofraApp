import { NextResponse } from "next/server";
import { z } from "zod";
import { isStaff } from "@/server/auth";
import { placeOrder } from "@/server/orders";
import { floorPlan, settleTable } from "@/server/tables";

export const dynamic = "force-dynamic";

/** `GET /tables` — the floor: who's seated, what they've had, what they owe. */
export async function GET() {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  return NextResponse.json(
    { tables: await floorPlan() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settle"), tableId: z.string().min(1).max(40) }),
  z.object({
    action: z.literal("order"),
    tableId: z.string().min(1).max(40),
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
]);

/** Staff actions on a table: ring in a round, or close the tab. */
export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "settle") {
      const result = await settleTable(parsed.data.tableId);
      if (!result) return NextResponse.json({ error: "No open tab there." }, { status: 409 });
      return NextResponse.json({ ok: true, settled: result.settled });
    }

    /* A round rung in by staff goes on the tab: no card, no tip, no split — the
       table settles the whole thing when they leave. */
    const result = await placeOrder(
      {
        mode: "table",
        tableId: parsed.data.tableId,
        lines: parsed.data.lines,
        tip: 0,
        split: 1,
        paymentMethod: "card",
      },
      { channel: "staff" },
    );
    return NextResponse.json(result, { status: result.ok ? 201 : 409 });
  } catch (err) {
    console.error("[api/tables] failed", err);
    return NextResponse.json(
      {
        error: "That didn't go through.",
        detail: process.env.NODE_ENV === "production" ? undefined : String(err),
      },
      { status: 500 },
    );
  }
}
