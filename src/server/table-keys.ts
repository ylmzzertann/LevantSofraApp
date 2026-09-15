import { appSecret, safeEqual, sign } from "./security";

/**
 * Signed table codes.
 *
 * A table's QR used to point at `/t/12`, so anyone could type `/t/13` — or any
 * number — and send orders to a table they weren't sitting at. The sticker now
 * carries a signature only the server can produce: `/t/12?k=…`. Knowing the
 * table number isn't enough; you need the code that is physically on it.
 *
 * Rotating APP_SECRET invalidates every printed sticker, which is also how you
 * retire a batch that has been photographed and passed around.
 */

export function tableKey(tableId: string): string | null {
  const secret = appSecret();
  return secret ? sign(`table:${tableId}`, secret) : null;
}

export function verifyTableKey(tableId: string, key: string | null | undefined): boolean {
  if (!key) return false;
  const expected = tableKey(tableId);
  return expected !== null && safeEqual(key, expected);
}

/** The address printed into the QR. */
export function tableUrl(baseUrl: string, tableId: string): string | null {
  const key = tableKey(tableId);
  if (!key) return null;
  return `${baseUrl.replace(/\/$/, "")}/t/${encodeURIComponent(tableId)}?k=${key}`;
}
