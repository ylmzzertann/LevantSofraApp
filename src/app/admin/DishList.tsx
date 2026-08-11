"use client";

import { useState, useTransition } from "react";
import { PlateGlyph } from "@/components/brand/Logo";
import type { Category, Dish } from "@/data/menu";
import { money } from "@/lib/money";
import { deleteDish, toggleAvailability } from "@/server/admin-actions";
import { DishEditor } from "./DishEditor";
import s from "./admin.module.css";

export function DishList({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const options = categories.map((c) => ({ key: c.key, label: c.label }));

  return (
    <>
      {categories.map((c) => (
        <div key={c.key} className={s.card}>
          <h2 className={s.sectionTitle}>{c.label}</h2>
          {c.items.length === 0 && <p className={s.sub}>Nothing in this section yet.</p>}
          {c.items.map((dish) =>
            editing === dish.id ? (
              <div key={dish.id} style={{ padding: "10px 0" }}>
                <DishEditor categories={options} dish={dish} onDone={() => setEditing(null)} />
              </div>
            ) : (
              <Row key={dish.id} dish={dish} onEdit={() => setEditing(dish.id)} />
            ),
          )}
        </div>
      ))}
    </>
  );
}

function Row({ dish, onEdit }: { dish: Dish; onEdit: () => void }) {
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
        <button
          type="button"
          className={s.toggle}
          data-available={dish.available}
          disabled={pending}
          onClick={() => start(() => void toggleAvailability(dish.id, !dish.available))}
          title={dish.available ? "Mark as sold out" : "Put back on the menu"}
        >
          {dish.available ? "On" : "86'd"}
        </button>
        <button type="button" className={s.btn} onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.btnDanger}`}
          disabled={pending}
          onClick={() => {
            // Deleting is for a dish that was never real. To take something off
            // the menu, 86 it — past orders still point at the id.
            if (confirm(`Delete ${dish.name}? Use 86 instead if it's just sold out.`)) {
              start(() => void deleteDish(dish.id));
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
