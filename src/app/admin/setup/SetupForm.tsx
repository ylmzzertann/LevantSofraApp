"use client";

import { setupAction } from "@/server/admin-actions";
import { useFormAction } from "../useFormAction";
import s from "../admin.module.css";

export function SetupForm({ needsToken }: { needsToken: boolean }) {
  const { error, pending, onSubmit } = useFormAction(setupAction);

  return (
    <form onSubmit={onSubmit} className={s.form}>
      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor="setup-name">
          Your name
        </label>
        <input id="setup-name" name="name" className={s.input} autoComplete="name" required />
      </div>
      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor="setup-email">
          Email
        </label>
        <input
          id="setup-email"
          name="email"
          type="email"
          className={s.input}
          autoComplete="username"
          required
        />
      </div>
      <div className={`${s.field} ${s.fieldWide}`}>
        <label className="ls-label" htmlFor="setup-password">
          Password
        </label>
        <input
          id="setup-password"
          name="password"
          type="password"
          className={s.input}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className={s.hint}>At least 8 characters.</span>
      </div>
      {needsToken && (
        <div className={`${s.field} ${s.fieldWide}`}>
          <label className="ls-label" htmlFor="setup-token">
            Setup token
          </label>
          <input id="setup-token" name="token" className={s.input} autoComplete="off" required />
          <span className={s.hint}>The SETUP_TOKEN value from the server&rsquo;s environment.</span>
        </div>
      )}
      {error && <div className={s.error}>{error}</div>}
      <div className={s.formFooter}>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={pending}>
          {pending ? "Creating…" : "Create owner account"}
        </button>
      </div>
    </form>
  );
}
