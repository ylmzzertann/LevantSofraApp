import { DISHES } from "@/data/menu";
import type { BagLine } from "./bag";
import { money } from "./money";

export type Mode = "table" | "online";

export const PROMO_CODE = "LEVANT10";
export const PROMO_RATE = 0.1;
export const DELIVERY_FEE = 4.9;
export const FREE_DELIVERY_OVER = 60;
export const SERVICE_RATE = 0.05;

export interface Totals {
  sub: number;
  discount: number;
  delivery: number;
  service: number;
  tip: number;
  /** Shown as Total on the bag screen — tip-free, so the rows sum to it exactly. */
  preTip: number;
  /** Shown on the payment screen. */
  total: number;
  /** Split across the table, if a split is active. */
  due: number;
}

export interface TotalsInput {
  bag: BagLine[];
  mode: Mode;
  promoOn: boolean;
  tip: number;
  split: number;
}

export function computeTotals({ bag, mode, promoOn, tip, split }: TotalsInput): Totals {
  const online = mode === "online";
  const sub = bag.reduce((a, l) => a + DISHES[l.id].price * l.qty, 0);
  const discount = promoOn ? sub * PROMO_RATE : 0;
  const delivery = online ? (sub >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE) : 0;
  const service = online ? 0 : sub * SERVICE_RATE;
  const tipAmt = (sub - discount) * tip;
  const preTip = sub - discount + delivery + service;
  const total = preTip + tipAmt;
  return {
    sub,
    discount,
    delivery,
    service,
    tip: tipAmt,
    preTip,
    total,
    due: split > 1 ? total / split : total,
  };
}

export interface TotalRow {
  label: string;
  value: string;
  positive?: boolean;
}

/** The rows above the Total line on the bag screen. */
export function totalRows(t: Totals, mode: Mode): TotalRow[] {
  const rows: TotalRow[] = [{ label: "Subtotal", value: money(t.sub) }];
  if (t.discount) {
    rows.push({ label: `Promo ${PROMO_CODE}`, value: "−" + money(t.discount), positive: true });
  }
  if (mode === "table") {
    rows.push({ label: "Service 5%", value: money(t.service) });
  } else {
    rows.push({
      label: t.delivery ? "Delivery" : `Delivery (free over $${FREE_DELIVERY_OVER})`,
      value: t.delivery ? money(t.delivery) : "Free",
    });
  }
  return rows;
}

/** The bag rows plus the tip — the payment screen's breakdown. */
export function payRows(t: Totals, mode: Mode): TotalRow[] {
  return totalRows(t, mode).concat([{ label: "Tip", value: money(t.tip) }]);
}

export function validatePromo(code: string): { valid: boolean; message: string } {
  const ok = code.trim().toUpperCase() === PROMO_CODE;
  return {
    valid: ok,
    message: ok
      ? `${PROMO_CODE} applied — 10% off the food.`
      : `That code isn't live. Try ${PROMO_CODE}.`,
  };
}
