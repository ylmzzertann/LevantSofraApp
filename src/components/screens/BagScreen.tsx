"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { DISHES } from "@/data/menu";
import { exclusionLine } from "@/lib/bag";
import { money } from "@/lib/money";
import { totalRows } from "@/lib/totals";
import { useStore } from "@/state/store";
import s from "./Checkout.module.css";

const SPLITS = [1, 2, 3, 4];

/** M4 — the bag. Two lines of the same dish with different exclusions stay apart. */
export function BagScreen() {
  const router = useRouter();
  const { state, totals, bump, set, applyPromo } = useStore();
  const online = state.mode === "online";
  const empty = state.bag.length === 0;

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow
          title="Your bag"
          backTo="/"
          trailing={online ? "Delivery" : state.tableLabel || "Table"}
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
            const dish = DISHES[l.id];
            return (
              <div key={l.key} className={s.line}>
                <div className={s.thumb}>
                  <PlateGlyph />
                </div>
                <div className={s.lineBody}>
                  <div className={s.lineName}>{dish.name}</div>
                  <div className={s.lineEach}>{money(dish.price)} each</div>
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
              <button type="button" className={s.promoApply} onClick={applyPromo}>
                APPLY
              </button>
            </div>
            {state.promoMsg && (
              <div className={s.promoNote} data-ok={state.promoOn}>
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
              <div className={s.caption}>
                {state.split > 1
                  ? `${money(totals.preTip / state.split)} each before tip, charged separately.`
                  : "One card pays the whole table."}
              </div>
            </div>

            <TotalsBlock
              rows={totalRows(totals, state.mode)}
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
            <button
              type="button"
              className="ls-action"
              onClick={() => router.push(online ? "/address" : "/pay")}
            >
              <span>{online ? "Delivery details" : "Send to the kitchen"}</span>
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
