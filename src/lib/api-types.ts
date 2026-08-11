/**
 * The wire contracts, shared by both sides. No imports with runtime weight, so
 * a client component can use these without dragging the database in.
 */

import type { Mode, Totals } from "./totals";

export interface OrderLineDto {
  dishId: string;
  name: string;
  qty: number;
  exclusions: string[];
  note: string;
  /** Cents. */
  lineTotal: number;
}

/** What `POST /orders` hands back — the confirmation screen renders exactly this. */
export interface PlacedOrder {
  orderNo: string;
  date: string;
  mode: Mode;
  where: string;
  totals: Totals;
  lines: OrderLineDto[];
  /** Pickup orders only: the six digits shown at the counter. */
  pickupCode?: string;
  /** Pickup orders only: `7:45 PM`. */
  pickupLabel?: string;
  customerName?: string;
}

export type OrderStatus = "placed" | "in_kitchen" | "ready" | "completed" | "cancelled";

export interface OrderSummary {
  orderNo: string;
  date: string;
  mode: Mode;
  where: string;
  status: string;
  /** Cents. */
  total: number;
  lines: Omit<OrderLineDto, "lineTotal">[];
  pickupCode?: string;
  pickupLabel?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface PromoResult {
  valid: boolean;
  percentOff: number;
  message: string;
}

export type PlaceOrderResult =
  | { ok: true; order: PlacedOrder }
  | { ok: false; error: string; field?: "lines" | "payment" | "promo" | "pickup" };
