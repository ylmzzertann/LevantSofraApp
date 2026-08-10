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
import { useStore, type Address } from "@/state/store";
import s from "./Checkout.module.css";

const FIELDS: { key: keyof Address; label: string; placeholder: string }[] = [
  { key: "street", label: "Street", placeholder: "Street and door" },
  { key: "city", label: "District", placeholder: "District, city" },
  { key: "phone", label: "Phone", placeholder: "+90" },
  { key: "note", label: "Note for the courier", placeholder: "Blue door, ring twice" },
];

/** M5 — online mode only. */
export function AddressScreen() {
  const router = useRouter();
  const { state, setAddr, set } = useStore();

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow title="Where to" backTo="/bag" tight />
        <Progress filled={1} />
      </ScreenHeader>

      <ScreenBody>
        <PhotoSlot label="Map" height={132} radius="5px" />

        {FIELDS.map((f) => (
          <div key={f.key} className={s.field}>
            <label className="ls-label" htmlFor={`addr-${f.key}`}>
              {f.label}
            </label>
            <input
              id={`addr-${f.key}`}
              className="ls-input"
              value={state.addr[f.key]}
              placeholder={f.placeholder}
              inputMode={f.key === "phone" ? "tel" : "text"}
              onChange={(e) => setAddr({ [f.key]: e.target.value })}
            />
          </div>
        ))}

        <div className={s.block} style={{ marginTop: 26 }}>
          <div className="ls-label">When</div>
          <div className={s.pills}>
            <button
              type="button"
              className="ls-pill"
              data-on={state.when === "asap"}
              onClick={() => set("when", "asap")}
            >
              As soon as possible
            </button>
            <button
              type="button"
              className="ls-pill"
              data-on={state.when === "later"}
              onClick={() => set("when", "later")}
            >
              Tonight, 20:30
            </button>
          </div>
        </div>
        <div className={s.tail} />
      </ScreenBody>

      <ScreenFooter>
        <div className={s.footer}>
          <button type="button" className="ls-action" onClick={() => router.push("/pay")}>
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
