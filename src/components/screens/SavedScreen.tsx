"use client";

import Link from "next/link";
import { PlateGlyph } from "@/components/brand/Logo";
import { Plus } from "@/components/icons";
import { AppShell, ScreenBody, ScreenHeader, TitleRow } from "@/components/shell/AppShell";
import { DISHES } from "@/data/menu";
import { money } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./Lists.module.css";

/** M8 — saved plates. */
export function SavedScreen() {
  const { state, add } = useStore();
  const saved = Object.keys(state.favs)
    .filter((id) => state.favs[id] && DISHES[id])
    .map((id) => DISHES[id]);

  return (
    <AppShell>
      <ScreenHeader>
        <TitleRow title="Saved plates" backTo="/" />
      </ScreenHeader>
      <ScreenBody>
        {saved.length === 0 ? (
          <p className={s.empty}>
            Tap the heart on any dish and it waits for you here — at the table or at home.
          </p>
        ) : (
          saved.map((dish) => (
            <div key={dish.id} className={s.row}>
              <div className={s.thumb}>
                <PlateGlyph />
              </div>
              <Link href={`/item/${dish.id}`} className={s.rowMain}>
                <div className={s.name}>{dish.name}</div>
                <div className={s.meta}>
                  {dish.catLabel} · {money(dish.price)}
                </div>
              </Link>
              <button
                type="button"
                className={s.addButton}
                aria-label={`Add ${dish.name}`}
                onClick={() => add(dish.id)}
              >
                <Plus />
              </button>
            </div>
          ))
        )}
        <div className={s.tail} />
      </ScreenBody>
    </AppShell>
  );
}
