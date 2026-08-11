"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderStatus, OrderSummary } from "@/lib/api-types";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import s from "../admin.module.css";

const POLL_MS = 4000;

/**
 * The ticket board. It polls rather than holding a socket open: a display on a
 * shelf in a kitchen loses its network, and polling reconnects by itself.
 */
export function KitchenBoard() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { orders: OrderSummary[] };
      setOrders(data.orders ?? []);
    } catch {
      // Keep the last board on screen rather than blanking the pass.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const advance = async (orderNo: string, status: OrderStatus) => {
    setBusy(orderNo);
    try {
      await fetch("/api/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  /* Someone is standing at the counter holding six digits. Typing them should
     narrow the board to their ticket immediately — no round trip. */
  const query = code.replace(/\D/g, "");
  const shown = useMemo(() => {
    if (!orders) return null;
    if (!query) return orders;
    return orders.filter((o) => o.pickupCode?.includes(query));
  }, [orders, query]);

  return (
    <>
      <div className={s.lookup}>
        <label className="ls-label" htmlFor="pickup-lookup">
          Collection code
        </label>
        <input
          id="pickup-lookup"
          className={s.lookupInput}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Type the six digits"
          inputMode="numeric"
          autoComplete="off"
        />
        {query && (
          <button type="button" className={s.btn} onClick={() => setCode("")}>
            Clear
          </button>
        )}
      </div>

      {shown === null ? (
        <p className={s.emptyBoard}>Loading the pass…</p>
      ) : shown.length === 0 ? (
        <p className={s.emptyBoard}>
          {query ? `No open ticket with ${query}.` : "No open tickets. Quiet moment."}
        </p>
      ) : (
        <div className={s.board}>
          {shown.map((o) => (
            <div key={o.orderNo} className={s.ticket} data-status={o.status}>
              <div className={s.ticketTop}>
                <span className={s.ticketNo}>{o.orderNo}</span>
                <span className={s.ticketWhere} data-mode={o.mode}>
                  {o.where}
                </span>
              </div>

              {o.pickupCode && (
                <div className={s.ticketCode}>
                  <span className={s.ticketCodeDigits}>{o.pickupCode}</span>
                  <span className={s.ticketCodeMeta}>
                    {o.customerName ?? "—"}
                    {o.pickupLabel ? ` · ${o.pickupLabel}` : ""}
                  </span>
                </div>
              )}

              <div className={s.ticketTime}>
                {o.date} · {money(o.total)}
              </div>

              <div>
                {o.lines.map((l, i) => (
                  <div key={`${l.dishId}-${i}`} className={s.ticketLine}>
                    <div className={s.ticketDish}>
                      <span>{l.qty}×</span>
                      <span>{l.name}</span>
                    </div>
                    {l.exclusions.length > 0 && (
                      <div className={s.ticketExcl}>{exclusionLine(l.exclusions)}</div>
                    )}
                    {l.note && <div className={s.ticketNote}>&ldquo;{l.note}&rdquo;</div>}
                  </div>
                ))}
              </div>

              <div className={s.ticketActions}>
                {o.status === "placed" && (
                  <button
                    type="button"
                    className={s.btn}
                    disabled={busy === o.orderNo}
                    onClick={() => advance(o.orderNo, "in_kitchen")}
                  >
                    Start
                  </button>
                )}
                {o.status === "in_kitchen" && (
                  <button
                    type="button"
                    className={s.btn}
                    disabled={busy === o.orderNo}
                    onClick={() => advance(o.orderNo, "ready")}
                  >
                    Ready
                  </button>
                )}
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary}`}
                  disabled={busy === o.orderNo}
                  onClick={() => advance(o.orderNo, "completed")}
                >
                  {o.mode === "pickup" ? "Handed over" : "Done"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
