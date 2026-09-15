import { NextResponse } from "next/server";
import { z } from "zod";
import { kitchenQueue, setOrderStatus, voidOrder } from "@/server/orders";
import { currentStaff } from "@/server/staff";
import { markRefunded } from "@/server/tables";

export const dynamic = "force-dynamic";

/**
 * The kitchen display polls this. Polling rather than a socket on purpose: it
 * survives serverless, reconnects for free, and a ticket board that refreshes
 * every few seconds is well inside what a pass needs.
 */
export async function GET() {
  if (!(await currentStaff())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  return NextResponse.json(
    { orders: await kitchenQueue() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    orderNo: z.string().min(1).max(40),
    status: z.enum(["placed", "in_kitchen", "ready", "completed"]),
  }),
  z.object({
    action: z.literal("void"),
    orderNo: z.string().min(1).max(40),
    reason: z.string().max(200),
  }),
  z.object({ action: z.literal("refunded"), orderNo: z.string().min(1).max(40) }),
]);

export async function POST(request: Request) {
  const me = await currentStaff();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const body = parsed.data;
  const result =
    body.action === "status"
      ? await setOrderStatus(body.orderNo, body.status, me)
      : body.action === "void"
        ? await voidOrder(body.orderNo, body.reason, me)
        : await markRefunded(body.orderNo, me);

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
