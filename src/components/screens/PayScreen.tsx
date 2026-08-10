"use client";

import { useRouter } from "next/navigation";
import { TotalsBlock } from "@/components/checkout/TotalsBlock";
import { AppleMark, Check } from "@/components/icons";
import {
  AppShell,
  Progress,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  TitleRow,
} from "@/components/shell/AppShell";
import { money } from "@/lib/money";
import { payRows } from "@/lib/totals";
import { useStore, type PayMethod } from "@/state/store";
import s from "./Checkout.module.css";

const TIPS = [0, 0.05, 0.1, 0.15];

function orderDate(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${month} · ${time}`;
}

function newOrderNo(): string {
  return "#LS-" + Math.floor(2400 + Math.random() * 900);
}

/** M6 — payment. The tip lands on subtotal minus promo, never on service or delivery. */
export function PayScreen() {
  const router = useRouter();
  const { state, totals, set, placeOrder } = useStore();
  const online = state.mode === "online";
  const isCard = state.pay === "card";

  const choose = (method: PayMethod) => set("pay", method);

  const submit = () => {
    // Wallet methods hand validation to the sheet; a card has to be complete.
    if (isCard && state.card.replace(/\s/g, "").length < 15) {
      set("cardMsg", "Enter a full card number to continue.");
      return;
    }
    placeOrder({
      orderNo: newOrderNo(),
      date: orderDate(new Date()),
      mode: state.mode,
      where: online ? "Delivery" : state.tableLabel || "Table",
      lines: state.bag,
      total: totals.due,
    });
    router.push("/done");
  };

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow title="Payment" backTo={online ? "/address" : "/bag"} tight />
        <Progress filled={online ? 2 : 1} />
      </ScreenHeader>

      <ScreenBody>
        <div className={s.methods}>
          <button
            type="button"
            className={`ls-pill ${s.method}`}
            data-on={state.pay === "apple"}
            onClick={() => choose("apple")}
          >
            <AppleMark />
            <span>Pay</span>
          </button>
          <button
            type="button"
            className={`ls-pill ${s.method}`}
            data-on={state.pay === "google"}
            onClick={() => choose("google")}
          >
            G Pay
          </button>
          <button
            type="button"
            className={`ls-pill ${s.method}`}
            data-on={isCard}
            onClick={() => choose("card")}
          >
            Card
          </button>
        </div>

        {isCard ? (
          <div className={s.cardPanel}>
            <div className={s.cardHead}>
              <label className="ls-label" htmlFor="card-number">
                Card number
              </label>
              <div className={s.brands}>
                <div className={s.brand} style={{ background: "var(--terracotta)" }} />
                <div className={s.brand} style={{ background: "var(--mustard)" }} />
              </div>
            </div>
            <input
              id="card-number"
              className={s.cardNumber}
              value={state.card}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              onChange={(e) => set("card", e.target.value)}
            />
            <div className={s.cardPair}>
              <div>
                <label className="ls-label" htmlFor="card-exp">
                  Expiry
                </label>
                <input
                  id="card-exp"
                  className={s.cardSmall}
                  value={state.exp}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="09 / 29"
                  onChange={(e) => set("exp", e.target.value)}
                />
              </div>
              <div>
                <label className="ls-label" htmlFor="card-cvc">
                  CVC
                </label>
                <input
                  id="card-cvc"
                  className={s.cardSmall}
                  value={state.cvc}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  onChange={(e) => set("cvc", e.target.value)}
                />
              </div>
            </div>
            <div className={s.cardNote} data-error={!!state.cardMsg}>
              {state.cardMsg || "Stored only for this order."}
            </div>
          </div>
        ) : (
          <div className={s.wallet}>
            <div className={s.walletName}>
              {state.pay === "apple" ? "Apple Pay" : "Google Pay"} is ready
            </div>
            <div className={s.walletHint}>Confirm with a double-click on the side button.</div>
          </div>
        )}

        <div className={s.block} style={{ marginTop: 24 }}>
          <div className={s.tipHead}>
            <div className="ls-label">Tip the kitchen</div>
            <div className={s.tipAmount}>{money(totals.tip)}</div>
          </div>
          <div className={s.pills}>
            {TIPS.map((v) => (
              <button
                key={v}
                type="button"
                className="ls-pill"
                data-on={state.tip === v}
                onClick={() => set("tip", v)}
              >
                {v === 0 ? "None" : `${Math.round(v * 100)}%`}
              </button>
            ))}
          </div>
        </div>

        <TotalsBlock
          rows={payRows(totals, state.mode)}
          grandLabel={state.split > 1 ? "Your share" : "Due now"}
          grandValue={money(totals.due)}
        />
        <div className={s.tail} />
      </ScreenBody>

      <ScreenFooter>
        <div className={s.footer}>
          <button type="button" className="ls-action ls-action--ink" onClick={submit}>
            <span>Pay {money(totals.due)}</span>
            <div className="ls-chip ls-chip--mustard">
              <Check />
            </div>
          </button>
        </div>
      </ScreenFooter>
    </AppShell>
  );
}
