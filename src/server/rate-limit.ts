/**
 * A crude fixed-window limiter, in memory.
 *
 * Placing an order is unauthenticated by design — a guest scans a QR and orders
 * — which also means anyone can hammer it. This keeps a single client from
 * filling the pass with junk tickets.
 *
 * It is per-process: behind several instances each gets its own allowance, and
 * it resets on deploy. Move it to Redis or the edge if the restaurant ever runs
 * more than one instance.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface Limit {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, max: number, windowMs: number): Limit {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 5000) sweep(now);
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Best-effort client address. Behind a proxy this is the forwarded header. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
