"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ArrowOut, QrGlyph, Shield } from "@/components/icons";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { CategoryChips, MenuSections } from "@/components/menu/MenuBoard";
import { useSectionNav } from "@/components/menu/useSectionNav";
import { HOURS_LABEL, RESTAURANT } from "@/config/restaurant";
import { bagCount } from "@/lib/bag";
import { itemLabel, money } from "@/lib/money";
import { useMenu } from "@/state/menu";
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
  const { dishes, categories } = useMenu();
  const { state, totals } = useStore();
  const { register, jump } = useSectionNav();
  const count = bagCount(state.bag);
  const firstCategory = categories[0]?.key;

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
          <div className={s.openPill}>{HOURS_LABEL}</div>
          <h1 className={s.headline}>
            One table
            <br />
            from <em>Beirut</em>
            <br />
            to <em>Palermo</em>.
          </h1>
          <p className={s.heroCopy}>
            Charcoal, olive oil and long-cooked pots. Sit down with us, or order ahead and collect
            it at a time that suits you.
          </p>
          <div className={s.heroButtons}>
            <button
              type="button"
              className={s.heroPrimary}
              onClick={() => firstCategory && jump(firstCategory)}
            >
              <span>Order for pickup</span>
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
              state.bag.map((l) =>
                dishes[l.id] ? (
                  <div key={l.key} className={s.panelLine}>
                    <span className={s.panelQty}>{l.qty}×</span>
                    <span className={s.panelName}>{dishes[l.id].name}</span>
                    <span className={s.panelLineTotal}>{money(dishes[l.id].price * l.qty)}</span>
                  </div>
                ) : null,
              )
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
              <span>
                Ready in {RESTAURANT.pickup.leadMinutes} min · collect with a code
              </span>
            </div>
          </div>

          <div className={s.qrBox}>
            <QrGlyph />
            <div>Sitting with us? Scan the QR on your table to order from your seat.</div>
          </div>
        </aside>
      </div>

      <footer className={s.footer}>
        <span>
          {RESTAURANT.address} · {RESTAURANT.phone}
        </span>
        <span>© {new Date().getFullYear()} {RESTAURANT.name}</span>
      </footer>
    </div>
  );
}
