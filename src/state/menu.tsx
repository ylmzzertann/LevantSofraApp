"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { indexDishes, priceMap, type Category, type Dish } from "@/data/menu";

interface MenuValue {
  categories: Category[];
  dishes: Record<string, Dish>;
  /** Unit prices in cents. */
  prices: Record<string, number>;
  refresh: () => void;
}

const Ctx = createContext<MenuValue | null>(null);

/**
 * The menu, handed down from the server render and kept fresh from there.
 *
 * The poll exists for one reason: a dish runs out mid-service, a server flips
 * it in the admin panel, and every phone already sitting on the menu has to
 * grey that row out without anyone reloading.
 */
export function MenuProvider({
  initial,
  children,
  pollMs = 60_000,
}: {
  initial: Category[];
  children: ReactNode;
  pollMs?: number;
}) {
  const [categories, setCategories] = useState(initial);

  const value = useMemo<MenuValue>(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/menu", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { categories: Category[] };
        if (Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories);
        }
      } catch {
        // Offline or mid-deploy — keep showing the menu we already have.
      }
    };
    return {
      categories,
      dishes: indexDishes(categories),
      prices: priceMap(categories),
      refresh: load,
    };
  }, [categories]);

  useEffect(() => {
    if (pollMs <= 0) return;
    const id = setInterval(value.refresh, pollMs);
    const onFocus = () => value.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [pollMs, value]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMenu(): MenuValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMenu must be used inside <MenuProvider>");
  return ctx;
}
