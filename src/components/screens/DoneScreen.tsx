"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckBig } from "@/components/icons";
import { AppShell, ScreenBody, ScreenFooter } from "@/components/shell/AppShell";
import { RESTAURANT } from "@/config/restaurant";
import type { GuestOrderView, OrderStatus, PlacedOrder } from "@/lib/api-types";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./Checkout.module.css";

const POLL_MS = 15_000;

/**
 * M7, and order tracking.
 *
 * Everything here comes from the server — the order number, the lines, the
 * collection code, the amount charged. It used to live only in memory, so a
 * reload, or the phone locking and the tab being discarded, lost the six-digit
 * code the guest needed to collect their food. The order number now rides in
 * the URL, and this screen fetches the order back (for its own device only) and
 * keeps following it through the kitchen.
 */
export function DoneScreen({ orderRef }: { orderRef: string | null }) {
  const router = useRouter();
  const { state, resetOrder } = useStore();
  const [live, setLive] = useState<GuestOrderView | null>(null);
  const [missing, setMissing] = useState(false);

  // What the pay screen handed over, until the server's copy arrives.
  const justPlaced =
    state.placed && (!orderRef || state.placed.orderNo === `#${orderRef}`) ? state.placed : null;

  useEffect(() => {
    if (!orderRef) {
      if (!justPlaced) router.replace("/");
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderRef)}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { order: GuestOrderView };
        if (!cancelled) setLive(data.order);
      } catch {
        // Offline for a moment — keep what's on screen and try again next tick.
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderRef]);

  const order: PlacedOrder | null = live ?? justPlaced;

  if (!order) {
    return (
      <AppShell>
        <ScreenBody>
          <div className={s.done} style={{ padding: "60px 10px 0" }}>
            <div className={s.doneTitle}>{missing ? "We can't find that order" : "Looking it up…"}</div>
            {missing && (
              <p className={s.doneBody}>
                It may have been placed on another phone. Your orders from this phone are under Past
                orders.
              </p>
            )}
          </div>
        </ScreenBody>
        <ScreenFooter>
          <div className={s.doneFooter}>
            <Link href="/orders" className={s.doneButton}>
              Past orders
            </Link>
          </div>
        </ScreenFooter>
      </AppShell>
    );
  }

  const pickup = order.mode === "pickup";
  const status = live?.status;
  const voided = live?.voided ?? false;

  return (
    <AppShell>
      <ScreenBody padded={false}>
        <div className={s.done} style={{ padding: "16px 30px 0" }}>
          <div className={s.checkRing}>
            <CheckBig />
          </div>
          <div className={s.doneTitle}>{headline(pickup, status, voided)}</div>
          <p className={s.doneBody}>{body(pickup, status, voided, order.pickupLabel)}</p>

          {status && !voided && <StatusSteps pickup={pickup} status={status} />}

          {/* The whole point of ordering ahead: six digits, and you walk out. */}
          {pickup && order.pickupCode && !voided && status !== "completed" && (
            <div className={s.codeCard}>
              <div className={s.codeLabel}>Collection code</div>
              <div className={s.code}>{order.pickupCode}</div>
              <div className={s.codeMeta}>
                {order.customerName ? `${order.customerName} · ` : ""}
                {order.pickupLabel ?? ""}
              </div>
              <div className={s.codeAddress}>{RESTAURANT.address}</div>
            </div>
          )}

          <div className={s.orderCard}>
            <div className={s.orderHead}>
              <span className={s.orderHeadLabel}>Order</span>
              <span className={s.orderNo}>{order.orderNo}</span>
            </div>
            {order.lines.map((l, i) => (
              <div key={`${l.dishId}-${i}`} className={s.orderLine}>
                <span className={s.orderQty}>{l.qty}×</span>
                <span className={s.orderName}>{l.name}</span>
                <span className={s.orderLineTotal}>{money(l.lineTotal)}</span>
              </div>
            ))}
            <div className={s.paidRow}>
              <span className={s.paidLabel}>{voided ? "Refund due" : "Paid"}</span>
              <span className={s.paidValue}>{money(order.totals.total)}</span>
            </div>
          </div>

          <div className={s.ticket}>
            <div className={s.ticketTab}>KITCHEN COPY</div>
            <div className={s.ticketCaption}>What the pass prints</div>
            {order.lines.map((l, i) => (
              <div key={`${l.dishId}-${i}`} className={s.ticketLine}>
                <div className={s.ticketHead}>
                  <span className={s.ticketQty}>{l.qty}×</span>
                  <span className={s.ticketName}>{l.name}</span>
                </div>
                {l.exclusions.length > 0 && <div className={s.lineExcl}>{exclusionLine(l.exclusions)}</div>}
                {l.note && <div className={s.lineNote}>&ldquo;{l.note}&rdquo;</div>}
              </div>
            ))}
          </div>
          <div style={{ height: 18 }} />
        </div>
      </ScreenBody>

      <ScreenFooter>
        <div className={s.doneFooter}>
          <button
            type="button"
            className={s.doneButton}
            onClick={() => {
              router.replace("/");
              resetOrder();
            }}
          >
            Back to the menu
          </button>
        </div>
      </ScreenFooter>
    </AppShell>
  );
}

function headline(pickup: boolean, status: OrderStatus | undefined, voided: boolean): string {
  if (voided) return "This order was cancelled";
  if (status === "ready") return pickup ? "Ready to collect" : "On its way to you";
  if (status === "completed") return pickup ? "Collected — enjoy" : "Served — enjoy";
  return pickup ? "We're on it" : "Sent to the kitchen";
}

function body(
  pickup: boolean,
  status: OrderStatus | undefined,
  voided: boolean,
  pickupLabel?: string,
): string {
  if (voided) {
    return "The restaurant cancelled this order. Your payment will be refunded — ask us if you have any questions.";
  }
  if (status === "ready" && pickup) return "Show the code at the counter — no need to queue.";
  if (status === "completed") return "Thanks for ordering with us.";
  return pickup
    ? `Ready at ${pickupLabel ?? "the time you picked"}. Show the code at the counter — no need to queue.`
    : "The kitchen has it. Mezze come out first, grill follows. Flag any of us if you want to add to the table.";
}

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "placed", label: "Received" },
  { key: "in_kitchen", label: "Cooking" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Collected" },
];

function StatusSteps({ pickup, status }: { pickup: boolean; status: OrderStatus }) {
  const reached = STEPS.findIndex((st) => st.key === status);
  return (
    <div className={s.steps}>
      {STEPS.map((st, i) => (
        <div key={st.key} className={s.step} data-on={i <= reached}>
          <span className={s.stepDot} />
          <span className={s.stepLabel}>{!pickup && st.key === "completed" ? "Served" : st.label}</span>
        </div>
      ))}
    </div>
  );
}
