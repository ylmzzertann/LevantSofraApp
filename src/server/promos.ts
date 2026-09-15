import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import { ensureDb } from "@/db/bootstrap";

export interface PromoResult {
  valid: boolean;
  percentOff: number;
  message: string;
}

/**
 * `POST /promos/validate`. Checks the code is live, unexpired and still has
 * redemptions left. This is only a preview for the bag screen — the redemption
 * that counts is `claimPromo`, inside the order's transaction.
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

  /* This used to say "Try LEVANT10" — handing the discount to anyone who typed
     a wrong code. An invalid code gets no hints. */
  if (!promo) return { valid: false, percentOff: 0, message: "That code isn't live." };

  if (promo.maxRedemptions !== null && promo.redemptions >= promo.maxRedemptions) {
    return { valid: false, percentOff: 0, message: "That code has been fully redeemed." };
  }

  return {
    valid: true,
    percentOff: promo.percentOff,
    message: `${promo.code} applied — ${promo.percentOff}% off the food.`,
  };
}

/**
 * Takes one use of a code, atomically.
 *
 * The old version checked the count and incremented it in two separate steps,
 * so two orders arriving together could both pass the check and redeem the last
 * use of a capped code twice. This is a single conditional UPDATE: it only
 * succeeds if a use is still left at the moment it runs.
 */
export async function claimPromo(tx: Tx, rawCode: string): Promise<number | null> {
  const code = rawCode.trim().toUpperCase();
  const claimed = await tx
    .update(schema.promos)
    .set({ redemptions: sql`${schema.promos.redemptions} + 1` })
    .where(
      and(
        eq(schema.promos.code, code),
        eq(schema.promos.active, true),
        or(isNull(schema.promos.expiresAt), gt(schema.promos.expiresAt, new Date())),
        or(
          isNull(schema.promos.maxRedemptions),
          lt(schema.promos.redemptions, schema.promos.maxRedemptions),
        ),
      ),
    )
    .returning({ percentOff: schema.promos.percentOff });

  return claimed[0]?.percentOff ?? null;
}

/** Gives a use back when the order it was claimed for didn't go through. */
export async function releasePromo(rawCode: string): Promise<void> {
  await db
    .update(schema.promos)
    .set({ redemptions: sql`greatest(${schema.promos.redemptions} - 1, 0)` })
    .where(eq(schema.promos.code, rawCode.trim().toUpperCase()));
}
