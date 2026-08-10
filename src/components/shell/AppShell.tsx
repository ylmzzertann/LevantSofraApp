"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, Ref } from "react";
import { ChevronLeft } from "@/components/icons";
import s from "./AppShell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={s.stage}>
      <div className={`${s.shell} ls-screen`}>{children}</div>
    </div>
  );
}

export function ScreenHeader({ children }: { children: ReactNode }) {
  return <div className={s.header}>{children}</div>;
}

export function ScreenBody({
  children,
  padded = true,
  scrollRef,
}: {
  children: ReactNode;
  padded?: boolean;
  scrollRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={scrollRef} className={s.body} style={padded ? { padding: "0 24px" } : undefined}>
      {children}
    </div>
  );
}

export function ScreenFooter({ children }: { children: ReactNode }) {
  return <div className={s.footer}>{children}</div>;
}

export function TitleRow({
  title,
  backTo,
  trailing,
  tight = false,
}: {
  title: string;
  backTo?: string;
  trailing?: ReactNode;
  tight?: boolean;
}) {
  const router = useRouter();
  return (
    <div className={`${s.titleRow} ${tight ? s.tight : ""}`}>
      {backTo !== undefined && (
        <button
          type="button"
          className={s.back}
          aria-label="Back"
          onClick={() => (backTo ? router.push(backTo) : router.back())}
        >
          <ChevronLeft />
        </button>
      )}
      <div className={s.title}>{title}</div>
      {trailing && <div className={s.trailing}>{trailing}</div>}
    </div>
  );
}

/** Checkout progress: 3 segments, `filled` of them lit. */
export function Progress({ filled }: { filled: number }) {
  return (
    <div className={s.progress}>
      {[1, 2, 3].map((n) => (
        <div key={n} className={s.segment} data-on={n <= filled} />
      ))}
    </div>
  );
}
