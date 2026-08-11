"use client";

import { useRouter } from "next/navigation";
import { ArrowOut } from "@/components/icons";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import {
  AppShell,
  Progress,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  TitleRow,
} from "@/components/shell/AppShell";
import { RESTAURANT } from "@/config/restaurant";
import type { PickupSlot } from "@/config/restaurant";
import { useStore } from "@/state/store";
import s from "./Checkout.module.css";

/**
 * M5, rebuilt. The restaurant doesn't deliver — an online order is cooked to a
 * time and collected in person — so this screen asks who is coming and when,
 * instead of asking where to drive.
 *
 * The slots are computed on the server so they follow the restaurant's clock
 * and opening hours rather than whatever time the guest's phone thinks it is.
 */
export function PickupScreen({ slots, asapLabel }: { slots: PickupSlot[]; asapLabel: string }) {
  const router = useRouter();
  const { state, set, patch } = useStore();

  const proceed = () => {
    if (!state.customerName.trim()) {
      set("pickupMsg", "We need a name to call out when it's ready.");
      return;
    }
    set("pickupMsg", "");
    router.push("/pay");
  };

  const choose = (value: string) => patch({ pickupAt: value, pickupMsg: "" });

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow title="Collecting" backTo="/bag" tight />
        <Progress filled={1} />
      </ScreenHeader>

      <ScreenBody>
        <PhotoSlot label="The counter" height={132} radius="5px" />
        <div className={s.pickupAddress}>
          <div className="ls-label">Collect from</div>
          <div className={s.pickupAddressLine}>{RESTAURANT.address}</div>
        </div>

        <div className={s.field}>
          <label className="ls-label" htmlFor="pickup-name">
            Name
          </label>
          <input
            id="pickup-name"
            className="ls-input"
            value={state.customerName}
            placeholder="Who's collecting"
            autoComplete="name"
            onChange={(e) => patch({ customerName: e.target.value, pickupMsg: "" })}
          />
        </div>

        <div className={s.field}>
          <label className="ls-label" htmlFor="pickup-phone">
            Phone
          </label>
          <input
            id="pickup-phone"
            className="ls-input"
            value={state.customerPhone}
            placeholder="+1"
            inputMode="tel"
            autoComplete="tel"
            onChange={(e) => set("customerPhone", e.target.value)}
          />
          <div className={s.hint}>Only so we can call if the kitchen needs you.</div>
        </div>

        <div className={s.block} style={{ marginTop: 26 }}>
          <div className="ls-label">When you&rsquo;ll come</div>

          <button
            type="button"
            className={`ls-pill ${s.asapPill}`}
            data-on={state.pickupAt === "asap"}
            onClick={() => choose("asap")}
          >
            As soon as possible · ready {asapLabel}
          </button>

          {slots.length > 0 ? (
            <div className={s.slots}>
              {slots.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  className={`ls-pill ${s.slot}`}
                  data-on={state.pickupAt === slot.value}
                  onClick={() => choose(slot.value)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          ) : (
            <div className={s.caption}>
              No later slots left today — we&rsquo;ll have this ready as soon as we can.
            </div>
          )}
        </div>

        {state.pickupMsg && <div className={s.blockingNote}>{state.pickupMsg}</div>}
        <div className={s.tail} />
      </ScreenBody>

      <ScreenFooter>
        <div className={s.footer}>
          <button type="button" className="ls-action" onClick={proceed}>
            <span>Continue to payment</span>
            <div className="ls-chip">
              <ArrowOut size={12} />
            </div>
          </button>
        </div>
      </ScreenFooter>
    </AppShell>
  );
}
