import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Staff sign-in for the admin and kitchen screens.
 *
 * A shared password and a signed, http-only cookie. That is enough for a
 * back-of-house tablet behind HTTPS, and it deliberately has no dependency —
 * but it has no per-person identity and no audit trail. Before launch, move
 * this to Supabase Auth with one account per staff member so "who 86'd the
 * levrek at 9pm" has an answer.
 */

const COOKIE = "ls_staff";
const MAX_AGE = 60 * 60 * 12; // a shift

function secret(): string {
  return process.env.ADMIN_SECRET ?? process.env.ADMIN_PASSWORD ?? "levant-dev-secret";
}

function password(): string {
  return process.env.ADMIN_PASSWORD ?? "levant";
}

/** True when the default development password is still in force. */
export const usingDefaultPassword = !process.env.ADMIN_PASSWORD;

function sign(expiry: number): string {
  const mac = createHmac("sha256", secret()).update(String(expiry)).digest("hex");
  return `${expiry}.${mac}`;
}

function verify(token: string | undefined): boolean {
  if (!token) return false;
  const [expiryRaw, mac] = token.split(".");
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry < Date.now() || !mac) return false;
  const expected = createHmac("sha256", secret()).update(expiryRaw).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(candidate: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(password());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function startSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sign(Date.now() + MAX_AGE * 1000), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isStaff(): Promise<boolean> {
  const store = await cookies();
  return verify(store.get(COOKIE)?.value);
}
