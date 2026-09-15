"use client";

import { useState, useTransition } from "react";
import { addTableAction, retireTableAction } from "@/server/admin-actions";
import type { TableRow } from "@/server/tables";
import { useFormAction } from "../useFormAction";
import s from "../admin.module.css";

export function PrintButton() {
  return (
    <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => window.print()}>
      Print stickers
    </button>
  );
}

export function TableAdmin({ tables }: { tables: TableRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = useFormAction(addTableAction, (form) => form.reset());
  const active = tables.filter((t) => t.active);

  return (
    <div className={s.card}>
      <h2 className={s.sectionTitle}>Tables in service</h2>

      <form onSubmit={add.onSubmit} className={s.form} style={{ marginBottom: 14 }}>
        <div className={s.field}>
          <label className="ls-label" htmlFor="table-id">
            Add a table
          </label>
          <input id="table-id" name="tableId" className={s.input} placeholder="21" required />
        </div>
        {add.error && <div className={s.error}>{add.error}</div>}
        <div className={s.formFooter}>
          <button type="submit" className={s.btn} disabled={add.pending}>
            {add.pending ? "Adding…" : "Add table"}
          </button>
        </div>
      </form>

      {error && <div className={s.warning}>{error}</div>}

      <div className={s.suggestions}>
        {active.map((t) => (
          <button
            key={t.id}
            type="button"
            className={s.btn}
            disabled={pending}
            title="Take this table out of service"
            onClick={() => {
              if (!confirm(`Take ${t.label} out of service? Its sticker stops working.`)) return;
              start(async () => setError(await retireTableAction(t.id)));
            }}
          >
            {t.label} ✕
          </button>
        ))}
      </div>
    </div>
  );
}
