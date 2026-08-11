import { RESTAURANT } from "@/config/restaurant";
import type { BagLine } from "./bag";
import { money } from "./money";

/**
 * The single implementation of the bill. The API imports this too, so the
 * number the guest sees and the number the server charges cannot drift apart.
 *
 * Every value is integer cents.
 */

/** `table` = seated, scanned the QR. `pickup` = ordered ahead, collecting in person. */
export type Mode = "table" | "pickup";

export const PROMO_RATE = 0.1;
export const SERVICE_RATE = RESTAURANT.serviceRate;

export interface Totals {
  sub: number;
  discount: number;
  service: number;
  tax: number;
  tip: number;
  /** Shown as Total on the bag screen — tip-free, so the rows sum to it exactly. */
  preTip: number;
  /** The whole bill, tip included. This is what gets charged. */
  total: number;
  /** What one person owes when the table splits. Informational — see below. */
  perPerson: number;
}

export interface TotalsInput {
  /** Unit price in cents per dish id — the server prices from its own menu. */
  prices: Record<string, number>;
  bag: BagLine[];
  mode: Mode;
  /** Percent off the food, 0 when no promo is active. */
  percentOff?: number;
  tip: number;
  split: number;
}

export function computeTotals({
  prices,
  bag,
  mode,
  percentOff = 0,
  tip,
  split,
}: TotalsInput): Totals {
  const sub = bag.reduce((a, l) => a + (prices[l.id] ?? 0) * l.qty, 0);
  const discount = Math.round((sub * percentOff) / 100);
  // A collected order carries no service charge; only a table does.
  const service = mode === "table" ? Math.round(sub * SERVICE_RATE) : 0;
  // Tax follows the discounted food — not the tip.
  const tax = RESTAURANT.tax.enabled ? Math.round((sub - discount) * RESTAURANT.tax.rate) : 0;
  const tipAmt = Math.round((sub - discount) * tip);
  const preTip = sub - discount + service + tax;
  const total = preTip + tipAmt;
  return {
    sub,
    discount,
    service,
    tax,
    tip: tipAmt,
    preTip,
    total,
    perPerson: split > 1 ? Math.round(total / split) : total,
  };
}

export interface TotalRow {
  label: string;
  value: string;
  positive?: boolean;
}

/** The rows above the Total line on the bag screen. */
export function totalRows(t: Totals, mode: Mode, promoCode?: string): TotalRow[] {
  const rows: TotalRow[] = [{ label: "Subtotal", value: money(t.sub) }];
  if (t.discount) {
    rows.push({
      label: promoCode ? `Promo ${promoCode}` : "Promo",
      value: "−" + money(t.discount),
      positive: true,
    });
  }
  if (mode === "table") {
    rows.push({ label: "Service 5%", value: money(t.service) });
  }
  if (t.tax) rows.push({ label: RESTAURANT.tax.label, value: money(t.tax) });
  return rows;
}

/** The bag rows plus the tip — the payment screen's breakdown. */
export function payRows(t: Totals, mode: Mode, promoCode?: string): TotalRow[] {
  return totalRows(t, mode, promoCode).concat([{ label: "Tip", value: money(t.tip) }]);
}
