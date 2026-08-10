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
import { addLine, bagKey, bumpLine, type BagLine } from "@/lib/bag";
import { computeTotals, validatePromo, type Mode, type Totals } from "@/lib/totals";

export type PayMethod = "card" | "apple" | "google";
export type WhenChoice = "asap" | "later";

export interface Address {
  street: string;
  city: string;
  phone: string;
  note: string;
}

export interface PastOrder {
  orderNo: string;
  date: string;
  mode: Mode;
  where: string;
  lines: BagLine[];
  total: number;
}

export interface State {
  mode: Mode;
  tableLabel: string;
  bag: BagLine[];
  favs: Record<string, boolean>;
  promo: string;
  promoOn: boolean;
  promoMsg: string;
  split: number;
  pay: PayMethod;
  card: string;
  exp: string;
  cvc: string;
  cardMsg: string;
  tip: number;
  addr: Address;
  when: WhenChoice;
  /** The order just placed — the confirmation screen reads this, not the bag. */
  placed: PastOrder | null;
  orders: PastOrder[];
}

const SEED_ORDERS: PastOrder[] = [
  {
    orderNo: "#LS-2388",
    date: "2 August · 21:10",
    mode: "table",
    where: "Table 6",
    lines: [
      { key: bagKey("muhammara", [], ""), id: "muhammara", qty: 2, excl: [], note: "" },
      { key: bagKey("adana", [], ""), id: "adana", qty: 1, excl: [], note: "" },
      { key: bagKey("octopus", [], ""), id: "octopus", qty: 1, excl: [], note: "" },
      { key: bagKey("turkish", [], ""), id: "turkish", qty: 2, excl: [], note: "" },
    ],
    total: 74.2,
  },
  {
    orderNo: "#LS-2301",
    date: "19 July · 20:05",
    mode: "online",
    where: "Delivery",
    lines: [
      { key: bagKey("tagine", [], ""), id: "tagine", qty: 1, excl: [], note: "" },
      { key: bagKey("fattoush", [], ""), id: "fattoush", qty: 1, excl: [], note: "" },
      { key: bagKey("lavash", [], ""), id: "lavash", qty: 1, excl: [], note: "" },
      { key: bagKey("kunefe", [], ""), id: "kunefe", qty: 1, excl: [], note: "" },
    ],
    total: 52.9,
  },
  {
    orderNo: "#LS-2255",
    date: "3 July · 13:40",
    mode: "online",
    where: "Delivery",
    lines: [
      { key: bagKey("hummus", [], ""), id: "hummus", qty: 1, excl: [], note: "" },
      { key: bagKey("taouk", [], ""), id: "taouk", qty: 1, excl: [], note: "" },
      { key: bagKey("mint", [], ""), id: "mint", qty: 1, excl: [], note: "" },
    ],
    total: 31.5,
  },
];

const INITIAL: State = {
  mode: "online",
  tableLabel: "",
  bag: [],
  favs: {},
  promo: "",
  promoOn: false,
  promoMsg: "",
  split: 1,
  pay: "card",
  card: "",
  exp: "",
  cvc: "",
  cardMsg: "",
  tip: 0.1,
  addr: { street: "", city: "", phone: "", note: "" },
  when: "asap",
  placed: null,
  orders: SEED_ORDERS,
};

type Action =
  | { type: "hydrate"; value: Partial<State> }
  | { type: "setMode"; mode: Mode; tableLabel?: string }
  | { type: "add"; id: string; qty: number; excl: string[]; note: string }
  | { type: "bump"; key: string; delta: number }
  | { type: "setBag"; bag: BagLine[] }
  | { type: "toggleFav"; id: string }
  | { type: "field"; patch: Partial<State> }
  | { type: "applyPromo" }
  | { type: "addr"; patch: Partial<Address> }
  | { type: "placeOrder"; order: PastOrder }
  | { type: "resetOrder" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return { ...s, ...a.value };
    case "setMode":
      return { ...s, mode: a.mode, tableLabel: a.tableLabel ?? (a.mode === "table" ? s.tableLabel : "") };
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
    case "applyPromo": {
      const { valid, message } = validatePromo(s.promo);
      return { ...s, promoOn: valid, promoMsg: message };
    }
    case "addr":
      return { ...s, addr: { ...s.addr, ...a.patch } };
    case "placeOrder":
      return {
        ...s,
        placed: a.order,
        orders: [a.order, ...s.orders],
        cardMsg: "",
        card: "",
        exp: "",
        cvc: "",
      };
    case "resetOrder":
      return {
        ...s,
        bag: [],
        promo: "",
        promoOn: false,
        promoMsg: "",
        split: 1,
        tip: 0.1,
        placed: null,
      };
    default:
      return s;
  }
}

const STORAGE_KEY = "levant-sofra/v1";

/** Card fields are deliberately never written to storage. */
function persistable(s: State) {
  return {
    mode: s.mode,
    tableLabel: s.tableLabel,
    bag: s.bag,
    favs: s.favs,
    addr: s.addr,
    orders: s.orders,
  };
}

interface Store {
  state: State;
  totals: Totals;
  hydrated: boolean;
  setMode: (mode: Mode, tableLabel?: string) => void;
  add: (id: string, qty?: number, excl?: string[], note?: string) => void;
  bump: (key: string, delta: number) => void;
  setBag: (bag: BagLine[]) => void;
  toggleFav: (id: string) => void;
  set: <K extends keyof State>(key: K, value: State[K]) => void;
  applyPromo: () => void;
  setAddr: (patch: Partial<Address>) => void;
  placeOrder: (order: PastOrder) => void;
  resetOrder: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [hydrated, setHydrated] = useState(false);

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
      // Private mode / quota — the session still works, it just won't survive a reload.
    }
  }, [state, hydrated]);

  const totals = useMemo(
    () =>
      computeTotals({
        bag: state.bag,
        mode: state.mode,
        promoOn: state.promoOn,
        tip: state.tip,
        split: state.split,
      }),
    [state.bag, state.mode, state.promoOn, state.tip, state.split],
  );

  /* Every action keeps a stable identity — components put them in effect
     dependency lists, and a changing identity there is an infinite loop. */
  const actions = useMemo(
    () => ({
      setMode: (mode: Mode, tableLabel?: string) => dispatch({ type: "setMode", mode, tableLabel }),
      add: (id: string, qty = 1, excl: string[] = [], note = "") =>
        dispatch({ type: "add", id, qty, excl, note }),
      bump: (key: string, delta: number) => dispatch({ type: "bump", key, delta }),
      setBag: (bag: BagLine[]) => dispatch({ type: "setBag", bag }),
      toggleFav: (id: string) => dispatch({ type: "toggleFav", id }),
      set: <K extends keyof State>(key: K, value: State[K]) =>
        dispatch({ type: "field", patch: { [key]: value } as Partial<State> }),
      applyPromo: () => dispatch({ type: "applyPromo" }),
      setAddr: (patch: Partial<Address>) => dispatch({ type: "addr", patch }),
      placeOrder: (order: PastOrder) => dispatch({ type: "placeOrder", order }),
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
