import { asc, eq } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import type { Category, Dish, Ingredient, Tag } from "@/data/menu";
import { db, schema } from "@/db";
import { ensureDb } from "@/db/bootstrap";

export const MENU_TAG = "menu";

/**
 * `GET /menu`. Cached under a tag so the site stays fast, and busted the moment
 * a dish changes — a plate that has run out has to grey out in seconds, not on
 * the next deploy.
 */
export const getMenu = unstable_cache(loadMenu, ["menu"], { tags: [MENU_TAG], revalidate: 60 });

/** Call after any dish or category write. */
export function menuChanged(): void {
  revalidateTag(MENU_TAG);
}

async function loadMenu(): Promise<Category[]> {
  await ensureDb();

  const [cats, rows] = await Promise.all([
    db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.active, true))
      .orderBy(asc(schema.categories.sortOrder)),
    db
      .select()
      .from(schema.dishes)
      .orderBy(asc(schema.dishes.sortOrder), asc(schema.dishes.name)),
  ]);

  return cats.map((c) => ({
    key: c.key,
    label: c.label,
    sub: c.sub,
    items: rows.filter((d) => d.categoryKey === c.key).map((d) => toDish(d, c.label)),
  }));
}

function toDish(d: typeof schema.dishes.$inferSelect, catLabel: string): Dish {
  return {
    id: d.id,
    cat: d.categoryKey,
    catLabel,
    name: d.name,
    price: d.price,
    desc: d.desc,
    long: d.long || d.desc,
    tag: (d.tag || "") as Tag | "",
    ingredients: (d.ingredients as Ingredient[]) ?? [],
    imageUrl: d.imageUrl,
    available: d.available,
  };
}

/** Server-side pricing. Never trust a price that arrived from the browser. */
export async function serverPrices(): Promise<Record<string, number>> {
  await ensureDb();
  const rows = await db
    .select({ id: schema.dishes.id, price: schema.dishes.price, name: schema.dishes.name, available: schema.dishes.available })
    .from(schema.dishes);
  return Object.fromEntries(rows.map((r) => [r.id, r.price]));
}

export async function dishLookup(): Promise<
  Record<string, { name: string; price: number; available: boolean }>
> {
  await ensureDb();
  const rows = await db
    .select({
      id: schema.dishes.id,
      name: schema.dishes.name,
      price: schema.dishes.price,
      available: schema.dishes.available,
    })
    .from(schema.dishes);
  return Object.fromEntries(rows.map((r) => [r.id, { name: r.name, price: r.price, available: r.available }]));
}
