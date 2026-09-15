import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

/**
 * The small set of primitives everything security-sensitive leans on. No
 * dependencies — Node's crypto has all of it.
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * The server's own secret, used to sign table QR codes.
 *
 * In development a fixed value keeps `npm run dev` zero-config. In production
 * there is **no fallback**: a secret everyone can read in the source is not a
 * secret, and signing with it would make every table code forgeable. Callers
 * treat `null` as "this feature is switched off".
 */
export function appSecret(): string | null {
  const configured = process.env.APP_SECRET;
  if (configured && configured.length >= 16) return configured;
  return isProduction ? null : "levant-sofra-development-secret";
}

/** Truncated HMAC, URL-safe. Long enough that guessing one is hopeless. */
export function sign(value: string, secret: string, length = 16): string {
  return createHmac("sha256", secret).update(value).digest("base64url").slice(0, length);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/* --- Passwords ------------------------------------------------------------ */

const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** `scrypt$<salt>$<hash>` — the salt travels with the hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let decoy: Promise<string> | null = null;

/**
 * A real hash of a random value nobody knows. When a sign-in names an email
 * that doesn't exist we still spend the time verifying against this, so the
 * response time doesn't reveal which addresses have accounts.
 */
export function decoyHash(): Promise<string> {
  return (decoy ??= hashPassword(randomToken()));
}

/* --- Uploads -------------------------------------------------------------- */

export interface SniffedImage {
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  ext: ".jpg" | ".png" | ".webp" | ".avif";
}

/**
 * Identifies an image by its first bytes.
 *
 * The browser's `file.type` and the file's name are both whatever the uploader
 * says they are. Trusting them let an `.html` file named and typed as a PNG be
 * written into `public/uploads` and served as a page from our own origin —
 * stored XSS against anyone signed in to the admin. The bytes don't lie.
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const at = (i: number) => bytes[i];
  const ascii = (start: number, text: string) =>
    [...text].every((ch, i) => bytes[start + i] === ch.charCodeAt(0));

  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  if (
    bytes.length >= 8 &&
    at(0) === 0x89 &&
    ascii(1, "PNG") &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  ) {
    return { mime: "image/png", ext: ".png" };
  }
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    return { mime: "image/webp", ext: ".webp" };
  }
  if (bytes.length >= 12 && ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) {
    return { mime: "image/avif", ext: ".avif" };
  }
  return null;
}
