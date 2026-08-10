"use client";

import { useRouter } from "next/navigation";
import { ArrowOut } from "@/components/icons";
import { AppShell, ScreenBody, ScreenHeader, TitleRow } from "@/components/shell/AppShell";
import { DISHES } from "@/data/menu";
import { money } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./Lists.module.css";

/** M9 — past orders. Re-ordering replaces the bag and opens the bag screen. */
export function OrdersScreen() {
  const router = useRouter();
  const { state, setBag } = useStore();

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow title="Past orders" backTo="/" />
      </ScreenHeader>
      <ScreenBody>
        {state.orders.length === 0 ? (
          <p className={s.empty}>Nothing here yet. Your first order will show up on this list.</p>
        ) : (
          state.orders.map((o) => (
            <div key={o.orderNo} className={s.card}>
              <div className={s.cardHead}>
                <span className={s.date}>{o.date}</span>
                <span className={s.badge} data-mode={o.mode}>
                  {o.where}
                </span>
              </div>
              <div className={s.items}>
                {o.lines
                  .map((l) => (l.qty > 1 ? `${l.qty}× ` : "") + DISHES[l.id].name)
                  .join(", ")}
              </div>
              <div className={s.cardFoot}>
                <span className={s.cardTotal}>{money(o.total)}</span>
                <button
                  type="button"
                  className={s.reorder}
                  onClick={() => {
                    setBag(o.lines);
                    router.push("/bag");
                  }}
                >
                  <span>Order again</span>
                  <div className={s.reorderChip}>
                    <ArrowOut size={11} color="#C04B2D" />
                  </div>
                </button>
              </div>
            </div>
          ))
        )}
        <div className={s.tail} />
      </ScreenBody>
    </AppShell>
  );
}
