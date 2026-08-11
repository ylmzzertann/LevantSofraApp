"use client";

import Link from "next/link";
import { useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import { ArrowOut, Clock, Heart } from "@/components/icons";
import { CategoryChips, MenuSections } from "@/components/menu/MenuBoard";
import { useSectionNav } from "@/components/menu/useSectionNav";
import { AppShell, ScreenBody, ScreenFooter, ScreenHeader } from "@/components/shell/AppShell";
import { bagCount } from "@/lib/bag";
import { money, plateLabel } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./MenuScreen.module.css";

/** M2 — the core screen. One continuous scroll of every category. */
export function MenuScreen() {
  const { state, totals } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const { register, jump } = useSectionNav(scroller);
  const count = bagCount(state.bag);
  const table = state.mode === "table";

  return (
    <AppShell>
      <ScreenHeader>
        <div className={s.header}>
          <div className={s.brand}>
            <Logo size={30} />
            <div className={s.wordmark}>Levant Sofra</div>
          </div>
          <div className={s.mode} data-mode={state.mode}>
            <div className={s.dot} />
            <span className={s.modeText}>{table ? state.tableLabel || "Table" : "Pickup"}</span>
          </div>
        </div>
        <CategoryChips variant="mobile" onJump={jump} />
      </ScreenHeader>

      <ScreenBody scrollRef={scroller}>
        <MenuSections variant="mobile" register={register} />
        <div className={s.tailSpace} />
      </ScreenBody>

      <ScreenFooter>
        <div className={s.footer}>
          <div className={s.footerRow}>
            <div className={s.quickLinks}>
              <Link href="/saved" className={s.quick}>
                <Heart />
                <span className={s.quickLabel}>Saved</span>
              </Link>
              <Link href="/orders" className={s.quick}>
                <Clock />
                <span className={s.quickLabel}>Orders</span>
              </Link>
            </div>
            <Link href="/bag" className={s.bagBar}>
              <div>
                <div className={s.bagCount}>{plateLabel(count)}</div>
                <div className={s.bagTotal}>{money(totals.sub)}</div>
              </div>
              <div className={s.bagChip}>
                <ArrowOut size={13} color="#3B3B3B" width={1.8} />
              </div>
            </Link>
          </div>
        </div>
      </ScreenFooter>
    </AppShell>
  );
}
