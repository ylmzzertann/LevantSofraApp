"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ArrowOut, QrGlyph, Shield } from "@/components/icons";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { CategoryChips, MenuSections } from "@/components/menu/MenuBoard";
import { useSectionNav } from "@/components/menu/useSectionNav";
import { DISHES } from "@/data/menu";
import { bagCount } from "@/lib/bag";
import { itemLabel, money } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./Site.module.css";

const NAV = [
  { label: "Menu", href: "/", active: true },
  { label: "Our story", href: "/", active: false },
  { label: "Reservations", href: "/", active: false },
  { label: "Find us", href: "/", active: false },
];

/** W1–W4. The site is always online/delivery mode. */
export function SitePage() {
  const { state, totals } = useStore();
  const { register, jump } = useSectionNav();
  const count = bagCount(state.bag);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.brand}>
          <Logo size={38} />
          <div>
            <div className={s.wordmark}>Levant Sofra</div>
            <div className={s.eyebrow}>Mezze · Fire · Sea</div>
          </div>
        </div>
        <nav className={s.nav}>
          {NAV.map((n) => (
            <Link key={n.label} href={n.href} className={s.navLink} data-active={n.active}>
              {n.label}
            </Link>
          ))}
          <Link href="/bag" className={s.bagPill}>
            <span>{count} in bag</span>
            <div className={s.bagPillChip}>
              <ArrowOut size={12} width={1.6} />
            </div>
          </Link>
        </nav>
      </header>

      <section className={s.hero}>
        <div>
          <div className={s.openPill}>Open today · 12:00 — 23:30</div>
          <h1 className={s.headline}>
            One table
            <br />
            from <em>Beirut</em>
            <br />
            to <em>Palermo</em>.
          </h1>
          <p className={s.heroCopy}>
            Charcoal, olive oil and long-cooked pots. Sit down with us, or have the same menu sent to
            your door.
          </p>
          <div className={s.heroButtons}>
            <button type="button" className={s.heroPrimary} onClick={() => jump("mezze")}>
              <span>Order online</span>
              <div className={s.heroPrimaryChip}>
                <ArrowOut size={13} />
              </div>
            </button>
            <button type="button" className={s.heroSecondary}>
              Book a table
            </button>
          </div>
        </div>
        <PhotoSlot label="The room" height={390} />
      </section>

      <div className={s.menuGrid}>
        <div>
          <CategoryChips variant="site" onJump={jump} />
          <MenuSections variant="site" register={register} />
        </div>

        <aside className={s.sticky}>
          <div className={s.panel}>
            <div className={s.panelHead}>
              <span className={s.panelTitle}>Your bag</span>
              <span className={s.panelCount}>{itemLabel(count)}</span>
            </div>

            {state.bag.length === 0 ? (
              <p className={s.panelEmpty}>
                Nothing yet. Add a few mezze — they arrive together for the table.
              </p>
            ) : (
              state.bag.map((l) => (
                <div key={l.key} className={s.panelLine}>
                  <span className={s.panelQty}>{l.qty}×</span>
                  <span className={s.panelName}>{DISHES[l.id].name}</span>
                  <span className={s.panelLineTotal}>{money(DISHES[l.id].price * l.qty)}</span>
                </div>
              ))
            )}

            <div className={s.panelSubtotal}>
              <span className={s.panelSubtotalLabel}>Subtotal</span>
              <span className={s.panelSubtotalValue}>{money(totals.sub)}</span>
            </div>

            <Link href="/bag" className={s.checkout}>
              <span>Checkout</span>
              <div className={s.checkoutChip}>
                <ArrowOut size={12} width={1.6} />
              </div>
            </Link>

            <div className={s.reassure}>
              <Shield />
              <span>Delivery in 35–45 min · free over $60</span>
            </div>
          </div>

          <div className={s.qrBox}>
            <QrGlyph />
            <div>Sitting with us? Scan the QR on your table to order from your seat.</div>
          </div>
        </aside>
      </div>

      <footer className={s.footer}>
        <span>Kalamış Cd. 41, Kadıköy · +90 216 000 00 00</span>
        <span>© 2026 Levant Sofra</span>
      </footer>
    </div>
  );
}
