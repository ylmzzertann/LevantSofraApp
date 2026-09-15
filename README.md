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
| Back of house | <http://localhost:3000/admin> — `owner@levant.dev` / `levant-dev` (development only) |
| The pass | <http://localhost:3000/admin/kitchen> |
| A table's real link | open **Tables & QR** in the back office and use a sticker's link — a bare `/t/12` is refused |

Table links are signed, so `localhost:3000/t/12` on its own shows *code not recognised* — that's the security working.

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
- **Rung in** — a waiter adds items from `/admin/tables`. No card, no tip: the round goes on the tab as `on_tab`, owed until the table pays.

Money comes off a tab as the table wants it to: **part payments** by cash, card terminal or other (one guest's share now, the rest later), and a final **settle** that takes whatever is left and frees the table. The tab shows *Total*, *Paid on phones*, *Taken here* and *Owed*.

Mistakes come off too, always with a reason that goes on the record:

- **−1** takes one plate off a round that's still on the tab. The line keeps its row with `voided_qty` raised, the round is repriced from the prices it was rung in at, and the pass shows "1 taken off — make 1".
- **Void round** takes the whole round off. If the guest had already paid for it on their phone it becomes `refund_due`: owners only, and the tab can't settle until an owner marks it refunded (the refund itself happens in the payment provider).
- A voided ticket stays on the pass for 20 minutes, struck through with **Voided — stop**, so nobody keeps cooking it.
- If a round is voided *after* the table paid for it at the table, the tab shows **to give back** and won't settle until the money is handed back and recorded. Before this, the table closed at "Owed $0" and the till was quietly over.

A partial unique index guarantees a table can only have one tab running:

```sql
CREATE UNIQUE INDEX table_sessions_one_open ON table_sessions (table_id) WHERE status = 'open';
```

## Back of house

Everyone signs in as themselves. Two roles:

| | Staff | Owner |
|---|---|---|
| Floor, ring in, take payments, settle | ✓ | ✓ |
| The pass, move tickets, void on-tab rounds and plates | ✓ | ✓ |
| 86 a dish | ✓ | ✓ |
| Void a round a guest already paid for, record refunds | | ✓ |
| Add, edit, reprice, reorder, delete dishes and sections | | ✓ |
| Tables and QR stickers, staff accounts, the activity log | | ✓ |

The roles are enforced on the server in every action and endpoint — hiding a button is never the protection. Tested by calling owner-only server actions directly from a staff session: refused, and nothing changed.

- **`/admin/tables`** — the floor.
- **`/admin/kitchen`** — every open ticket in the order the food is needed, the collection-code lookup, and `placed → in_kitchen → ready → completed`. Tickets can't be dragged back from completed, and two tablets can't both advance the same ticket.
- **`/admin/menu`** — dishes and sections. **86** is the control that matters in service; every phone already on the menu greys the row out within a minute. Sections can be added, renamed, reordered, hidden (their dishes stop being orderable, even by id) and deleted once empty. Ingredients are a comma-separated line where `*` marks something the kitchen can't leave out.
- **`/admin/qr`** — the tables in service and a printable sheet of signed QR stickers.
- **`/admin/staff`** — accounts, password resets and the **activity log**: who signed in, 86'd, repriced, voided, took a payment, settled.

Sessions live in the database (only a hash of the token is stored), so signing out, switching someone off or resetting their password ends their sessions **immediately** — verified: the very next request from a switched-off account is refused. Sign-in is limited per address and per account.

**First run.** In development an owner account is created automatically (`owner@levant.dev` / `levant-dev`). In production nobody is created: open `/admin/setup` once and create the owner with the `SETUP_TOKEN` from the server's environment. The setup page stops working the moment an account exists.

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
| `GET /api/orders/LS-2417` | one order, **for the device that placed it** — tracking and reloads; 404 for anyone else |
| `GET \| POST /api/kitchen` | the ticket board: status changes, voids, refunds (staff only) |
| `GET \| POST /api/tables` | the floor: ring in, part payments, voids, give back, settle (staff only) |

Admin mutations are server actions rather than REST: they are form-driven and staff-only. The public surface stays REST so a future native app has something to talk to.

**Nothing about the bill is trusted from the browser.** The order body carries dish ids and quantities; the server prices them from its own menu, re-validates the promo, refuses anything that has just sold out, re-checks the collection time and the table number, and recomputes the total it charges. A browser cannot claim to be staff — `channel` is decided server-side from the session, never read from the body.

## Fixed after an audit

These were all real, and all reproduced before being fixed.

**Second pass**

- **In production the admin password silently defaulted to `levant`** if nobody set one. Replaced by per-person accounts; production creates no account at all until `/admin/setup` is used with the server's token.
- **No limit on sign-in attempts** — the shared password could be guessed at full speed. Now limited per address and per account.
- **A stolen admin cookie stayed valid for twelve hours**, because a session was a signed timestamp nothing could revoke. Sessions are database rows now.
- **Stored XSS through dish photos.** The upload kept the file's own name and declared type, so an HTML page called `dish.html` and declared as a PNG was written into `public/uploads` and served as a page from this site. Images are now identified by their bytes and saved with the extension those bytes imply.
- **"Add a dish" overwrote existing dishes.** It was an upsert: typing a taken id replaced that dish's name, price and photo. Creating and editing are separate, and creating refuses a taken id.
- **Table codes were guessable.** `/t/13` let anyone order to table 13. Stickers carry an HMAC signature (`APP_SECRET`), and the order endpoint checks it again.
- **The card was charged before the order was recorded.** A database failure after the charge took money for an order that didn't exist. The order is now written first as `awaiting_payment` — invisible to the kitchen — and only a successful charge releases it; a failed one is cancelled and gives back any promo use.
- **Order and lines weren't written atomically.** A failure between them left an order with no dishes. They're one transaction now, retried whole on a collision.
- **Promo codes could be over-redeemed** — check-then-increment let two orders take the last use. Now claimed with one conditional `UPDATE` inside the order's transaction. (PGlite serialises its connection, so this can't be race-tested locally; it rests on a single Postgres statement's atomicity.)
- **A wrong promo code replied "Try LEVANT10"**, handing out the discount, and promo validation had no rate limit, so it could be scripted.
- **The pickup code lived only in memory.** A reload or a discarded tab lost the code needed to collect the food. The confirmation screen fetches the order back from the server and follows it through the kitchen; Past orders shows the code while it's still waiting.
- **A sold-out dish could be added from its own page**, and quantities had no cap, so a line past 50 failed at payment with an error that didn't say why.
- **Dishes in a hidden section stayed orderable** by anyone posting their ids.
- **React 19 wiped forms on a validation error.** "That id is taken" arrived with the whole dish form blank, and a mistyped password cleared the email.
- **Settling a table ignored overpayment** — see *Two ways in, one bill*.
- **Rate limits lived in process memory**, reset on deploy and weren't shared between instances. They're in the database now.

**First pass**

- **`GET /api/orders` returned every order in the restaurant to anyone who asked** — names, phone numbers and six-digit collection codes. A code is enough to walk up to the counter and take somebody else's dinner. History is now scoped to an anonymous per-device id issued by `middleware.ts`; without the cookie you get an empty list.
- **Concurrent orders were being dropped.** `order_no` came from `count(*) + 2401`, so two guests tapping Pay in the same second got the same number and one order died on the unique index. Eight simultaneous orders reliably lost five of them. Order numbers now come from a Postgres sequence, and the insert retries on a collision. Eight simultaneous orders now all land, with unique numbers.
- **An unhandled throw returned an empty 500**, so the guest saw "couldn't reach the kitchen" with no idea whether they had been charged. Both order endpoints now always answer in the shape the client parses.
- **Any table number in the URL was accepted.** `/t/999` would happily send food to a table that doesn't exist. The table is now checked against the `tables` table and has to be active.
- **Order placement had no ceiling.** It is unauthenticated by design — a guest scans a QR — so it now allows 12 orders per address per five minutes.
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
3. Set `APP_SECRET` (table stickers can't be signed without it) and `PUBLIC_BASE_URL` (the address printed in them).
4. Set `SETUP_TOKEN`, open `/admin/setup`, create the owner, then add everyone else from **Staff**.
5. Implement Stripe and move card entry to Elements.
6. Point `DATABASE_URL` at Supabase and configure Storage.
7. Print the stickers from **Tables & QR** and put one on every table.
8. Shoot the photography.

## Still open

Known and deliberate, not oversights:

- **The per-address limits trust proxy headers.** Right behind Vercel or a reverse proxy that sets `x-real-ip`; on a server exposed directly a client can send its own and dodge the per-address limit. Sign-in is also limited per account for exactly that reason; order placement is not.
- **Anyone at a table can order to it.** The sticker is on the table and the guest pays on their own phone, so the risk is small; a staff-confirmed "seat" step is the fix if it ever matters.
- **Line voids are for rounds still on a tab.** A round a guest paid for on their phone can only be voided whole, because a partial refund needs the payment provider.
- **All local sign-ins share one limit bucket** — without proxy headers every request's address is "unknown" — so heavy local testing can hit *Too many attempts*. It clears after 15 minutes.
- **`resetLocalDb()` deletes the development database** on an open failure. It refuses to run when `DATABASE_URL` is set, but it is still a delete.

## Not designed yet

A "your order is ready" text to the pickup phone · calling a waiter from the table · reservations · guest accounts · allergen disclosure beyond VEG/HOT · Spanish (realistic in Miami; the UI is English-only) · true multi-payer split.
