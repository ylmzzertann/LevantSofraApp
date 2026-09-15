"use client";

import { useState, useTransition } from "react";
import { PlateGlyph } from "@/components/brand/Logo";
import type { Dish } from "@/data/menu";
import { money } from "@/lib/money";
import {
  deleteCategory,
  deleteDish,
  moveCategory,
  moveDish,
  setCategoryActive,
  toggleAvailability,
} from "@/server/admin-actions";
import type { AdminCategory } from "@/server/menu";
import { CategoryEditor } from "./CategoryEditor";
import { DishEditor } from "./DishEditor";
import s from "../admin.module.css";

export function DishList({ categories, owner }: { categories: AdminCategory[]; owner: boolean }) {
  const [editingDish, setEditingDish] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const options = categories.map((c) => ({ key: c.key, label: c.label }));

  return (
    <>
      {error && <div className={s.warning}>{error}</div>}

      {categories.map((c, index) => (
        <div key={c.key} className={s.card} data-hidden={!c.active}>
          {editingSection === c.key ? (
            <CategoryEditor category={c} onDone={() => setEditingSection(null)} />
          ) : (
            <div className={s.sectionHead}>
              <h2 className={s.sectionTitle}>{c.label}</h2>
              {!c.active && <span className={s.sectionHidden}>Hidden from guests</span>}
              {owner && (
                <div className={s.actions} style={{ marginLeft: "auto" }}>
                  <span className={s.moveBtns}>
                    <button
                      type="button"
                      className={s.iconBtn}
                      aria-label={`Move ${c.label} up`}
                      disabled={pending || index === 0}
                      onClick={() => start(() => moveCategory(c.key, "up"))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={s.iconBtn}
                      aria-label={`Move ${c.label} down`}
                      disabled={pending || index === categories.length - 1}
                      onClick={() => start(() => moveCategory(c.key, "down"))}
                    >
                      ↓
                    </button>
                  </span>
                  <button type="button" className={s.btn} onClick={() => setEditingSection(c.key)}>
                    Rename
                  </button>
                  <button
                    type="button"
                    className={s.btn}
                    disabled={pending}
                    onClick={() => start(() => setCategoryActive(c.key, !c.active))}
                  >
                    {c.active ? "Hide" : "Show"}
                  </button>
                  {c.items.length === 0 && (
                    <button
                      type="button"
                      className={`${s.btn} ${s.btnDanger}`}
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Delete the ${c.label} section?`)) return;
                        start(async () => setError(await deleteCategory(c.key)));
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {c.items.length === 0 && <p className={s.sub}>Nothing in this section yet.</p>}

          {c.items.map((dish, i) =>
            editingDish === dish.id ? (
              <div key={dish.id} style={{ padding: "10px 0" }}>
                <DishEditor categories={options} dish={dish} onDone={() => setEditingDish(null)} />
              </div>
            ) : (
              <Row
                key={dish.id}
                dish={dish}
                owner={owner}
                first={i === 0}
                last={i === c.items.length - 1}
                onEdit={() => setEditingDish(dish.id)}
              />
            ),
          )}
        </div>
      ))}
    </>
  );
}

function Row({
  dish,
  owner,
  first,
  last,
  onEdit,
}: {
  dish: Dish;
  owner: boolean;
  first: boolean;
  last: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();

  return (
    <div className={s.dishRow} data-available={dish.available}>
      <div className={s.dishThumb}>
        {dish.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dish.imageUrl} alt="" />
        ) : (
          <PlateGlyph size={18} />
        )}
      </div>
      <div className={s.dishMain}>
        <div className={s.dishName}>{dish.name}</div>
        <div className={s.dishMeta}>
          {money(dish.price)} · {dish.desc || "no menu line"}
        </div>
      </div>
      <div className={s.actions}>
        {owner && (
          <span className={s.moveBtns}>
            <button
              type="button"
              className={s.iconBtn}
              aria-label={`Move ${dish.name} up`}
              disabled={pending || first}
              onClick={() => start(() => moveDish(dish.id, "up"))}
            >
              ↑
            </button>
            <button
              type="button"
              className={s.iconBtn}
              aria-label={`Move ${dish.name} down`}
              disabled={pending || last}
              onClick={() => start(() => moveDish(dish.id, "down"))}
            >
              ↓
            </button>
          </span>
        )}
        <button
          type="button"
          className={s.toggle}
          data-available={dish.available}
          disabled={pending}
          onClick={() => start(() => toggleAvailability(dish.id, !dish.available))}
          title={dish.available ? "Mark as sold out" : "Put back on the menu"}
        >
          {dish.available ? "On" : "86'd"}
        </button>
        {owner && (
          <>
            <button type="button" className={s.btn} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnDanger}`}
              disabled={pending}
              onClick={() => {
                // Deleting is for a dish that was never real. To take something
                // off the menu, 86 it — past orders still point at the id.
                if (confirm(`Delete ${dish.name}? Use 86 instead if it's just sold out.`)) {
                  start(() => deleteDish(dish.id));
                }
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
