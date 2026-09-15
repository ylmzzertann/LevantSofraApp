"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowOut } from "@/components/icons";
import { AppShell, ScreenBody, ScreenHeader, TitleRow } from "@/components/shell/AppShell";
import type { OrderSummary } from "@/lib/api-types";
import { bagKey } from "@/lib/bag";
import { money } from "@/lib/money";
import { useMenu } from "@/state/menu";
import { useStore } from "@/state/store";
import s from "./Lists.module.css";

const STATUS_LABEL: Record<string, string> = {
  placed: "Received",
  in_kitchen: "Cooking",
  ready: "Ready",
  completed: "Done",
  cancelled: "Cancelled",
};

/**
 * M9 — past orders, from the server. Re-ordering replaces the bag and opens it.
 * An order still waiting to be collected keeps its code here, and opens its
 * tracking screen — so a closed tab never costs a guest their collection code.
 */
export function OrdersScreen() {
  const router = useRouter();
  const { dishes } = useMenu();
  const { setBag } = useStore();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { orders: OrderSummary[] }) => live && setOrders(d.orders ?? []))
      .catch(() => live && setOrders([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow title="Past orders" backTo="/" />
      </ScreenHeader>
      <ScreenBody>
        {orders === null ? (
          <p className={s.empty}>Looking these up…</p>
        ) : orders.length === 0 ? (
          <p className={s.empty}>Nothing here yet. Your first order will show up on this list.</p>
        ) : (
          orders.map((o) => {
            // A dish that has since left the menu can't be re-ordered.
            const reorderable = o.lines.filter((l) => dishes[l.dishId]?.available);
            const open = !["completed", "cancelled"].includes(o.status);
            const ref = o.orderNo.replace(/^#/, "");
            return (
              <div key={o.orderNo} className={s.card}>
                <div className={s.cardHead}>
                  <span className={s.date}>{o.date}</span>
                  <span className={s.badge} data-mode={o.mode}>
                    {o.where}
                  </span>
                </div>
                <div className={s.statusLine} data-status={o.status}>
                  {STATUS_LABEL[o.status] ?? o.status}
                  {o.pickupCode && open && (
                    <>
                      {" · code "}
                      <strong className={s.code}>{o.pickupCode}</strong>
                    </>
                  )}
                  {open && (
                    <Link href={`/done?o=${encodeURIComponent(ref)}`} className={s.track}>
                      Track
                    </Link>
                  )}
                </div>
                <div className={s.items}>
                  {o.lines.map((l) => (l.qty > 1 ? `${l.qty}× ` : "") + l.name).join(", ")}
                </div>
                <div className={s.cardFoot}>
                  <span className={s.cardTotal}>{money(o.total)}</span>
                  <button
                    type="button"
                    className={s.reorder}
                    disabled={reorderable.length === 0}
                    onClick={() => {
                      setBag(
                        reorderable.map((l) => ({
                          key: bagKey(l.dishId, l.exclusions, l.note),
                          id: l.dishId,
                          qty: l.qty,
                          excl: l.exclusions,
                          note: l.note,
                        })),
                      );
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
            );
          })
        )}
        <div className={s.tail} />
      </ScreenBody>
    </AppShell>
  );
}
