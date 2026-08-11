"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CheckBig } from "@/components/icons";
import { AppShell, ScreenBody, ScreenFooter } from "@/components/shell/AppShell";
import { RESTAURANT } from "@/config/restaurant";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./Checkout.module.css";

/**
 * M7. Everything here comes from the server's answer, not from the bag — the
 * order number, the lines, the collection code and the amount charged are what
 * was actually recorded. The KITCHEN COPY block mirrors the ticket the pass
 * prints.
 */
export function DoneScreen() {
  const router = useRouter();
  const { state, resetOrder } = useStore();
  const order = state.placed;

  useEffect(() => {
    if (!order) router.replace("/");
  }, [order, router]);

  if (!order) return null;

  const pickup = order.mode === "pickup";

  return (
    <AppShell>
      <ScreenBody padded={false}>
        <div className={s.done} style={{ padding: "16px 30px 0" }}>
          <div className={s.checkRing}>
            <CheckBig />
          </div>
          <div className={s.doneTitle}>{pickup ? "We're on it" : "Sent to the kitchen"}</div>
          <p className={s.doneBody}>
            {pickup
              ? `Ready at ${order.pickupLabel ?? "the time you picked"}. Show the code at the counter — no need to queue.`
              : "The kitchen has it. Mezze come out first, grill follows. Flag any of us if you want to add to the table."}
          </p>

          {/* The whole point of ordering ahead: six digits, and you walk out. */}
          {pickup && order.pickupCode && (
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
              <span className={s.paidLabel}>Paid</span>
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
                {l.exclusions.length > 0 && (
                  <div className={s.lineExcl}>{exclusionLine(l.exclusions)}</div>
                )}
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
