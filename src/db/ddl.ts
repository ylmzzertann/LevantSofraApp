/**
 * The schema as SQL — the single source of truth for both databases.
 *
 * It is applied automatically to the embedded local database on first use.
 * For Supabase, run `npm run db:sql` to write it to `supabase/schema.sql` and
 * paste that into the SQL editor once. Everything is `IF NOT EXISTS`, so
 * running it again is harmless.
 *
 * All money is in cents. Floating-point dollars drift, and a bill that is a
 * cent off is a bill the restaurant argues about.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  sub         text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS dishes (
  id           text PRIMARY KEY,
  category_key text NOT NULL REFERENCES categories(key) ON DELETE CASCADE,
  name         text NOT NULL,
  price        integer NOT NULL,
  "desc"       text NOT NULL,
  long         text NOT NULL DEFAULT '',
  tag          text NOT NULL DEFAULT '',
  ingredients  jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_url    text,
  available    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dishes_category_idx ON dishes (category_key, sort_order);

CREATE TABLE IF NOT EXISTS tables (
  id     text PRIMARY KEY,
  label  text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS promos (
  code            text PRIMARY KEY,
  percent_off     integer NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  max_redemptions integer,
  redemptions     integer NOT NULL DEFAULT 0,
  expires_at      timestamptz
);

-- Order numbers come from a sequence, never from count(*). Two guests tapping
-- Pay at the same moment used to be handed the same number, and one of the two
-- orders was lost to a unique-constraint violation.
CREATE SEQUENCE IF NOT EXISTS order_no_seq START 2401;

-- A table's open tab. Everything ordered while guests are seated hangs off one
-- of these, so the floor can see what a table has run up.
CREATE TABLE IF NOT EXISTS table_sessions (
  id         text PRIMARY KEY,
  table_id   text NOT NULL,
  status     text NOT NULL DEFAULT 'open',
  opened_at  timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

-- A table can only have one tab running at a time.
CREATE UNIQUE INDEX IF NOT EXISTS table_sessions_one_open
  ON table_sessions (table_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS orders (
  id             text PRIMARY KEY,
  order_no       text NOT NULL UNIQUE,
  mode           text NOT NULL,
  table_id       text,
  table_label    text,
  session_id     text,
  /** guest = ordered from a phone, staff = rung in on a restaurant device. */
  channel        text NOT NULL DEFAULT 'guest',
  /** Which device placed it, so a guest only ever sees their own history. */
  guest_id       text,
  status         text NOT NULL DEFAULT 'placed',
  subtotal       integer NOT NULL,
  discount       integer NOT NULL DEFAULT 0,
  service        integer NOT NULL DEFAULT 0,
  tax            integer NOT NULL DEFAULT 0,
  tip            integer NOT NULL DEFAULT 0,
  total          integer NOT NULL,
  split          integer NOT NULL DEFAULT 1,
  promo_code     text,
  payment_method text NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_ref    text,
  customer_name  text,
  customer_phone text,
  pickup_code    text,
  pickup_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

-- Migrations for databases created before pickup replaced delivery, and before
-- tables kept a tab.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'guest';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_id text;
UPDATE orders SET mode = 'pickup' WHERE mode = 'online';

CREATE INDEX IF NOT EXISTS orders_session_idx ON orders (session_id);
CREATE INDEX IF NOT EXISTS orders_guest_idx ON orders (guest_id);

-- Two open orders must never share a collection code.
CREATE UNIQUE INDEX IF NOT EXISTS orders_active_pickup_code
  ON orders (pickup_code)
  WHERE pickup_code IS NOT NULL AND status <> 'completed' AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS order_lines (
  id         text PRIMARY KEY,
  order_id   text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id    text NOT NULL,
  dish_name  text NOT NULL,
  unit_price integer NOT NULL,
  qty        integer NOT NULL,
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  note       text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS order_lines_order_idx ON order_lines (order_id);

CREATE TABLE IF NOT EXISTS favourites (
  guest_id   text NOT NULL,
  dish_id    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_id, dish_id)
);
`;

/** Split into individual statements. No literal in the DDL contains a `;`. */
export function statements(): string[] {
  return SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
