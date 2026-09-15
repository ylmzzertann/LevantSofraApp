"use client";

import { useState, useTransition } from "react";
import {
  createStaffAction,
  resetPasswordAction,
  setStaffActiveAction,
} from "@/server/admin-actions";
import type { StaffListing } from "@/server/staff";
import { useFormAction } from "../useFormAction";
import s from "../admin.module.css";

export function StaffManager({ people, meId }: { people: StaffListing[]; meId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <div className={s.card}>
        <h2 className={s.sectionTitle}>Add someone</h2>
        <CreateForm />
      </div>

      <div className={s.card}>
        <h2 className={s.sectionTitle}>Accounts</h2>
        {error && <div className={s.warning}>{error}</div>}

        {people.map((p) => (
          <div key={p.id}>
            <div className={s.staffRow} data-active={p.active}>
              <div className={s.dishMain}>
                <div className={s.dishName}>
                  {p.name}
                  {p.id === meId && " (you)"}
                </div>
                <div className={s.dishMeta}>
                  {p.email} · {p.role === "owner" ? "Owner" : "Staff"}
                  {!p.active && " · switched off"}
                </div>
              </div>
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.btn}
                  onClick={() => setResetting(resetting === p.id ? null : p.id)}
                >
                  Reset password
                </button>
                {p.id !== meId && (
                  <button
                    type="button"
                    className={`${s.btn} ${p.active ? s.btnDanger : ""}`}
                    disabled={pending}
                    onClick={() => {
                      if (p.active && !confirm(`Switch off ${p.name}? They'll be signed out now.`)) return;
                      start(async () => setError(await setStaffActiveAction(p.id, !p.active)));
                    }}
                  >
                    {p.active ? "Switch off" : "Switch on"}
                  </button>
                )}
              </div>
            </div>
            {resetting === p.id && <ResetForm staffId={p.id} onDone={() => setResetting(null)} />}
          </div>
        ))}
      </div>
    </>
  );
}

function CreateForm() {
  const { error, pending, onSubmit } = useFormAction(createStaffAction, (form) => form.reset());

  return (
    <form onSubmit={onSubmit} className={s.form}>
      <div className={s.field}>
        <label className="ls-label" htmlFor="staff-name">
          Name
        </label>
        <input id="staff-name" name="name" className={s.input} required />
      </div>
      <div className={s.field}>
        <label className="ls-label" htmlFor="staff-email">
          Email
        </label>
        <input id="staff-email" name="email" type="email" className={s.input} autoComplete="off" required />
      </div>
      <div className={s.field}>
        <label className="ls-label" htmlFor="staff-password">
          Temporary password
        </label>
        <input
          id="staff-password"
          name="password"
          type="password"
          className={s.input}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className={s.hint}>At least 8 characters. Hand it over in person.</span>
      </div>
      <div className={s.field}>
        <label className="ls-label" htmlFor="staff-role">
          Role
        </label>
        <select id="staff-role" name="role" className={s.select} defaultValue="staff">
          <option value="staff">Staff — service, floor, kitchen</option>
          <option value="owner">Owner — everything, including menu and accounts</option>
        </select>
      </div>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.formFooter}>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={pending}>
          {pending ? "Adding…" : "Add account"}
        </button>
      </div>
    </form>
  );
}

function ResetForm({ staffId, onDone }: { staffId: string; onDone: () => void }) {
  const { error, pending, onSubmit } = useFormAction(resetPasswordAction, () => onDone());

  return (
    <form onSubmit={onSubmit} className={s.form} style={{ padding: "10px 0 16px" }}>
      <input type="hidden" name="staffId" value={staffId} />
      <div className={s.field}>
        <label className="ls-label" htmlFor={`reset-${staffId}`}>
          New password
        </label>
        <input
          id={`reset-${staffId}`}
          name="password"
          type="password"
          className={s.input}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className={s.hint}>Signs them out of every device.</span>
      </div>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.formFooter}>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={pending}>
          {pending ? "Saving…" : "Set password"}
        </button>
        <button type="button" className={s.btn} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
