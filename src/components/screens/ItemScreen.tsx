"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Heart, Minus, PlusSmall } from "@/components/icons";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { TagChip } from "@/components/menu/TagChip";
import { AppShell, ScreenBody, ScreenFooter, ScreenHeader } from "@/components/shell/AppShell";
import type { Dish } from "@/data/menu";
import { exclusionLine, exclusionValue } from "@/lib/bag";
import { money } from "@/lib/money";
import { useStore } from "@/state/store";
import s from "./Item.module.css";

/**
 * M3. The working state here — quantity, note, exclusions — is local and resets
 * every time the screen opens, which the route gives us for free. Adding pushes
 * a bag line, not a dish id.
 */
export function ItemScreen({ dish }: { dish: Dish }) {
  const router = useRouter();
  const { state, add, toggleFav } = useStore();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [excl, setExcl] = useState<string[]>([]);
  const saved = !!state.favs[dish.id];

  const toggle = (label: string) => {
    const value = exclusionValue(label);
    setExcl((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : prev.concat([value]),
    );
  };

  return (
    <AppShell>
      <ScreenHeader>
        <div className={s.photo}>
          <PhotoSlot src={dish.imageUrl ?? undefined} alt={dish.name} label={dish.name} height="100%" radius="0" />
          <button
            type="button"
            className={`${s.float} ${s.floatLeft}`}
            aria-label="Back"
            onClick={() => router.back()}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className={`${s.float} ${s.floatRight}`}
            aria-label={saved ? "Remove from saved" : "Save this dish"}
            aria-pressed={saved}
            onClick={() => toggleFav(dish.id)}
          >
            <Heart size={16} color="#C04B2D" width={1.4} fill={saved ? "#C04B2D" : "transparent"} />
          </button>
        </div>
      </ScreenHeader>

      <ScreenBody>
        <div className={s.head}>
          <h1 className={s.name}>{dish.name}</h1>
          <div className={s.price}>{money(dish.price)}</div>
        </div>
        <p className={s.long}>{dish.long}</p>
        {dish.tag && (
          <div className={s.tags}>
            <TagChip tag={dish.tag} size="lg" />
          </div>
        )}

        <div className={s.block}>
          <div className={s.blockHead}>
            <div className="ls-label">What&rsquo;s in it</div>
            <div className={s.hint}>Tap to leave out</div>
          </div>
          <div className={s.ingredients}>
            {dish.ingredients.map((g) => {
              const off = excl.includes(exclusionValue(g.label));
              return (
                <button
                  key={g.id}
                  type="button"
                  className={s.ingredient}
                  data-off={off}
                  data-fixed={!g.removable}
                  disabled={!g.removable}
                  aria-pressed={g.removable ? off : undefined}
                  onClick={() => g.removable && toggle(g.label)}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          <div className={s.exclNote} data-active={excl.length > 0}>
            {excl.length
              ? `${exclusionLine(excl)} — the kitchen sees this on the ticket.`
              : "Tap anything you don’t want in it."}
          </div>
        </div>

        <div className={s.block}>
          <label className="ls-label" htmlFor="kitchen-note">
            Note for the kitchen
          </label>
          <input
            id="kitchen-note"
            className="ls-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Extra chilli, no onion…"
          />
        </div>
        <div className={s.tail} />
      </ScreenBody>

      <ScreenFooter>
        <div className={s.footer}>
          <div className={s.stepper}>
            <button
              type="button"
              className={s.stepperBtn}
              aria-label="One fewer"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus />
            </button>
            <span className={s.stepperValue}>{qty}</span>
            <button
              type="button"
              className={s.stepperBtn}
              aria-label="One more"
              onClick={() => setQty((q) => q + 1)}
            >
              <PlusSmall />
            </button>
          </div>
          <button
            type="button"
            className={`ls-action ${s.add}`}
            onClick={() => {
              add(dish.id, qty, excl, note.trim());
              router.push("/");
            }}
          >
            <span>Add {money(dish.price * qty)}</span>
          </button>
        </div>
      </ScreenFooter>
    </AppShell>
  );
}
