"use client";

import { signInAction } from "@/server/admin-actions";
import { useFormAction } from "../useFormAction";
import s from "../admin.module.css";

export function LoginForm() {
  const { error, pending, onSubmit } = useFormAction(signInAction);

  return (
    <form onSubmit={onSubmit} className={s.form}>
      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className={s.input}
          autoComplete="username"
          required
        />
      </div>
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
