/**
 * Money is integer cents everywhere — database, server, client. Floating-point
 * dollars drift, and a bill that is a cent off is a bill the restaurant argues
 * about. Only this module turns cents into something a guest reads.
 */

/** `$` + two decimals, trailing `.00` stripped — `$11`, `$24.15`. */
export function money(cents: number): string {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? "−" : "";
  return sign + "$" + (Math.abs(rounded) / 100).toFixed(2).replace(/\.00$/, "");
}

export function dollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function toCents(dollarValue: number): number {
  return Math.round(dollarValue * 100);
}

export function plateLabel(count: number): string {
  return count === 1 ? "1 plate" : `${count} plates`;
}

export function itemLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}
