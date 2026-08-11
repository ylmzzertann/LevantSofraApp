"use client";

import { useMenu } from "@/state/menu";
import { DishRow, type Variant } from "./DishRow";
import s from "./Menu.module.css";

export function CategoryChips({
  variant,
  onJump,
}: {
  variant: Variant;
  onJump: (key: string) => void;
}) {
  const { categories } = useMenu();
  return (
    <div className={s.chips} data-variant={variant}>
      {categories.map((c) => (
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
  const { categories } = useMenu();
  return (
    <>
      {categories.map((c) => (
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
