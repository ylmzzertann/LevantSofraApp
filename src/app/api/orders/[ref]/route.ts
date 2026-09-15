import { NextResponse } from "next/server";
import { readGuestId } from "@/server/guest";
import { guestOrder, orderNoFromRef } from "@/server/orders";

export const dynamic = "force-dynamic";

/**
 * `GET /orders/LS-2417` — one order, for the device that placed it.
 *
 * This is what keeps a pickup code alive past a reload, and lets the guest see
 * their order move through the kitchen. Asked by anyone else it answers 404,
 * exactly as if the order didn't exist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const orderNo = orderNoFromRef(ref);
  if (!orderNo) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const order = await guestOrder(orderNo, await readGuestId());
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ order }, { headers: { "Cache-Control": "no-store" } });
}
