/**
 * The wire contracts, shared by both sides. No imports with runtime weight, so
 * a client component can use these without dragging the database in.
 */

import type { Mode, Totals } from "./totals";

export interface OrderLineDto {
  dishId: string;
  name: string;
  /** What was served — plates voided after the fact are already taken off. */
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

/**
 * - `awaiting_payment` — recorded, card not yet charged. Invisible to the pass.
 * - `placed` → `in_kitchen` → `ready` → `completed`
 * - `cancelled` — voided by staff, or the payment failed.
 */
export type OrderStatus =
  | "awaiting_payment"
  | "placed"
  | "in_kitchen"
  | "ready"
  | "completed"
  | "cancelled";

/** An order as its own guest sees it after the fact — for tracking and reloads. */
export interface GuestOrderView extends PlacedOrder {
  status: OrderStatus;
  paymentStatus: string;
  voided: boolean;
}

export interface OrderSummaryLine {
  /** Present only on staff views — it's what a void is addressed to. */
  lineId?: string;
  dishId: string;
  name: string;
  qty: number;
  voidedQty: number;
  exclusions: string[];
  note: string;
}

export interface OrderSummary {
  orderNo: string;
  date: string;
  mode: Mode;
  where: string;
  status: OrderStatus;
  paymentStatus: string;
  /** Cents. */
  total: number;
  lines: OrderSummaryLine[];
  voided: boolean;
  voidReason?: string;
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
  | { ok: false; error: string; field?: "lines" | "payment" | "promo" | "pickup" | "table" };

export type ActionResult = { ok: true } | { ok: false; error: string };
