import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { ensureDb } from "@/db/bootstrap";

/**
 * A fixed-window limiter backed by the database.
 *
 * It used to live in process memory, which reset on every deploy and gave each
 * server instance its own separate allowance. One atomic upsert per check keeps
 * the count shared by everything that talks to the same database.
 */

export interface Limit {
  ok: boolean;
  retryAfterSeconds: number;
}

export async function rateLimit(key: string, max: number, windowMs: number): Promise<Limit> {
  await ensureDb();

  /* Opens a window if there is none or it has expired, otherwise counts one
     more hit against it. A single statement, so two requests arriving together
     can't both read a stale count. */
  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowMs / 1000}::double precision))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE
        WHEN rate_limits.reset_at <= now()
          THEN now() + make_interval(secs => ${windowMs / 1000}::double precision)
        ELSE rate_limits.reset_at
      END
    RETURNING count, extract(epoch from (reset_at - now()))::double precision AS remaining
  `);

  const [row] = rowsOf<{ count: number | string; remaining: number | string }>(result);
  const count = Number(row?.count ?? 1);
  const remaining = Math.max(0, Number(row?.remaining ?? 0));

  // Expired windows are only ever overwritten, so sweep them now and then.
  if (Math.random() < 0.01) {
    await db.execute(sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`);
  }

  return count > max
    ? { ok: false, retryAfterSeconds: Math.ceil(remaining) }
    : { ok: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client address.
 *
 * Trusts the proxy headers, which is right behind Vercel or any reverse proxy
 * that sets them — and wrong on a server exposed directly, where a client can
 * send its own. That is why sign-in is also limited per account, not only per
 * address.
 */
export function clientAddress(headers: Headers): string {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
