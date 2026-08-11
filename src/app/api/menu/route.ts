import { NextResponse } from "next/server";
import { getMenu } from "@/server/menu";

export const dynamic = "force-dynamic";

/** `GET /menu` — the live menu, including which dishes have run out. */
export async function GET() {
  const categories = await getMenu();
  return NextResponse.json(
    { categories },
    { headers: { "Cache-Control": "no-store" } },
  );
}
