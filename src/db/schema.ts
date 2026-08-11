/**
 * The database. Postgres dialect, so the same schema runs on the embedded
 * local database during development and on Supabase in production.
 *
 * Money is stored in **cents as integers**. Floating point dollars drift, and
 * a bill that is a cent off is a bill the restaurant argues about.
 */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  sub: text("sub").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const dishes = pgTable(
  "dishes",
  {
    id: text("id").primaryKey(),
    categoryKey: text("category_key")
      .notNull()
      .references(() => categories.key, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Cents. */
    price: integer("price").notNull(),
    desc: text("desc").notNull(),
    long: text("long").notNull().default(""),
    tag: text("tag").notNull().default(""),
    /** `[{ id, label, removable }]` */
    ingredients: jsonb("ingredients").notNull().default([]),
    imageUrl: text("image_url"),
    /** The 86 switch. Staff flip this from the admin panel mid-service. */
    available: boolean("available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("dishes_category_sort").on(t.categoryKey, t.sortOrder, t.id)],
);

export const tables = pgTable("tables", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
});

export const promos = pgTable("promos", {
  code: text("code").primaryKey(),
  /** 10 = 10% off food. */
  percentOff: integer("percent_off").notNull(),
  active: boolean("active").notNull().default(true),
  /** null = unlimited. */
  maxRedemptions: integer("max_redemptions"),
  redemptions: integer("redemptions").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

/** A table's open tab — every round ordered while those guests are seated. */
export const tableSessions = pgTable("table_sessions", {
  id: text("id").primaryKey(),
  tableId: text("table_id").notNull(),
  /** open | settled */
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  /** The human-facing number, `#LS-2417`. From a sequence, never a count. */
  orderNo: text("order_no").notNull().unique(),
  mode: text("mode").notNull(),
  tableId: text("table_id"),
  tableLabel: text("table_label"),
  /** The tab this round belongs to, for table orders. */
  sessionId: text("session_id"),
  /** guest = ordered from a phone, staff = rung in on a restaurant device. */
  channel: text("channel").notNull().default("guest"),
  /** Which device placed it, so a guest only ever sees their own history. */
  guestId: text("guest_id"),
  /** placed | in_kitchen | ready | completed | cancelled */
  status: text("status").notNull().default("placed"),

  /* Every money field in cents, computed server-side at order time. */
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  service: integer("service").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  tip: integer("tip").notNull().default(0),
  total: integer("total").notNull(),
  split: integer("split").notNull().default(1),

  promoCode: text("promo_code"),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentRef: text("payment_ref"),

  /* Pickup orders only. */
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  /** The six digits the guest shows at the counter to collect. */
  pickupCode: text("pickup_code"),
  pickupAt: timestamp("pickup_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLines = pgTable("order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  dishId: text("dish_id").notNull(),
  /** Denormalised: the ticket must survive a later rename or reprice. */
  dishName: text("dish_name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  qty: integer("qty").notNull(),
  /** The point of the whole feature — these reach the pass. */
  exclusions: jsonb("exclusions").notNull().default([]),
  note: text("note").notNull().default(""),
});

export const favourites = pgTable(
  "favourites",
  {
    guestId: text("guest_id").notNull(),
    dishId: text("dish_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guestId, t.dishId] })],
);

export type DishRow = typeof dishes.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderLineRow = typeof orderLines.$inferSelect;
