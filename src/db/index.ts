import { mkdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One schema, two drivers.
 *
 * With `DATABASE_URL` set — Supabase, or any Postgres — we connect over the
 * wire. Without it we run an embedded Postgres, so the app works on a fresh
 * clone with no account, no Docker and no connection string. The SQL is
 * identical either way; moving to Supabase is one line in `.env.local`.
 *
 * Server-side only. Nothing here may be imported from a client component.
 */

type PgliteDb = ReturnType<typeof drizzlePglite<typeof schema>>;

export type Db =
  | ReturnType<typeof drizzlePg<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

export const isRemoteDb = !!process.env.DATABASE_URL;

/**
 * Where the throwaway development database lives.
 *
 * Deliberately outside the project directory. A Postgres cluster is ~1000 files
 * that change on every write, and this project sits in a OneDrive folder — a
 * sync client trying to upload a live cluster corrupts it. Override with
 * LOCAL_DB_DIR.
 */
export function localDataDir(): string {
  if (process.env.LOCAL_DB_DIR) return process.env.LOCAL_DB_DIR;
  const base =
    process.platform === "win32"
      ? (process.env.LOCALAPPDATA ?? tmpdir())
      : (process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"));
  return join(base, "levant-sofra", "pg");
}

/* Next re-evaluates modules on every edit in development; without a global the
   embedded database would be opened once per reload and fight over its lock. */
const globalForDb = globalThis as unknown as { __levantDb?: Db };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Supabase's pooler doesn't support prepared statements.
    return drizzlePg(postgres(url, { prepare: false, max: 5 }), { schema });
  }
  const dir = localDataDir();
  mkdirSync(dir, { recursive: true }); // PGlite's own mkdir isn't recursive.
  return drizzlePglite(new PGlite(dir), { schema });
}

function getDb(): Db {
  return (globalForDb.__levantDb ??= createDb());
}

/**
 * Throws away the local cluster and forgets the connection, so the next use
 * builds a fresh one.
 *
 * Only ever called after the database has actually failed to open — a killed
 * dev server leaves a half-written cluster that PGlite aborts on rather than
 * recovers. This is a scratch database reseeded from `data/menu.ts`, so binning
 * it is safe. Refuses to touch a real database.
 */
export function resetLocalDb(): void {
  if (isRemoteDb) throw new Error("resetLocalDb() must never run against DATABASE_URL");
  rmSync(localDataDir(), { recursive: true, force: true });
  globalForDb.__levantDb = undefined;
}

/**
 * Opened on first use, not on import.
 *
 * `next build` walks the module graph in several worker processes at once. If
 * this file opened PGlite at import time, every worker would open the same
 * single-writer cluster simultaneously and they would trip over each other.
 * Nothing touches the database until a request actually asks for data.
 *
 * Typed as one driver's database: both expose the same query API, but a union
 * of their types makes TypeScript pick the narrowest overload of builders like
 * `.returning({...})`. The runtime object is whichever driver is configured.
 */
export const db: PgliteDb = new Proxy({} as PgliteDb, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** A transaction handle — the same query API as `db`, all-or-nothing. */
export type Tx = Parameters<Parameters<PgliteDb["transaction"]>[0]>[0];

/**
 * Runs `fn` in a transaction. Both drivers expose the same transaction API; the
 * cast only unifies their two nominal types so callers get one `Tx`.
 */
export function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (getDb() as PgliteDb).transaction(fn);
}

/** Raw `db.execute` results: postgres-js hands back an array, PGlite `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] })?.rows ?? []) as T[];
}

export { schema };
