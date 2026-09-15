import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePromo } from "@/server/promos";
import { clientAddress, rateLimit } from "@/server/rate-limit";

const body = z.object({ code: z.string().max(40) });

/**
 * `POST /promos/validate` → `{ valid, percentOff, message }`.
 *
 * Limited, because without a limit it's an oracle: a script could try every
 * short code and harvest the ones that work.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(`promo:${clientAddress(request.headers)}`, 15, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { valid: false, percentOff: 0, message: "Too many tries — give it a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, percentOff: 0, message: "Enter a code first." },
      { status: 400 },
    );
  }
  return NextResponse.json(await validatePromo(parsed.data.code));
}
