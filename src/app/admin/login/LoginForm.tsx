"use client";

import { useActionState } from "react";
import { signIn } from "@/server/admin-actions";
import s from "../admin.module.css";

export function LoginForm() {
  const [error, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className={s.form}>
      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className={s.input}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.formFooter}>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={pending}>
          {pending ? "Checking…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
