# Levant Sofra

Eastern-Mediterranean restaurant in Miami. One product, two ways to order, one codebase:

- **Guests at a table** scan the QR sticker, land on `/t/12`, and order from their seat.
- **Anyone ordering ahead** builds a bag on the site, picks a collection time, pays, and gets a six-digit code to show at the counter.

The restaurant does **not** deliver. Same menu, same item detail, same bag — two shells and two checkout tails. Plus a back of house: a menu editor and a live ticket board.

```bash
npm install
npm run dev
```

Nothing else to configure. On first run the app creates an embedded Postgres, applies the schema and seeds the menu, so a fresh clone just works.

| | |
|---|---|
| Web site | <http://localhost:3000> |
| A table | <http://localhost:3000/t/12> |
| Back of house | <http://localhost:3000/admin> — password `levant` |
| The pass | <http://localhost:3000/admin/kitchen> |

Resize below 768px, or use device emulation, to see the phone shell.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · CSS Modules · Postgres via Drizzle. No UI library and no CSS framework — the design specifies exact pixel values and one motion curve, and a token layer in plain CSS reproduces that more honestly than utility classes would.

## The two shells

The Phone/Desktop switch in the prototype was a demo device and is gone. The real rule is the viewport:

| Route | ≥ 768px | < 768px |
|---|---|---|
| `/` | W1–W4 — the web site | M2 — the phone menu screen |
| `/bag` `/pickup` `/pay` `/done` `/item/[id]` `/saved` `/orders` | the same screens in a centred 620px cream sheet | full-viewport phone screens |
| `/t/[table]` | (a QR is a phone thing, but it renders in the sheet) | M1 — QR landing |

The switch is pure CSS (`.ls-mobile-only` / `.ls-desktop-only` in `globals.css`), so there is no viewport guessing on the server and no layout flash on the client.

Every screen route uses the same three-band shell — fixed header, scrolling body, fixed footer — from `components/shell/AppShell.tsx`. On the phone the stage is exactly `100dvh` and only the body band scrolls; that is what keeps the bag bar and the primary action reachable as content grows.

There is **no native app**. For a QR-at-a-table product that is the right answer — nobody installs an app to order a mezze — and the phone layout is the mobile web design.

## Ordering ahead

`mode` is `'table'` or `'pickup'`. Table mode is set by the QR; everything else is pickup.

The pickup screen (`/pickup`) asks who is collecting and when. **Collection slots are computed on the server** from the restaurant's own clock and opening hours, not the guest's device — a phone with a wrong timezone must not be able to book 3am. The server re-validates the chosen time on submit: it has to be at least the kitchen's lead time away, today, and inside opening hours.

On success the guest gets a **six-digit collection code**. It never starts with a zero — a code read aloud across a counter shouldn't lose its leading digit — and a partial unique index guarantees no two *uncollected* orders share one:

```sql
CREATE UNIQUE INDEX orders_active_pickup_code ON orders (pickup_code)
  WHERE pickup_code IS NOT NULL AND status <> 'completed' AND status <> 'cancelled';
```

At the counter, staff type the digits into the lookup on `/admin/kitchen` and the board narrows to that ticket. The kitchen queue is ordered by **when the food is needed**, not when it was ordered, so a noon order for an 8pm collection doesn't sit at the top of the pass all afternoon.

## Money

Integer cents everywhere — database, server, client. Only `lib/money.ts` turns cents into something a guest reads. Floating-point dollars drift, and a bill that is a cent off is a bill the restaurant argues about.

```
subtotal = Σ price × qty
discount = subtotal × percentOff/100          (server-validated promo)
service  = table ? subtotal × 0.05 : 0        (a collected order has none)
tax      = (subtotal − discount) × 0.07       (see below)
tipAmt   = (subtotal − discount) × tipRate    (never on service or tax)
preTip   = subtotal − discount + service + tax   // the bag screen's Total
total    = preTip + tipAmt                       // what gets charged
```

The bag total is tip-free so the rows shown there sum exactly to the total beneath them.

**Split the bill is informational.** One card pays the whole bill; the split figure is what each person owes so the table can settle between themselves. It used to charge only one share while marking the whole order paid — the restaurant would have collected a quarter of a four-way bill. True multi-payer (each phone paying its own share) needs a shared table session and is not built.

**Sales tax needs your accountant.** The handoff assumed tax-inclusive prices, which is the Istanbul convention; Florida menu prices are pre-tax and the tax is a checkout line, so it defaults **on** at 7% (6% state + 1% Miami-Dade surtax). A venue licensed to serve alcohol may also owe the county's 1% food-and-beverage tax, and Miami Beach adds a resort tax. Confirm the rate in `config/restaurant.ts` before taking real money — or set `tax.enabled: false`.

## The bag line

A bag entry is keyed by **dish + exclusions + note**, never by dish id:

```
key = id + (excl.sorted().join(',')) + note
```

So "Muhammara" and "Muhammara, no walnut" are two rows that live side by side, while the menu row shows their combined count. Exclusions and notes travel per line all the way to the kitchen ticket — that is the point of the feature.

## Two ways in, one bill

A table keeps an **open tab** (`table_sessions`). Every round ordered while those guests are seated hangs off it, whichever direction it came from:

- **From the table** — a guest scans the QR and orders on their phone. They pay there and then, so the round lands on the tab already `paid`.
- **Rung in** — a waiter adds items on a restaurant device from `/admin/tables`. No card, no tip: the round goes on the tab as `on_tab`, owed until the table settles.

`/admin/tables` is the floor: which tables are seated, what each has run up, a rolled-up item list, and every round with its exclusions and notes. **Total** is everything consumed; **Outstanding** is the part nobody has paid for yet. *Settle and free the table* marks the outstanding rounds paid and closes the tab — the next order at that table starts a fresh one.

A partial unique index guarantees a table can only have one tab running:

```sql
CREATE UNIQUE INDEX table_sessions_one_open ON table_sessions (table_id) WHERE status = 'open';
```

## Back of house

**`/admin`** — add, edit, reprice and photograph dishes. The control that matters during service is **86**: one tap marks a dish sold out, and every phone already sitting on the menu greys that row out within a minute without anyone reloading. Deleting is for a dish that was never real; 86 is for one that ran out, because past orders still point at the id.

Ingredients are entered as a comma-separated line where `*` marks something the kitchen cannot leave out — `*Hand-minced lamb, Sumac onion, Parsley`.

**`/admin/kitchen`** — every open ticket, plus the collection-code lookup. `placed → in_kitchen → ready → completed`. Exclusions print in terracotta, notes in italic. It polls every four seconds rather than holding a socket: a display on a shelf in a kitchen loses its network, and polling reconnects by itself.

Both are guarded by a shared password and a signed http-only cookie. Enough for a back-of-house tablet behind HTTPS, but it has **no per-person identity and no audit trail** — move it to Supabase Auth with one account per staff member.

## Database

One schema, two drivers, selected by whether `DATABASE_URL` is set.

- **unset** → embedded Postgres (PGlite) at `%LOCALAPPDATA%\levant-sofra\pg` (Windows) or `~/.cache/levant-sofra/pg`. Deliberately **outside the project folder**: a Postgres cluster is ~1000 files that change on every write, and a file-sync client like OneDrive or Dropbox will corrupt it mid-service. Override with `LOCAL_DB_DIR`.
- **set** → Supabase, or any Postgres, over the wire.

If the dev server is killed rather than shut down, the leftover `postmaster.pid` makes PGlite abort on the half-written cluster. The app detects that on startup and rebuilds — it is a scratch database reseeded from `data/menu.ts`, so throwing it away is safe. That path is never reached when `DATABASE_URL` is set.

To move to Supabase:

1. Create the project.
2. `npm run db:sql`, then paste `supabase/schema.sql` into the SQL editor. It is idempotent.
3. Put the pooler connection string in `.env.local` as `DATABASE_URL`.
4. Create a public `dish-photos` bucket and set the Supabase variables, or dish photos will not survive a deploy.

See `.env.example`.

## API

| Endpoint | |
|---|---|
| `GET /api/menu` | the live menu, including what has run out |
| `POST /api/orders` | places an order — **carries no prices** |
| `GET /api/orders` | **this device's** order history, nobody else's |
| `POST /api/promos/validate` | `{ valid, percentOff, message }` |
| `GET \| POST /api/kitchen` | the ticket board and its status transitions (staff only) |
| `GET \| POST /api/tables` | the floor, ringing in a round, settling a tab (staff only) |

Admin mutations are server actions rather than REST: they are form-driven and staff-only. The public surface stays REST so a future native app has something to talk to.

**Nothing about the bill is trusted from the browser.** The order body carries dish ids and quantities; the server prices them from its own menu, re-validates the promo, refuses anything that has just sold out, re-checks the collection time and the table number, and recomputes the total it charges. A browser cannot claim to be staff — `channel` is decided server-side from the session, never read from the body.

## Fixed after an audit

These were all real, and all reproduced before being fixed:

- **`GET /api/orders` returned every order in the restaurant to anyone who asked** — names, phone numbers and six-digit collection codes. A code is enough to walk up to the counter and take somebody else's dinner. History is now scoped to an anonymous per-device id issued by `middleware.ts`; without the cookie you get an empty list.
- **Concurrent orders were being dropped.** `order_no` came from `count(*) + 2401`, so two guests tapping Pay in the same second got the same number and one order died on the unique index. Eight simultaneous orders reliably lost five of them. Order numbers now come from a Postgres sequence, and the insert retries on a collision. Eight simultaneous orders now all land, with unique numbers.
- **An unhandled throw returned an empty 500**, so the guest saw "couldn't reach the kitchen" with no idea whether they had been charged. Both order endpoints now always answer in the shape the client parses.
- **Any table number in the URL was accepted.** `/t/999` would happily send food to a table that doesn't exist. The table is now checked against the `tables` table and has to be active.
- **Order placement had no ceiling.** It is unauthenticated by design — a guest scans a QR — so it now allows 12 orders per IP per five minutes. In-memory and per-process: move it to Redis or the edge before running more than one instance.
- **The anonymous id fragmented under concurrency.** Minting it lazily inside the order handler meant two simultaneous first orders minted two ids and one was lost, so a guest's own history came back short. It is issued on first page view instead.

## Payments

Not live. The `mock` provider approves everything so the flow can be exercised end to end; the interface is Stripe-shaped because the venue is in Miami and Stripe is the only major processor where the design's Apple Pay and Google Pay tabs work without compromise.

Card fields today are **display only** — never sent anywhere, never stored, never persisted to `localStorage`. To go live, implement `stripeProvider` in `server/payments.ts` and move card entry to Stripe Elements so the number never touches our server.

## Deliberate departures from the prototype

- **Delivery is gone.** The handoff's online mode was a delivery service with a fee, a free-over-$60 threshold and an address screen. This restaurant doesn't deliver, so that whole tail became order-ahead-and-collect.
- **Ingredients are a real field**, not a split of the description, with a non-removable flag.
- **Segmented pills are 44px tall**, against the prototype's ~37px — the handoff's own tap-target floor wins over its pill spec. Small circular controls keep their drawn size and grow their hit area with a transparent pseudo-element.
- **The grain is a PNG tile** (`npm run grain`), not a per-element SVG `feTurbulence`.
- **Dates read `Aug 9 · 9:10 PM`**, not `9 August · 21:10`, and address, phone and hours come from `config/restaurant.ts`.
- **The bag empties when the order is accepted**, not when the guest taps "Back to the menu".
- **Favourites stay on the device.** A QR guest has no account.

## Before this takes real money

1. Replace the placeholder address and phone in `config/restaurant.ts`.
2. Confirm the tax rate.
3. Set `ADMIN_PASSWORD` and `ADMIN_SECRET`, and preferably move staff auth to real accounts.
4. Implement Stripe and move card entry to Elements.
5. Point `DATABASE_URL` at Supabase and configure Storage.
6. Shoot the photography.

## Still open

Known and deliberate, not oversights:

- **Anyone who scans a table's QR can order to that table.** The code is printed on the table and the guest pays on their own phone, so the blast radius is small — but a staff-confirmed "seat" step is the real fix if it becomes a problem.
- **Rate limiting is per-process and in memory.** It resets on deploy and doesn't span instances.
- **Staff auth is a shared password.** No per-person identity, so "who 86'd the sea bass at 9pm" has no answer. Supabase Auth with one account per staff member is the fix.
- **Promo redemption counting is not transactional** — two orders redeeming the last use of a capped code can both succeed.
- **`resetLocalDb()` deletes the development database** on an open failure. It refuses to run when `DATABASE_URL` is set, but it is still a delete.
- **Voiding or amending a placed round** isn't built — a mistake rung in on a table can only be cancelled from the kitchen board, not removed from the tab.

## Not designed yet

Order tracking after confirmation · a "your order is ready" text to the pickup phone · calling a waiter from the table · reservations · guest accounts · allergen disclosure beyond VEG/HOT · Spanish (realistic in Miami; the UI is English-only) · true multi-payer split.
