import { NextResponse } from "next/server";
import { ensureGuestId, readGuestId } from "@/server/guest";
import { orderHistory, placeOrder, placeOrderSchema } from "@/server/orders";
import { clientAddress, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/** Placing an order is unauthenticated by design, so it needs a ceiling. */
const MAX_ORDERS = 12;
const WINDOW_MS = 5 * 60_000;

/** `POST /orders`. Totals are recomputed server-side; the body carries no prices. */
export async function POST(request: Request) {
  try {
    const limit = await rateLimit(`orders:${clientAddress(request.headers)}`, MAX_ORDERS, WINDOW_MS);
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: "That's a lot of orders at once. Give it a minute." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const parsed = placeOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "That order didn't look right. Reload and try again." },
        { status: 400 },
      );
    }

    /* The middleware hands out the id on first page view; this covers a client
       that reached the API without loading a page. Nothing in the body can make
       this a staff order — that comes only from a staff session. */
    const guestId = await ensureGuestId();
    const result = await placeOrder(parsed.data, { guestId });
    return NextResponse.json(result, { status: result.ok ? 201 : 409 });
  } catch (err) {
    console.error("[api/orders] place failed", err);
    return NextResponse.json(
      {
        ok: false,
        // Don't promise "nothing was charged" — a failure can land after the charge.
        error: "Something went wrong with that order. Check Past orders before trying again.",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : `${err} :: ${(err as { cause?: unknown })?.cause ?? ""}`,
      },
      { status: 500 },
    );
  }
}

/** `GET /orders/history` — this device's orders, and nobody else's. */
export async function GET() {
  try {
    const guestId = await readGuestId();
    return NextResponse.json(
      { orders: await orderHistory(guestId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/orders] history failed", err);
    return NextResponse.json({ orders: [], error: "Couldn't load order history." }, { status: 500 });
  }
}
