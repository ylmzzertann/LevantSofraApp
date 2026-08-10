import { DISHES } from "@/data/menu";

export interface BagLine {
  key: string;
  id: string;
  qty: number;
  excl: string[];
  note: string;
}

/**
 * A bag line is identified by dish + exclusions + note, never by dish id alone.
 * "Muhammara" and "Muhammara, no walnut" are two lines that live side by side;
 * the menu row shows their combined count.
 */
export function bagKey(id: string, excl: string[], note: string): string {
  const ex = excl.slice().sort();
  return id + (ex.length ? "|" + ex.join(",") : "") + (note ? "|" + note : "");
}

export function addLine(
  bag: BagLine[],
  id: string,
  qty = 1,
  excl: string[] = [],
  note = "",
): BagLine[] {
  const ex = excl.slice().sort();
  const key = bagKey(id, ex, note);
  const i = bag.findIndex((l) => l.key === key);
  if (i >= 0) {
    const next = bag.slice();
    next[i] = { ...next[i], qty: next[i].qty + qty };
    return next;
  }
  return bag.concat([{ key, id, qty, excl: ex, note }]);
}

/** Quantity changes address the key, never the dish id. */
export function bumpLine(bag: BagLine[], key: string, delta: number): BagLine[] {
  return bag
    .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
    .filter((l) => l.qty > 0);
}

export function removeLine(bag: BagLine[], key: string): BagLine[] {
  return bag.filter((l) => l.key !== key);
}

export function bagCount(bag: BagLine[]): number {
  return bag.reduce((a, l) => a + l.qty, 0);
}

/** Total quantity of a dish across every line, including lines with exclusions. */
export function countOfDish(bag: BagLine[], id: string): number {
  return bag.filter((l) => l.id === id).reduce((a, l) => a + l.qty, 0);
}

export function lineTotal(line: BagLine): number {
  return DISHES[line.id].price * line.qty;
}

/** `No walnut, no onion` — the phrasing the kitchen ticket uses. */
export function exclusionLine(excl: string[]): string {
  return excl.length ? "No " + excl.join(", no ") : "";
}

/**
 * Exclusions travel as the ingredient's own wording, lower-cased so it reads as
 * a sentence on the ticket: "No sumac onion", not "No Sumac onion".
 */
export function exclusionValue(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}
