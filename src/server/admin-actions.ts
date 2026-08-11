"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { checkPassword, endSession, isStaff, startSession } from "@/server/auth";
import { menuChanged } from "@/server/menu";
import { saveDishImage } from "@/server/storage";

/**
 * Staff mutations.
 *
 * These are server actions rather than route handlers on purpose: they are
 * form-driven, staff-only, and never called by anything but our own admin
 * screens. The public surface (menu, orders, promos) stays as REST so a future
 * native app has something to talk to.
 */

async function requireStaff(): Promise<void> {
  if (!(await isStaff())) redirect("/admin/login");
}

export async function signIn(_prev: string | null, form: FormData): Promise<string | null> {
  const password = String(form.get("password") ?? "");
  if (!checkPassword(password)) return "That password doesn't match.";
  await startSession();
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}

/** The 86 switch. The one action that has to be instant during service. */
export async function toggleAvailability(dishId: string, available: boolean): Promise<void> {
  await requireStaff();
  await ensureDb();
  await db
    .update(schema.dishes)
    .set({ available, updatedAt: new Date() })
    .where(eq(schema.dishes.id, dishId));
  menuChanged();
  revalidatePath("/admin");
  revalidatePath("/");
}

const dishInput = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "Use lower-case letters, numbers and dashes."),
  categoryKey: z.string().min(1),
  name: z.string().min(1).max(120),
  /** Dollars in the form, cents in the database. */
  price: z.coerce.number().min(0).max(10_000),
  desc: z.string().max(300).default(""),
  long: z.string().max(2000).default(""),
  tag: z.enum(["", "veg", "hot", "pick"]).default(""),
  ingredients: z.string().max(2000).default(""),
  available: z.coerce.boolean().default(true),
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
      return {
        id: `${dishId}-${i}`,
        label: removable ? entry : entry.slice(1).trim(),
        removable,
      };
    });
}

export async function saveDish(_prev: string | null, form: FormData): Promise<string | null> {
  await requireStaff();
  await ensureDb();

  const parsed = dishInput.safeParse({
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
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the fields and try again.";
  }
  const d = parsed.data;

  const file = form.get("image");
  let imageUrl: string | null | undefined;
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await saveDishImage(d.id, file);
    } catch (err) {
      return err instanceof Error ? err.message : "That image couldn't be saved.";
    }
  }

  const [{ maxOrder } = { maxOrder: 0 }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${schema.dishes.sortOrder}), 0)::int` })
    .from(schema.dishes)
    .where(eq(schema.dishes.categoryKey, d.categoryKey));

  const values = {
    id: d.id,
    categoryKey: d.categoryKey,
    name: d.name,
    price: Math.round(d.price * 100),
    desc: d.desc,
    long: d.long,
    tag: d.tag,
    ingredients: parseIngredients(d.ingredients, d.id),
    available: d.available,
    updatedAt: new Date(),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
  };

  await db
    .insert(schema.dishes)
    .values({ ...values, sortOrder: maxOrder + 1 })
    .onConflictDoUpdate({ target: schema.dishes.id, set: values });

  menuChanged();
  revalidatePath("/admin");
  revalidatePath("/");
  return null;
}

export async function deleteDish(dishId: string): Promise<void> {
  await requireStaff();
  await ensureDb();
  await db.delete(schema.dishes).where(eq(schema.dishes.id, dishId));
  menuChanged();
  revalidatePath("/admin");
  revalidatePath("/");
}
