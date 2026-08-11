"use client";

import Link from "next/link";
import { PlateGlyph } from "@/components/brand/Logo";
import { Plus } from "@/components/icons";
import type { Dish } from "@/data/menu";
import { countOfDish } from "@/lib/bag";
import { money } from "@/lib/money";
import { useStore } from "@/state/store";
import { TagChip } from "./TagChip";
import s from "./Menu.module.css";

export type Variant = "mobile" | "site";

export function DishRow({ dish, variant }: { dish: Dish; variant: Variant }) {
  const { state, add } = useStore();
  const inBag = countOfDish(state.bag, dish.id);
  /* The site row always shows the outlined +; the count badge is a phone
     affordance, where the bag bar is out of sight while you scroll. */
  const showCount = variant === "mobile" && inBag > 0;

  return (
    <div className={s.row} data-variant={variant} data-available={dish.available}>
      <Link
        href={dish.available ? `/item/${dish.id}` : "#"}
        className={s.rowMain}
        aria-disabled={!dish.available}
        onClick={(e) => {
          if (!dish.available) e.preventDefault();
        }}
      >
        <div className={s.thumb}>
          {dish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dish.imageUrl} alt="" className={s.thumbImg} />
          ) : (
            <PlateGlyph size={variant === "site" ? 22 : 20} />
          )}
        </div>
        <div className={s.text}>
          <div className={s.baseline}>
            <span className={s.name}>{dish.name}</span>
            {dish.tag && <TagChip tag={dish.tag} />}
            {!dish.available && <span className={s.soldOut}>Sold out</span>}
            <span className={`${s.leader} ls-leader`} />
            <span className={s.price}>{money(dish.price)}</span>
          </div>
          <div className={s.desc}>{dish.desc}</div>
        </div>
      </Link>
      <button
        type="button"
        className={s.qty}
        data-in-bag={showCount}
        disabled={!dish.available}
        aria-label={showCount ? `${dish.name}, ${inBag} in bag. Add another` : `Add ${dish.name}`}
        onClick={() => add(dish.id)}
      >
        {showCount ? inBag : <Plus />}
      </button>
    </div>
  );
}
