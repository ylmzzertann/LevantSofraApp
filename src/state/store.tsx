"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { addLine, bumpLine, type BagLine } from "@/lib/bag";
import type { PlacedOrder } from "@/lib/api-types";
import { computeTotals, type Mode, type Totals } from "@/lib/totals";
import { useMenu } from "./menu";

export type PayMethod = "card" | "apple" | "google";

export interface State {
  mode: Mode;
  tableId: string;
  tableLabel: string;
  /** The signature from the table's QR sticker — the server needs it to accept the order. */
  tableKey: string;
  bag: BagLine[];
  favs: Record<string, boolean>;
  promo: string;
  /** 0 when no promo is applied. The server is the authority; this is display. */
  promoPercent: number;
  promoMsg: string;
  /** How many ways the table is settling up. Informational — one card still pays. */
  split: number;
  pay: PayMethod;
  card: string;
  exp: string;
  cvc: string;
  cardMsg: string;
  tip: number;
  /* Pickup */
  customerName: string;
  customerPhone: string;
  /** "asap" or an ISO timestamp from the slot list. */
  pickupAt: string;
  pickupMsg: string;
  /** The order the server accepted — the confirmation screen reads this. */
  placed: PlacedOrder | null;
  submitting: boolean;
}

const INITIAL: State = {
  mode: "pickup",
  tableId: "",
  tableLabel: "",
  tableKey: "",
  bag: [],
  favs: {},
  promo: "",
  promoPercent: 0,
  promoMsg: "",
  split: 1,
  pay: "card",
  card: "",
  exp: "",
  cvc: "",
  cardMsg: "",
  tip: 0.1,
  customerName: "",
  customerPhone: "",
  pickupAt: "asap",
  pickupMsg: "",
  placed: null,
  submitting: false,
};

type Action =
  | { type: "hydrate"; value: Partial<State> }
  | { type: "setMode"; mode: Mode; tableId?: string; tableLabel?: string; tableKey?: string }
  | { type: "add"; id: string; qty: number; excl: string[]; note: string }
  | { type: "bump"; key: string; delta: number }
  | { type: "setBag"; bag: BagLine[] }
  | { type: "toggleFav"; id: string }
  | { type: "field"; patch: Partial<State> }
  | { type: "orderPlaced"; order: PlacedOrder }
  | { type: "resetOrder" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return { ...s, ...a.value };
    case "setMode":
      return {
        ...s,
        mode: a.mode,
        tableId: a.mode === "table" ? (a.tableId ?? s.tableId) : "",
        tableLabel: a.mode === "table" ? (a.tableLabel ?? s.tableLabel) : "",
        tableKey: a.mode === "table" ? (a.tableKey ?? s.tableKey) : "",
      };
    case "add":
      return { ...s, bag: addLine(s.bag, a.id, a.qty, a.excl, a.note) };
    case "bump":
      return { ...s, bag: bumpLine(s.bag, a.key, a.delta) };
    case "setBag":
      return { ...s, bag: a.bag };
    case "toggleFav":
      return { ...s, favs: { ...s.favs, [a.id]: !s.favs[a.id] } };
    case "field":
      return { ...s, ...a.patch };
    /* The bag empties the moment the kitchen accepts the order, not when the
       guest taps "Back to the menu" — close the tab on the confirmation screen
       and you must not come back to a bag you already paid for. */
    case "orderPlaced":
      return {
        ...s,
        placed: a.order,
        bag: [],
        promo: "",
        promoPercent: 0,
        promoMsg: "",
        split: 1,
        tip: 0.1,
        card: "",
        exp: "",
        cvc: "",
        cardMsg: "",
        pickupAt: "asap",
        pickupMsg: "",
        submitting: false,
      };
    case "resetOrder":
      return { ...s, placed: null, submitting: false };
    default:
      return s;
  }
}

const STORAGE_KEY = "levant-sofra/v3";

/**
 * Card fields are deliberately never written to storage, and neither is the
 * placed order — a confirmation screen must come from the server's answer, not
 * from something a browser kept lying around.
 *
 * Favourites stay on the device on purpose: a QR guest has no account, so there
 * is no identity to hang a server-side favourites list on.
 */
function persistable(s: State) {
  return {
    mode: s.mode,
    tableId: s.tableId,
    tableLabel: s.tableLabel,
    tableKey: s.tableKey,
    bag: s.bag,
    favs: s.favs,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
  };
}

interface Store {
  state: State;
  totals: Totals;
  hydrated: boolean;
  setMode: (mode: Mode, tableId?: string, tableLabel?: string, tableKey?: string) => void;
  add: (id: string, qty?: number, excl?: string[], note?: string) => void;
  bump: (key: string, delta: number) => void;
  setBag: (bag: BagLine[]) => void;
  toggleFav: (id: string) => void;
  set: <K extends keyof State>(key: K, value: State[K]) => void;
  patch: (value: Partial<State>) => void;
  orderPlaced: (order: PlacedOrder) => void;
  resetOrder: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const { prices } = useMenu();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", value: JSON.parse(raw) as Partial<State> });
    } catch {
      // A corrupt or unavailable store just means we start fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(state)));
    } catch {
      // Private mode / quota — the session works, it just won't survive a reload.
    }
  }, [state, hydrated]);

  /* A dish removed from the menu must not sit in the bag pricing at zero. */
  useEffect(() => {
    if (!hydrated || state.bag.length === 0) return;
    if (state.bag.some((l) => prices[l.id] === undefined)) {
      dispatch({ type: "setBag", bag: state.bag.filter((l) => prices[l.id] !== undefined) });
    }
  }, [hydrated, state.bag, prices]);

  const totals = useMemo(
    () =>
      computeTotals({
        prices,
        bag: state.bag,
        mode: state.mode,
        percentOff: state.promoPercent,
        tip: state.tip,
        split: state.split,
      }),
    [prices, state.bag, state.mode, state.promoPercent, state.tip, state.split],
  );

  /* Stable identities — components put these in effect dependency lists. */
  const actions = useMemo(
    () => ({
      setMode: (mode: Mode, tableId?: string, tableLabel?: string, tableKey?: string) =>
        dispatch({ type: "setMode", mode, tableId, tableLabel, tableKey }),
      add: (id: string, qty = 1, excl: string[] = [], note = "") =>
        dispatch({ type: "add", id, qty, excl, note }),
      bump: (key: string, delta: number) => dispatch({ type: "bump", key, delta }),
      setBag: (bag: BagLine[]) => dispatch({ type: "setBag", bag }),
      toggleFav: (id: string) => dispatch({ type: "toggleFav", id }),
      set: <K extends keyof State>(key: K, value: State[K]) =>
        dispatch({ type: "field", patch: { [key]: value } as Partial<State> }),
      patch: (value: Partial<State>) => dispatch({ type: "field", patch: value }),
      orderPlaced: (order: PlacedOrder) => dispatch({ type: "orderPlaced", order }),
      resetOrder: () => dispatch({ type: "resetOrder" }),
    }),
    [],
  );

  const value = useMemo<Store>(
    () => ({ state, totals, hydrated, ...actions }),
    [state, totals, hydrated, actions],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
