import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

/**
 * An anonymous identifier for one device.
 *
 * It exists for exactly one reason: order history has to be *yours*. Before
 * this, `GET /api/orders` returned every order in the restaurant — names, phone
 * numbers, and the six-digit collection codes, which is enough to walk up to
 * the counter and take somebody else's dinner.
 *
 * It is not a login. It identifies a browser, nothing more, and it should be
 * replaced by a real account the day accounts exist.
 */

const COOKIE = "ls_guest";
const MAX_AGE = 60 * 60 * 24 * 180;

export async function readGuestId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Reads the id, minting and storing one if this device hasn't got one yet. */
export async function ensureGuestId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return id;
}
