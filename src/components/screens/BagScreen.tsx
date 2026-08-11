"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlateGlyph } from "@/components/brand/Logo";
import { TotalsBlock } from "@/components/checkout/TotalsBlock";
import { ArrowOut, Minus, PlusSmall, Ticket } from "@/components/icons";
import {
  AppShell,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  TitleRow,
} from "@/components/shell/AppShell";
import type { PromoResult } from "@/lib/api-types";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import { totalRows } from "@/lib/totals";
import { useMenu } from "@/state/menu";
import { useStore } from "@/state/store";
import s from "./Checkout.module.css";

const SPLITS = [1, 2, 3, 4];

/** M4 — the bag. Two lines of the same dish with different exclusions stay apart. */
export function BagScreen() {
  const router = useRouter();
  const { dishes } = useMenu();
  const { state, totals, bump, set, patch } = useStore();
  const [checking, setChecking] = useState(false);
  const pickup = state.mode === "pickup";
  const empty = state.bag.length === 0;
  const soldOut = state.bag.filter((l) => dishes[l.id] && !dishes[l.id].available);

  /* The promo is validated by the server — expiry and redemption limits are not
     things a browser gets to decide. */
  const applyPromo = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/promos/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: state.promo }),
      });
      const result = (await res.json()) as PromoResult;
      patch({ promoPercent: result.valid ? result.percentOff : 0, promoMsg: result.message });
    } catch {
      patch({ promoPercent: 0, promoMsg: "Couldn't reach us just now. Try again." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow
          title="Your bag"
          backTo="/"
          trailing={pickup ? "Pickup" : state.tableLabel || "Table"}
        />
      </ScreenHeader>

      <ScreenBody>
        {empty ? (
          <div className={s.empty}>
            <div className={s.emptyTitle}>Nothing on the table yet</div>
            <Link href="/" className={s.emptyLink}>
              Back to the menu
            </Link>
          </div>
        ) : (
          state.bag.map((l) => {
            const dish = dishes[l.id];
            if (!dish) return null;
            return (
              <div key={l.key} className={s.line} data-available={dish.available}>
                <div className={s.thumb}>
                  <PlateGlyph />
                </div>
                <div className={s.lineBody}>
                  <div className={s.lineName}>{dish.name}</div>
                  <div className={s.lineEach}>{money(dish.price)} each</div>
                  {!dish.available && <div className={s.lineExcl}>Just sold out</div>}
                  {l.excl.length > 0 && <div className={s.lineExcl}>{exclusionLine(l.excl)}</div>}
                  {l.note && <div className={s.lineNote}>&ldquo;{l.note}&rdquo;</div>}
                  <div className={s.stepper}>
                    <button
                      type="button"
                      className={s.stepperBtn}
                      aria-label={`One fewer ${dish.name}`}
                      onClick={() => bump(l.key, -1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span className={s.stepperValue}>{l.qty}</span>
                    <button
                      type="button"
                      className={s.stepperBtn}
                      aria-label={`One more ${dish.name}`}
                      onClick={() => bump(l.key, 1)}
                      disabled={!dish.available}
                    >
                      <PlusSmall size={12} />
                    </button>
                  </div>
                </div>
                <div className={s.lineTotal}>{money(dish.price * l.qty)}</div>
              </div>
            );
          })
        )}

        {!empty && (
          <>
            <div className={s.promo}>
              <Ticket />
              <input
                className={s.promoInput}
                value={state.promo}
                onChange={(e) => set("promo", e.target.value)}
                placeholder="Promo code"
                aria-label="Promo code"
              />
              <button
                type="button"
                className={s.promoApply}
                onClick={applyPromo}
                disabled={checking}
              >
                {checking ? "…" : "APPLY"}
              </button>
            </div>
            {state.promoMsg && (
              <div className={s.promoNote} data-ok={state.promoPercent > 0}>
                {state.promoMsg}
              </div>
            )}

            <div className={s.block}>
              <div className="ls-label">Split the bill</div>
              <div className={s.pills}>
                {SPLITS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="ls-pill"
                    data-on={state.split === n}
                    onClick={() => set("split", n)}
                  >
                    {n === 1 ? "No split" : `${n} ways`}
                  </button>
                ))}
              </div>
              {/* One card still pays the whole bill — this is what each person
                  owes so the table can settle up between themselves. */}
              <div className={s.caption}>
                {state.split > 1
                  ? `${money(Math.round(totals.preTip / state.split))} each before tip. One card pays, settle between you.`
                  : "One card pays the whole table."}
              </div>
            </div>

            <TotalsBlock
              rows={totalRows(totals, state.mode, state.promoPercent ? state.promo.trim().toUpperCase() : undefined)}
              grandLabel="Total"
              grandValue={money(totals.preTip)}
            />
            <div className={s.tail} />
          </>
        )}
      </ScreenBody>

      {!empty && (
        <ScreenFooter>
          <div className={s.footer}>
            {soldOut.length > 0 && (
              <div className={s.blockingNote}>
                {soldOut.map((l) => dishes[l.id].name).join(", ")} just sold out — remove it to
                continue.
              </div>
            )}
            <button
              type="button"
              className="ls-action"
              disabled={soldOut.length > 0}
              onClick={() => router.push(pickup ? "/pickup" : "/pay")}
            >
              <span>{pickup ? "Pickup details" : "Send to the kitchen"}</span>
              <div className="ls-chip">
                <ArrowOut size={12} />
              </div>
            </button>
          </div>
        </ScreenFooter>
      )}
    </AppShell>
  );
}
