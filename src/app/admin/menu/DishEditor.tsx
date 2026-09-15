"use client";

import { useRef } from "react";
import type { Dish } from "@/data/menu";
import { saveDish } from "@/server/admin-actions";
import { useFormAction } from "../useFormAction";
import s from "../admin.module.css";

interface CategoryOption {
  key: string;
  label: string;
}

/** Turns an existing dish's ingredients back into the `*fixed, removable` line. */
function ingredientLine(dish?: Dish): string {
  if (!dish) return "";
  return dish.ingredients.map((g) => (g.removable ? g.label : `*${g.label}`)).join(", ");
}

/** Suggests a URL-safe id from the dish name, the way the seed file ids look. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function DishEditor({
  categories,
  dish,
  onDone,
}: {
  categories: CategoryOption[];
  dish?: Dish;
  onDone?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const editing = !!dish;

  /* A new dish clears the form for the next one; an edit closes the editor so
     the list shows the saved values rather than a form reset to stale ones. */
  const { error, pending, onSubmit } = useFormAction(saveDish, (el) => {
    if (editing) onDone?.();
    else {
      el.reset();
      const idField = el.elements.namedItem("id") as HTMLInputElement | null;
      if (idField) delete idField.dataset.touched;
    }
  });

  return (
    <form onSubmit={onSubmit} ref={form} className={s.form}>
      <input type="hidden" name="mode" value={editing ? "edit" : "create"} />
      <div className={s.field}>
        <label className="ls-label" htmlFor={`name-${dish?.id ?? "new"}`}>
          Name
        </label>
        <input
          id={`name-${dish?.id ?? "new"}`}
          name="name"
          className={s.input}
          defaultValue={dish?.name}
          required
          onChange={(e) => {
            if (editing || !form.current) return;
            const idField = form.current.elements.namedItem("id") as HTMLInputElement | null;
            if (idField && !idField.dataset.touched) idField.value = slugify(e.target.value);
          }}
        />
      </div>

      <div className={s.field}>
        <label className="ls-label" htmlFor={`id-${dish?.id ?? "new"}`}>
          Id
        </label>
        <input
          id={`id-${dish?.id ?? "new"}`}
          name="id"
          className={s.input}
          defaultValue={dish?.id}
          readOnly={editing}
          required
          onInput={(e) => (e.currentTarget.dataset.touched = "1")}
        />
        <span className={s.hint}>
          {editing ? "Ids never change — orders point at them." : "Used in the dish's URL."}
        </span>
      </div>

      <div className={s.field}>
        <label className="ls-label" htmlFor={`price-${dish?.id ?? "new"}`}>
          Price
        </label>
        <input
          id={`price-${dish?.id ?? "new"}`}
          name="price"
          className={s.input}
          type="number"
          step="0.01"
          min="0"
          defaultValue={dish ? (dish.price / 100).toFixed(2) : ""}
          required
        />
        <span className={s.hint}>In dollars, before tax.</span>
      </div>

      <div className={s.field}>
        <label className="ls-label" htmlFor={`cat-${dish?.id ?? "new"}`}>
          Category
        </label>
        <select
          id={`cat-${dish?.id ?? "new"}`}
          name="categoryKey"
          className={s.select}
          defaultValue={dish?.cat ?? categories[0]?.key}
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className={s.field}>
        <label className="ls-label" htmlFor={`tag-${dish?.id ?? "new"}`}>
          Tag
        </label>
        <select
          id={`tag-${dish?.id ?? "new"}`}
          name="tag"
          className={s.select}
          defaultValue={dish?.tag ?? ""}
        >
          <option value="">None</option>
          <option value="veg">VEG</option>
          <option value="hot">HOT</option>
          <option value="pick">CHEF&rsquo;S PICK</option>
        </select>
      </div>

      <div className={s.field}>
        <label className="ls-label" htmlFor={`img-${dish?.id ?? "new"}`}>
          Photo
        </label>
        <input
          id={`img-${dish?.id ?? "new"}`}
          name="image"
          type="file"
          accept="image/*"
          className={s.input}
        />
        <span className={s.hint}>Square crop. Leave empty to keep the current one.</span>
      </div>

      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor={`desc-${dish?.id ?? "new"}`}>
          Menu line
        </label>
        <input
          id={`desc-${dish?.id ?? "new"}`}
          name="desc"
          className={s.input}
          defaultValue={dish?.desc}
        />
        <span className={s.hint}>The one line under the dish name on the menu.</span>
      </div>

      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor={`long-${dish?.id ?? "new"}`}>
          Full description
        </label>
        <textarea
          id={`long-${dish?.id ?? "new"}`}
          name="long"
          className={s.textarea}
          defaultValue={dish?.long}
        />
      </div>

      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor={`ing-${dish?.id ?? "new"}`}>
          Ingredients
        </label>
        <input
          id={`ing-${dish?.id ?? "new"}`}
          name="ingredients"
          className={s.input}
          defaultValue={ingredientLine(dish)}
        />
        <span className={s.hint}>
          Comma separated. Put <code>*</code> in front of anything the kitchen cannot leave out —
          <code>*Hand-minced lamb, Sumac onion, Parsley</code>. Guests can tap the rest off, and it
          prints on the ticket.
        </span>
      </div>

      <label className={`${s.checkRow} ${s.fieldWide}`}>
        <input type="checkbox" name="available" defaultChecked={dish?.available ?? true} />
        On the menu right now
      </label>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.formFooter}>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add dish"}
        </button>
        {onDone && (
          <button type="button" className={s.btn} onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
