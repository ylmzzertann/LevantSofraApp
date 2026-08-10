"use client";

import { CATEGORIES } from "@/data/menu";
import { DishRow, type Variant } from "./DishRow";
import s from "./Menu.module.css";

export function CategoryChips({
  variant,
  onJump,
}: {
  variant: Variant;
  onJump: (key: string) => void;
}) {
  return (
    <div className={s.chips} data-variant={variant}>
      {CATEGORIES.map((c) => (
        <button key={c.key} type="button" className={s.chip} onClick={() => onJump(c.key)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function MenuSections({
  variant,
  register,
}: {
  variant: Variant;
  register: (key: string) => (el: HTMLElement | null) => void;
}) {
  return (
    <>
      {CATEGORIES.map((c) => (
        <div key={c.key} ref={register(c.key)} className={s.sectionBlock} data-variant={variant}>
          <div className={s.section} data-variant={variant}>
            <div className={`${s.rule} ${s.ruleLead}`} />
            <div className={s.sectionText}>
              <div className={s.sectionName}>{c.label}</div>
              <div className={s.sectionSub}>{c.sub}</div>
            </div>
            <div className={s.rule} />
          </div>
          <div className={s.grid} data-variant={variant}>
            {c.items.map((d) => (
              <DishRow key={d.id} dish={d} variant={variant} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
