import { and, count, desc, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { clientAddress, rateLimit } from "./rate-limit";
import {
  decoyHash,
  hashPassword,
  randomToken,
  safeEqual,
  sha256,
  verifyPassword,
} from "./security";

/**
 * Back-of-house accounts.
 *
 * This replaces a single shared password. That had three problems: it was the
 * same for everyone, so nothing could be attributed to a person; it defaulted to
 * `levant` in production if nobody set it; and a stolen cookie stayed valid for
 * twelve hours because sessions couldn't be revoked. Now each person signs in
 * as themselves, sessions live in the database, and switching an account off
 * ends its sessions on the spot.
 */

export type Role = "owner" | "staff";

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const COOKIE = "ls_staff";
const SESSION_HOURS = 12;
const MIN_PASSWORD = 8;
const isProduction = process.env.NODE_ENV === "production";

export { DEV_OWNER } from "@/db/bootstrap";

/* --- Who is signed in ----------------------------------------------------- */

export async function currentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  await ensureDb();

  const [row] = await db
    .select({
      id: schema.staff.id,
      email: schema.staff.email,
      name: schema.staff.name,
      role: schema.staff.role,
    })
    .from(schema.staffSessions)
    .innerJoin(schema.staff, eq(schema.staff.id, schema.staffSessions.staffId))
    .where(
      and(
        eq(schema.staffSessions.tokenHash, sha256(token)),
        gt(schema.staffSessions.expiresAt, new Date()),
        eq(schema.staff.active, true),
      ),
    )
    .limit(1);

  return row ? { ...row, role: row.role as Role } : null;
}

/** For pages and server actions: sends anyone not allowed back to sign in. */
export async function requireStaff(role?: Role): Promise<Staff> {
  const me = await currentStaff();
  if (!me) redirect("/admin/login");
  if (role === "owner" && me.role !== "owner") redirect("/admin/tables?denied=1");
  return me;
}

/* --- Signing in and out --------------------------------------------------- */

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signIn(emailRaw: string, password: string): Promise<SignInResult> {
  await ensureDb();
  const email = emailRaw.trim().toLowerCase();
  const address = clientAddress(await headers());

  /* Limited per address and per account. The address alone can be spoofed on a
     server that trusts proxy headers it shouldn't; the account limit still
     stops anyone grinding through one person's password. */
  const [byAddress, byAccount] = await Promise.all([
    rateLimit(`signin:ip:${address}`, 20, 15 * 60_000),
    rateLimit(`signin:email:${email}`, 6, 15 * 60_000),
  ]);
  if (!byAddress.ok || !byAccount.ok) {
    const wait = Math.ceil(Math.max(byAddress.retryAfterSeconds, byAccount.retryAfterSeconds) / 60);
    return { ok: false, error: `Too many attempts. Try again in ${wait} min.` };
  }

  const [account] = await db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.email, email))
    .limit(1);

  // Verify even when there is no such account, so timing doesn't tell.
  const valid = await verifyPassword(password, account?.passwordHash ?? (await decoyHash()));
  if (!account || !valid || !account.active) {
    return { ok: false, error: "That email and password don't match an active account." };
  }

  const token = randomToken();
  await db.insert(schema.staffSessions).values({
    tokenHash: sha256(token),
    staffId: account.id,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000),
  });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });

  await audit(toStaff(account), "signed_in");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const me = await currentStaff();
    await db.delete(schema.staffSessions).where(eq(schema.staffSessions.tokenHash, sha256(token)));
    if (me) await audit(me, "signed_out");
  }
  store.delete(COOKIE);
}

/* --- Accounts ------------------------------------------------------------- */

export async function staffCount(): Promise<number> {
  await ensureDb();
  const [row] = await db.select({ n: count() }).from(schema.staff);
  return Number(row?.n ?? 0);
}

export interface StaffListing extends Staff {
  active: boolean;
  createdAt: string;
}

export async function listStaff(): Promise<StaffListing[]> {
  await ensureDb();
  const rows = await db.select().from(schema.staff).orderBy(schema.staff.createdAt);
  return rows.map((r) => ({
    ...toStaff(r),
    active: r.active,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type AccountResult = { ok: true } | { ok: false; error: string };

export async function createStaff(
  input: { email: string; name: string; role: Role; password: string },
  actor: Staff | null,
): Promise<AccountResult> {
  await ensureDb();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (!name) return { ok: false, error: "Enter a name." };
  if (input.password.length < MIN_PASSWORD) {
    return { ok: false, error: `Passwords need at least ${MIN_PASSWORD} characters.` };
  }

  const [existing] = await db
    .select({ id: schema.staff.id })
    .from(schema.staff)
    .where(eq(schema.staff.email, email))
    .limit(1);
  if (existing) return { ok: false, error: "There's already an account with that email." };

  const id = crypto.randomUUID();
  await db.insert(schema.staff).values({
    id,
    email,
    name,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    active: true,
  });

  await audit(actor, "staff_created", email, { name, role: input.role });
  return { ok: true };
}

export async function setStaffActive(
  staffId: string,
  active: boolean,
  actor: Staff,
): Promise<AccountResult> {
  await ensureDb();
  const [target] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId)).limit(1);
  if (!target) return { ok: false, error: "No such account." };

  if (!active) {
    if (target.id === actor.id) return { ok: false, error: "You can't switch off your own account." };
    // Never lock the restaurant out of its own back office.
    if (target.role === "owner") {
      const [owners] = await db
        .select({ n: count() })
        .from(schema.staff)
        .where(and(eq(schema.staff.role, "owner"), eq(schema.staff.active, true)));
      if (Number(owners?.n ?? 0) <= 1) {
        return { ok: false, error: "That's the last active owner — add another owner first." };
      }
    }
  }

  await db.update(schema.staff).set({ active }).where(eq(schema.staff.id, staffId));
  // Switching someone off signs them out everywhere, immediately.
  if (!active) await db.delete(schema.staffSessions).where(eq(schema.staffSessions.staffId, staffId));

  await audit(actor, active ? "staff_enabled" : "staff_disabled", target.email);
  return { ok: true };
}

export async function resetStaffPassword(
  staffId: string,
  password: string,
  actor: Staff,
): Promise<AccountResult> {
  await ensureDb();
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Passwords need at least ${MIN_PASSWORD} characters.` };
  }
  const [target] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId)).limit(1);
  if (!target) return { ok: false, error: "No such account." };

  await db
    .update(schema.staff)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(schema.staff.id, staffId));
  // A reset means the old password may be known — end every session it opened.
  await db.delete(schema.staffSessions).where(eq(schema.staffSessions.staffId, staffId));

  await audit(actor, "password_reset", target.email);
  return { ok: true };
}

/* --- First-run setup ------------------------------------------------------ */

/**
 * In production nobody is created automatically. The first owner is made on
 * `/admin/setup`, which only works while there are no accounts at all — and,
 * in production, only with the SETUP_TOKEN from the server's environment, so a
 * stranger who finds a fresh deployment first can't make themselves the owner.
 */
export function setupNeedsToken(): boolean {
  return isProduction;
}

export async function completeSetup(input: {
  email: string;
  name: string;
  password: string;
  token: string;
}): Promise<AccountResult> {
  if ((await staffCount()) > 0) return { ok: false, error: "This restaurant is already set up." };

  if (setupNeedsToken()) {
    const expected = process.env.SETUP_TOKEN;
    if (!expected || expected.length < 16) {
      return { ok: false, error: "Set SETUP_TOKEN (16+ characters) on the server first." };
    }
    if (!safeEqual(input.token, expected)) return { ok: false, error: "That setup token is wrong." };
  }

  return createStaff({ ...input, role: "owner" }, null);
}

/* --- The activity log ----------------------------------------------------- */

export async function audit(
  actor: Staff | null,
  action: string,
  subject?: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(schema.auditLog).values({
    id: crypto.randomUUID(),
    staffId: actor?.id ?? null,
    staffName: actor?.name ?? null,
    action,
    subject: subject ?? null,
    detail,
  });
}

export interface ActivityEntry {
  at: string;
  who: string;
  action: string;
  subject: string | null;
  detail: Record<string, unknown>;
}

export async function recentActivity(limit = 60): Promise<ActivityEntry[]> {
  await ensureDb();
  const rows = await db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    at: r.createdAt.toISOString(),
    who: r.staffName ?? "System",
    action: r.action,
    subject: r.subject,
    detail: (r.detail as Record<string, unknown>) ?? {},
  }));
}

function toStaff(row: typeof schema.staff.$inferSelect): Staff {
  return { id: row.id, email: row.email, name: row.name, role: row.role as Role };
}
