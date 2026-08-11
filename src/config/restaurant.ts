/**
 * Everything about this particular restaurant lives here.
 *
 * The design handoff was written against an Istanbul address and a delivery
 * service. The venue is in Miami and does **not** deliver — an online order is
 * collected in person — so the locale-bound and service-bound facts are
 * collected in one place rather than scattered through the components. When
 * this grows, it becomes a `restaurants` row.
 *
 * TODO before launch: replace the placeholder address and phone with the real
 * ones, and confirm the tax rate with the restaurant's accountant.
 */

export const RESTAURANT = {
  name: "Levant Sofra",
  eyebrow: "Mezze · Fire · Sea",

  /** Placeholder — not a real address. */
  address: "120 NE 2nd Ave, Downtown Miami, FL 33132",
  /** Placeholder — not a real number. */
  phone: "+1 (305) 000-0000",

  currency: "USD",
  locale: "en-US",
  timeZone: "America/New_York",

  /** Minutes from midnight, in the restaurant's own timezone. */
  hours: {
    open: 12 * 60,
    close: 23 * 60 + 30,
  },

  pickup: {
    /** The kitchen will not promise anything sooner than this. */
    leadMinutes: 25,
    /** Collection slots are offered on this grid. */
    slotMinutes: 15,
    /** Last slot this long before closing. */
    lastOrderBeforeCloseMinutes: 30,
    /** How long a code stays valid for staff to look up. */
    codeDigits: 6,
  },

  /**
   * Florida charges 6% state sales tax and Miami-Dade adds a 1% surtax on
   * prepared food, so 7% is the usual figure — but a venue licensed to serve
   * alcohol may also owe the county's 1% food-and-beverage tax, and Miami Beach
   * adds a resort tax. Confirm the exact rate before taking money.
   *
   * The handoff assumed tax-inclusive prices, which is the Istanbul convention.
   * In Florida menu prices are pre-tax and the tax is a checkout line, so this
   * defaults on. Set `enabled: false` to go back to the handoff's behaviour.
   */
  tax: {
    enabled: true,
    rate: 0.07,
    label: "Sales tax (7%)",
  },

  /** Table mode only. A collected order has no service charge. */
  serviceRate: 0.05,
} as const;

function clockLabel(minuteOfDay: number): string {
  const h24 = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export const HOURS_LABEL = `Open today · ${clockLabel(RESTAURANT.hours.open)} — ${clockLabel(
  RESTAURANT.hours.close,
)}`;

/** `Aug 9 · 9:10 PM` — the handoff's `9 August · 21:10` is the wrong side of the Atlantic. */
export function formatOrderTime(d: Date): string {
  const date = d.toLocaleDateString(RESTAURANT.locale, {
    month: "short",
    day: "numeric",
    timeZone: RESTAURANT.timeZone,
  });
  return `${date} · ${formatClock(d)}`;
}

/** `9:10 PM` in the restaurant's timezone, wherever the guest happens to be. */
export function formatClock(d: Date): string {
  return d.toLocaleTimeString(RESTAURANT.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: RESTAURANT.timeZone,
  });
}

/** Minutes since midnight in the restaurant's timezone. */
export function minuteOfDay(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: RESTAURANT.timeZone,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

export interface PickupSlot {
  /** ISO timestamp — what travels to the server. */
  value: string;
  /** `7:45 PM` — what the guest reads. */
  label: string;
}

/**
 * Collection times still open today: from now plus the kitchen's lead time,
 * rounded up onto the slot grid, until shortly before closing.
 */
export function pickupSlots(now = new Date()): PickupSlot[] {
  const { leadMinutes, slotMinutes, lastOrderBeforeCloseMinutes } = RESTAURANT.pickup;
  const nowMinute = minuteOfDay(now);
  const earliest = Math.max(nowMinute + leadMinutes, RESTAURANT.hours.open);
  const latest = RESTAURANT.hours.close - lastOrderBeforeCloseMinutes;

  const slots: PickupSlot[] = [];
  let minute = Math.ceil(earliest / slotMinutes) * slotMinutes;
  while (minute <= latest && slots.length < 24) {
    const at = new Date(now.getTime() + (minute - nowMinute) * 60_000);
    slots.push({ value: at.toISOString(), label: formatClock(at) });
    minute += slotMinutes;
  }
  return slots;
}

/** The soonest the kitchen will have it ready. */
export function asapReadyAt(now = new Date()): Date {
  return new Date(now.getTime() + RESTAURANT.pickup.leadMinutes * 60_000);
}

export function isOpenNow(now = new Date()): boolean {
  const m = minuteOfDay(now);
  return m >= RESTAURANT.hours.open && m <= RESTAURANT.hours.close;
}
