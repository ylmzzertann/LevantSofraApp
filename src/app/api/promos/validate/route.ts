import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePromo } from "@/server/promos";

const body = z.object({ code: z.string().max(40) });

/** `POST /promos/validate` → `{ valid, percentOff, message }`. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, percentOff: 0, message: "Enter a code first." },
      { status: 400 },
    );
  }
  return NextResponse.json(await validatePromo(parsed.data.code));
}
