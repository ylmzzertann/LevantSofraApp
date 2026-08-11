import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureDb } from "@/db/bootstrap";

export interface PromoResult {
  valid: boolean;
  percentOff: number;
  message: string;
}

/**
 * `POST /promos/validate`. Checks the code is live, unexpired and still has
 * redemptions left — the prototype just string-compared `LEVANT10`.
 */
export async function validatePromo(rawCode: string): Promise<PromoResult> {
  await ensureDb();
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, percentOff: 0, message: "Enter a code first." };

  const [promo] = await db
    .select()
    .from(schema.promos)
    .where(
      and(
        eq(schema.promos.code, code),
        eq(schema.promos.active, true),
        or(isNull(schema.promos.expiresAt), gt(schema.promos.expiresAt, new Date())),
      ),
    )
    .limit(1);

  if (!promo) {
    return { valid: false, percentOff: 0, message: `That code isn't live. Try LEVANT10.` };
  }
  if (promo.maxRedemptions !== null && promo.redemptions >= promo.maxRedemptions) {
    return { valid: false, percentOff: 0, message: "That code has been fully redeemed." };
  }

  return {
    valid: true,
    percentOff: promo.percentOff,
    message: `${promo.code} applied — ${promo.percentOff}% off the food.`,
  };
}

/** Called once the order is actually placed, not when the code is typed. */
export async function redeemPromo(code: string): Promise<void> {
  await db
    .update(schema.promos)
    .set({ redemptions: sql`${schema.promos.redemptions} + 1` })
    .where(eq(schema.promos.code, code.trim().toUpperCase()));
}
