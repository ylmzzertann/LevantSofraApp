"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import s from "@/components/system/SystemScreens.module.css";

/**
 * Anything that throws while rendering a page lands here instead of on a blank
 * white screen. The bag lives on the phone, so nothing a guest chose is lost.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <Logo size={48} />
        <h1 className={s.title}>Something went wrong on our side</h1>
        <p className={s.body}>
          Your bag is still saved on this phone. Try again — and if it keeps happening, one of us
          can take your order.
        </p>
        <div className={s.actions}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className={s.btn}>
            Back to the menu
          </Link>
        </div>
        {error.digest && <div className={s.digest}>Reference {error.digest}</div>}
      </div>
    </div>
  );
}
