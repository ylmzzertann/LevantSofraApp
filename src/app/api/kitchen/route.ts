import { NextResponse } from "next/server";
import { z } from "zod";
import { isStaff } from "@/server/auth";
import { kitchenQueue, setOrderStatus } from "@/server/orders";

export const dynamic = "force-dynamic";

/**
 * The kitchen display polls this. Polling rather than a socket on purpose: it
 * survives serverless, reconnects for free, and a ticket board that refreshes
 * every few seconds is well inside what a pass needs. Swap to Supabase Realtime
 * if the room ever wants it instant.
 */
export async function GET() {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  return NextResponse.json(
    { orders: await kitchenQueue() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const patch = z.object({
  orderNo: z.string().min(1).max(40),
  status: z.enum(["placed", "in_kitchen", "ready", "completed", "cancelled"]),
});

export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }
  await setOrderStatus(parsed.data.orderNo, parsed.data.status);
  return NextResponse.json({ ok: true });
}
