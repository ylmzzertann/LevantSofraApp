"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CheckBig } from "@/components/icons";
import { AppShell, ScreenBody, ScreenFooter } from "@/components/shell/AppShell";
import { DISHES } from "@/data/menu";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./Checkout.module.css";

/**
 * M7. The KITCHEN COPY block is the proof of the exclusion feature: it mirrors
 * the ticket the pass prints, exclusions and notes and all.
 */
export function DoneScreen() {
  const router = useRouter();
  const { state, resetOrder } = useStore();
  const order = state.placed;

  useEffect(() => {
    if (!order) router.replace("/");
  }, [order, router]);

  if (!order) return null;

  const online = order.mode === "online";

  return (
    <AppShell>
      <ScreenBody padded={false}>
        <div className={s.done} style={{ padding: "16px 30px 0" }}>
          <div className={s.checkRing}>
            <CheckBig />
          </div>
          <div className={s.doneTitle}>{online ? "On its way" : "Sent to the kitchen"}</div>
          <p className={s.doneBody}>
            {online
              ? `Your order is with the kitchen. We’ll ring ${state.addr.phone || "you"} when the courier is downstairs — about 35 minutes.`
              : "The kitchen has it. Mezze come out first, grill follows. Flag any of us if you want to add to the table."}
          </p>

          <div className={s.orderCard}>
            <div className={s.orderHead}>
              <span className={s.orderHeadLabel}>Order</span>
              <span className={s.orderNo}>{order.orderNo}</span>
            </div>
            {order.lines.map((l) => (
              <div key={l.key} className={s.orderLine}>
                <span className={s.orderQty}>{l.qty}×</span>
                <span className={s.orderName}>{DISHES[l.id].name}</span>
                <span className={s.orderLineTotal}>{money(DISHES[l.id].price * l.qty)}</span>
              </div>
            ))}
            <div className={s.paidRow}>
              <span className={s.paidLabel}>Paid</span>
              <span className={s.paidValue}>{money(order.total)}</span>
            </div>
          </div>

          <div className={s.ticket}>
            <div className={s.ticketTab}>KITCHEN COPY</div>
            <div className={s.ticketCaption}>What the pass prints</div>
            {order.lines.map((l) => (
              <div key={l.key} className={s.ticketLine}>
                <div className={s.ticketHead}>
                  <span className={s.ticketQty}>{l.qty}×</span>
                  <span className={s.ticketName}>{DISHES[l.id].name}</span>
                </div>
                {l.excl.length > 0 && <div className={s.lineExcl}>{exclusionLine(l.excl)}</div>}
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
