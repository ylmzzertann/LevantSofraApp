"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import { ArrowOut, ChevronRight } from "@/components/icons";
import { AppShell } from "@/components/shell/AppShell";
import { RESTAURANT } from "@/config/restaurant";
import { useStore } from "@/state/store";
import s from "./Entry.module.css";

/**
 * M1. Reached by scanning the sticker on a table, so the table number arrives
 * in the URL. Result: mode = 'table' (with the table) or mode = 'online'.
 */
export function EntryScreen({ table }: { table: string }) {
  const router = useRouter();
  const { setMode, hydrated } = useStore();
  const label = `Table ${table}`;

  /* The scan itself is the signal — record it before the guest touches
     anything, but only once the stored session has loaded, or the restore
     would overwrite the table we just detected. */
  useEffect(() => {
    if (hydrated) setMode("table", table, label);
  }, [hydrated, setMode, table, label]);

  return (
    <AppShell>
      <div className={s.screen}>
        <div className={s.logoRow}>
          <Logo size={62} />
        </div>
        <div className={s.wordmark}>{RESTAURANT.name}</div>
        <div className={s.eyebrow}>{RESTAURANT.eyebrow}</div>

        <div className={s.tableCard}>
          <div className={s.stamp}>QR SCANNED</div>
          <div className={s.seatedAt}>You&rsquo;re seated at</div>
          <div className={s.tableNo}>{label}</div>
          <button
            type="button"
            className={s.open}
            onClick={() => {
              setMode("table", table, label);
              router.push("/");
            }}
          >
            <span>Open the menu</span>
            <div className={s.openChip}>
              <ArrowOut size={12} width={1.6} />
            </div>
          </button>
        </div>

        <div className={s.or}>
          <div className={s.orRule} />
          <span className={s.orWord}>or</span>
          <div className={s.orRule} />
        </div>

        <button
          type="button"
          className={s.delivery}
          onClick={() => {
            setMode("pickup");
            router.push("/");
          }}
        >
          <div>
            <div className={s.deliveryTitle}>Order ahead for pickup</div>
            <div className={s.deliverySub}>
              Ready in {RESTAURANT.pickup.leadMinutes} min, or pick a time
            </div>
          </div>
          <ChevronRight />
        </button>
      </div>
    </AppShell>
  );
}
