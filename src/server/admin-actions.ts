"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema, transaction } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { money } from "@/lib/money";
import { menuChanged } from "@/server/menu";
import {
  audit,
  completeSetup,
  createStaff,
  requireStaff,
  resetStaffPassword,
  setStaffActive,
  signIn,
  signOut,
  staffCount,
} from "@/server/staff";
import { saveDishImage } from "@/server/storage";
import { addTable, retireTable } from "@/server/tables";

/**
 * Staff mutations.
 *
 * Server actions rather than route handlers: they are form-driven, staff-only,
 * and called by nothing but our own admin screens. Every one of them checks the
 * session itself — a server action is a public endpoint, so hiding a button is
 * never the protection.
 *
 * Roles: anyone on staff can run service (86 a dish, the floor, the pass).
 * Changing the menu, the tables and the accounts is for owners.
 */

function refreshMenu(): void {
  menuChanged();
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

/* --- Sessions ------------------------------------------------------------- */

export async function signInAction(_prev: string | null, form: FormData): Promise<string | null> {
  const result = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!result.ok) return result.error;
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/admin/login");
}

export async function setupAction(_prev: string | null, form: FormData): Promise<string | null> {
  if ((await staffCount()) > 0) redirect("/admin/login");
  const result = await completeSetup({
    email: String(form.get("email") ?? ""),
    name: String(form.get("name") ?? ""),
    password: String(form.get("password") ?? ""),
    token: String(form.get("token") ?? ""),
  });
  if (!result.ok) return result.error;
  redirect("/admin/login?created=1");
}

/* --- Service -------------------------------------------------------------- */

/** The 86 switch. The one action that has to be instant during service. */
export async function toggleAvailability(dishId: string, available: boolean): Promise<void> {
  const me = await requireStaff();
  await ensureDb();
  const updated = await db
    .update(schema.dishes)
    .set({ available, updatedAt: new Date() })
    .where(eq(schema.dishes.id, dishId))
    .returning({ name: schema.dishes.name });
  if (updated.length) {
    await audit(me, available ? "dish_back_on" : "dish_86d", updated[0].name);
  }
  refreshMenu();
}

/* --- Dishes --------------------------------------------------------------- */

const dishInput = z.object({
  mode: z.enum(["create", "edit"]),
  id: z
    .string()
    .min(1, "Give the dish an id.")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Ids use lower-case letters, numbers and dashes."),
  categoryKey: z.string().min(1),
  name: z.string().trim().min(1, "Give the dish a name.").max(120),
  /** Dollars in the form, cents in the database. */
  price: z.coerce.number().min(0).max(10_000),
  desc: z.string().max(300).default(""),
  long: z.string().max(2000).default(""),
  tag: z.enum(["", "veg", "hot", "pick"]).default(""),
  ingredients: z.string().max(2000).default(""),
  available: z.boolean().default(true),
});

/**
 * `*` in front of an ingredient means the kitchen cannot leave it out — the
 * same convention the seed file uses, so staff only learn one rule.
 */
function parseIngredients(raw: string, dishId: string) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, i) => {
      const removable = !entry.startsWith("*");
      return { id: `${dishId}-${i}`, label: removable ? entry : entry.slice(1).trim(), removable };
    })
    .filter((g) => g.label.length > 0);
}

export async function saveDish(_prev: string | null, form: FormData): Promise<string | null> {
  const me = await requireStaff("owner");
  await ensureDb();

  const parsed = dishInput.safeParse({
    mode: form.get("mode"),
    id: form.get("id"),
    categoryKey: form.get("categoryKey"),
    name: form.get("name"),
    price: form.get("price"),
    desc: form.get("desc") ?? "",
    long: form.get("long") ?? "",
    tag: form.get("tag") ?? "",
    ingredients: form.get("ingredients") ?? "",
    available: form.get("available") === "on",
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check the fields and try again.";
  const d = parsed.data;

  const [category] = await db
    .select({ key: schema.categories.key })
    .from(schema.categories)
    .where(eq(schema.categories.key, d.categoryKey))
    .limit(1);
  if (!category) return "That category doesn't exist any more — reload the page.";

  const [existing] = await db.select().from(schema.dishes).where(eq(schema.dishes.id, d.id)).limit(1);

  /* "Add a dish" used to be an upsert: typing an id that was already taken
     silently overwrote that dish — name, price, photo and all. Creating and
     editing are now separate, and creating refuses a taken id. */
  if (d.mode === "create" && existing) {
    return `The id "${d.id}" is already used by ${existing.name}. Pick another.`;
  }
  if (d.mode === "edit" && !existing) {
    return "That dish has been deleted — reload the page.";
  }

  let imageUrl: string | undefined;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await saveDishImage(d.id, file);
    } catch (err) {
      return err instanceof Error ? err.message : "That image couldn't be saved.";
    }
  }

  const price = Math.round(d.price * 100);
  const values = {
    categoryKey: d.categoryKey,
    name: d.name,
    price,
    desc: d.desc,
    long: d.long,
    tag: d.tag,
    ingredients: parseIngredients(d.ingredients, d.id),
    available: d.available,
    updatedAt: new Date(),
    ...(imageUrl ? { imageUrl } : {}),
  };

  const endOf = async (categoryKey: string) => {
    const [row] = await db
      .select({ n: sql<number>`coalesce(max(${schema.dishes.sortOrder}), -1)::int` })
      .from(schema.dishes)
      .where(eq(schema.dishes.categoryKey, categoryKey));
    return Number(row?.n ?? -1) + 1;
  };

  if (d.mode === "create") {
    await db.insert(schema.dishes).values({ id: d.id, ...values, sortOrder: await endOf(d.categoryKey) });
    await audit(me, "dish_created", d.name, { price, category: d.categoryKey });
  } else {
    const moved = existing!.categoryKey !== d.categoryKey;
    await db
      .update(schema.dishes)
      .set({ ...values, ...(moved ? { sortOrder: await endOf(d.categoryKey) } : {}) })
      .where(eq(schema.dishes.id, d.id));

    const changes: Record<string, unknown> = {};
    if (existing!.price !== price) changes.price = `${money(existing!.price)} → ${money(price)}`;
    if (existing!.name !== d.name) changes.name = `${existing!.name} → ${d.name}`;
    if (moved) changes.category = `${existing!.categoryKey} → ${d.categoryKey}`;
    if (existing!.available !== d.available) changes.available = d.available;
    await audit(me, "dish_edited", d.name, changes);
  }

  refreshMenu();
  return null;
}

export async function deleteDish(dishId: string): Promise<void> {
  const me = await requireStaff("owner");
  await ensureDb();
  const removed = await db
    .delete(schema.dishes)
    .where(eq(schema.dishes.id, dishId))
    .returning({ name: schema.dishes.name });
  if (removed.length) await audit(me, "dish_deleted", removed[0].name);
  refreshMenu();
}

/**
 * Nudges a dish one place up or down within its section. The whole section is
 * renumbered in one transaction rather than swapping two values, so dishes that
 * happen to share a sort order can't get stuck.
 */
export async function moveDish(dishId: string, direction: "up" | "down"): Promise<void> {
  await requireStaff("owner");
  await ensureDb();
  const [dish] = await db.select().from(schema.dishes).where(eq(schema.dishes.id, dishId)).limit(1);
  if (!dish) return;

  const siblings = await db
    .select({ id: schema.dishes.id })
    .from(schema.dishes)
    .where(eq(schema.dishes.categoryKey, dish.categoryKey))
    .orderBy(asc(schema.dishes.sortOrder), asc(schema.dishes.name));

  const ids = reorder(
    siblings.map((s) => s.id),
    dishId,
    direction,
  );
  if (!ids) return;

  await transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(schema.dishes).set({ sortOrder: i }).where(eq(schema.dishes.id, id));
    }
  });
  refreshMenu();
}

/* --- Categories ----------------------------------------------------------- */

const categoryInput = z.object({
  mode: z.enum(["create", "edit"]),
  key: z.string().max(40).optional(),
  label: z.string().trim().min(1, "Give the section a name.").max(60),
  sub: z.string().trim().max(60).default(""),
});

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export async function saveCategory(_prev: string | null, form: FormData): Promise<string | null> {
  const me = await requireStaff("owner");
  await ensureDb();

  const parsed = categoryInput.safeParse({
    mode: form.get("mode"),
    key: form.get("key") ?? undefined,
    label: form.get("label"),
    sub: form.get("sub") ?? "",
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check the fields and try again.";
  const c = parsed.data;

  if (c.mode === "edit") {
    if (!c.key) return "Missing section.";
    const updated = await db
      .update(schema.categories)
      .set({ label: c.label, sub: c.sub })
      .where(eq(schema.categories.key, c.key))
      .returning({ key: schema.categories.key });
    if (!updated.length) return "That section has been removed — reload the page.";
    await audit(me, "category_edited", c.label);
  } else {
    const base = slug(c.label) || "section";
    const taken = new Set(
      (await db.select({ key: schema.categories.key }).from(schema.categories)).map((r) => r.key),
    );
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;

    const [row] = await db
      .select({ n: sql<number>`coalesce(max(${schema.categories.sortOrder}), -1)::int` })
      .from(schema.categories);
    await db.insert(schema.categories).values({
      key,
      label: c.label,
      sub: c.sub,
      sortOrder: Number(row?.n ?? -1) + 1,
      active: true,
    });
    await audit(me, "category_created", c.label);
  }

  refreshMenu();
  return null;
}

/** Hides or shows a whole section. Hidden dishes can't be ordered either. */
export async function setCategoryActive(key: string, active: boolean): Promise<void> {
  const me = await requireStaff("owner");
  await ensureDb();
  const updated = await db
    .update(schema.categories)
    .set({ active })
    .where(eq(schema.categories.key, key))
    .returning({ label: schema.categories.label });
  if (updated.length) await audit(me, active ? "category_shown" : "category_hidden", updated[0].label);
  refreshMenu();
}

export async function moveCategory(key: string, direction: "up" | "down"): Promise<void> {
  await requireStaff("owner");
  await ensureDb();
  const rows = await db
    .select({ key: schema.categories.key })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.label));

  const keys = reorder(
    rows.map((r) => r.key),
    key,
    direction,
  );
  if (!keys) return;

  await transaction(async (tx) => {
    for (const [i, k] of keys.entries()) {
      await tx.update(schema.categories).set({ sortOrder: i }).where(eq(schema.categories.key, k));
    }
  });
  refreshMenu();
}

/**
 * Deleting a section deletes its dishes with it (the foreign key cascades), so
 * it's refused while the section still has any. Hide it instead, or move the
 * dishes out first.
 */
export async function deleteCategory(key: string): Promise<string | null> {
  const me = await requireStaff("owner");
  await ensureDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.dishes)
    .where(eq(schema.dishes.categoryKey, key));
  if (Number(row?.n ?? 0) > 0) return "Move or delete its dishes first — or just hide the section.";

  const removed = await db
    .delete(schema.categories)
    .where(and(eq(schema.categories.key, key)))
    .returning({ label: schema.categories.label });
  if (removed.length) await audit(me, "category_deleted", removed[0].label);
  refreshMenu();
  return null;
}

/** Moves `id` one step in `list`. Returns null when it's already at that end. */
function reorder(list: string[], id: string, direction: "up" | "down"): string[] | null {
  const from = list.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= list.length) return null;
  const next = list.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/* --- Accounts ------------------------------------------------------------- */

export async function createStaffAction(_prev: string | null, form: FormData): Promise<string | null> {
  const me = await requireStaff("owner");
  const role = form.get("role") === "owner" ? "owner" : "staff";
  const result = await createStaff(
    {
      email: String(form.get("email") ?? ""),
      name: String(form.get("name") ?? ""),
      password: String(form.get("password") ?? ""),
      role,
    },
    me,
  );
  if (!result.ok) return result.error;
  revalidatePath("/admin/staff");
  return null;
}

export async function setStaffActiveAction(staffId: string, active: boolean): Promise<string | null> {
  const me = await requireStaff("owner");
  const result = await setStaffActive(staffId, active, me);
  revalidatePath("/admin/staff");
  return result.ok ? null : result.error;
}

export async function resetPasswordAction(_prev: string | null, form: FormData): Promise<string | null> {
  const me = await requireStaff("owner");
  const result = await resetStaffPassword(
    String(form.get("staffId") ?? ""),
    String(form.get("password") ?? ""),
    me,
  );
  if (!result.ok) return result.error;
  revalidatePath("/admin/staff");
  return null;
}

/* --- Tables --------------------------------------------------------------- */

export async function addTableAction(_prev: string | null, form: FormData): Promise<string | null> {
  const me = await requireStaff("owner");
  const result = await addTable(String(form.get("tableId") ?? ""), me);
  if (!result.ok) return result.error;
  revalidatePath("/admin/qr");
  return null;
}

export async function retireTableAction(tableId: string): Promise<string | null> {
  const me = await requireStaff("owner");
  const result = await retireTable(tableId, me);
  revalidatePath("/admin/qr");
  return result.ok ? null : result.error;
}
