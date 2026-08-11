import { sql } from "drizzle-orm";
import { CATEGORIES } from "@/data/menu";
import { db, isRemoteDb, localDataDir, resetLocalDb, schema } from "./index";
import { statements } from "./ddl";

/**
 * Applies the schema and, on an empty database, seeds it from the menu the
 * design shipped with. Runs at most once per process — every data helper awaits
 * it first, so a fresh clone or a fresh Supabase project just works.
 */

const globalForBoot = globalThis as unknown as { __levantDbReady?: Promise<void> };

export function ensureDb(): Promise<void> {
  /* A failed boot must not be cached — the next request should retry rather
     than inherit a rejected promise for the life of the process. */
  return (globalForBoot.__levantDbReady ??= boot().catch((err) => {
    globalForBoot.__levantDbReady = undefined;
    throw err;
  }));
}

async function boot(): Promise<void> {
  try {
    await applySchema();
  } catch (err) {
    if (isRemoteDb) throw err;

    /* A dev server that was killed rather than shut down leaves a half-written
       cluster, and PGlite aborts on it instead of recovering. Bin it and build
       a fresh one — the menu is reseeded from data/menu.ts anyway. */
    console.warn(
      `[db] ${localDataDir()} could not be opened — rebuilding the local database.`,
      err,
    );
    try {
      resetLocalDb();
      await applySchema();
    } catch (retryErr) {
      throw new Error(
        `The local development database at ${localDataDir()} could not be opened or rebuilt. ` +
          `Stop the dev server, delete that folder, and start it again.`,
        { cause: retryErr },
      );
    }
  }
  await seed();
}

async function applySchema(): Promise<void> {
  for (const statement of statements()) {
    await db.execute(sql.raw(statement));
  }
}

async function seed(): Promise<void> {
  const existing = await db.select({ key: schema.categories.key }).from(schema.categories).limit(1);
  if (existing.length > 0) return;

  await db.insert(schema.categories).values(
    CATEGORIES.map((c, i) => ({
      key: c.key,
      label: c.label,
      sub: c.sub,
      sortOrder: i,
      active: true,
    })),
  );

  await db.insert(schema.dishes).values(
    CATEGORIES.flatMap((c) =>
      c.items.map((d, i) => ({
        id: d.id,
        categoryKey: c.key,
        name: d.name,
        price: d.price,
        desc: d.desc,
        long: d.long,
        tag: d.tag,
        ingredients: d.ingredients,
        available: d.available,
        sortOrder: i,
      })),
    ),
  );

  // Twenty tables, matching the QR stickers printed for the room.
  await db.insert(schema.tables).values(
    Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      label: `Table ${i + 1}`,
      active: true,
    })),
  );

  await db.insert(schema.promos).values([{ code: "LEVANT10", percentOff: 10, active: true }]);
}
