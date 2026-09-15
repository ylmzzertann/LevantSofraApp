"use client";

import { saveCategory } from "@/server/admin-actions";
import { useFormAction } from "../useFormAction";
import s from "../admin.module.css";

/** Creates a section, or renames one when `category` is given. */
export function CategoryEditor({
  category,
  onDone,
}: {
  category?: { key: string; label: string; sub: string };
  onDone?: () => void;
}) {
  const editing = !!category;
  const { error, pending, onSubmit } = useFormAction(saveCategory, (form) => {
    if (editing) onDone?.();
    else form.reset();
  });
  const idBase = category?.key ?? "new-section";

  return (
    <form onSubmit={onSubmit} className={s.form}>
      <input type="hidden" name="mode" value={editing ? "edit" : "create"} />
      {editing && <input type="hidden" name="key" value={category.key} />}

      <div className={s.field}>
        <label className="ls-label" htmlFor={`label-${idBase}`}>
          Section name
        </label>
        <input
          id={`label-${idBase}`}
          name="label"
          className={s.input}
          defaultValue={category?.label}
          placeholder="Brunch"
          required
        />
      </div>

      <div className={s.field}>
        <label className="ls-label" htmlFor={`sub-${idBase}`}>
          Line under it
        </label>
        <input
          id={`sub-${idBase}`}
          name="sub"
          className={s.input}
          defaultValue={category?.sub}
          placeholder="Weekends until 3PM"
        />
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.formFooter}>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={pending}>
          {pending ? "Saving…" : editing ? "Save section" : "Add section"}
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
