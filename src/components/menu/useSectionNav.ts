"use client";

import { useCallback, useRef, type RefObject } from "react";

/**
 * Category chips scroll the menu to a section — they never filter it. The menu
 * is one continuous scroll of every category on purpose: a printed-menu reading
 * experience.
 *
 * On the phone the scroller is the screen's body band; on the site it's the
 * window, offset by the sticky header.
 */
export function useSectionNav(container?: RefObject<HTMLDivElement | null>) {
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const register = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      refs.current[key] = el;
    },
    [],
  );

  const jump = useCallback(
    (key: string) => {
      const el = refs.current[key];
      if (!el) return;
      const scroller = container?.current;
      if (scroller) {
        scroller.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
      } else {
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - 90,
          behavior: "smooth",
        });
      }
    },
    [container],
  );

  return { register, jump };
}
