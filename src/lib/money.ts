/** `$` + two decimals, trailing `.00` stripped — `$11`, `$24.15`. */
export function money(n: number): string {
  return "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
}

export function plateLabel(count: number): string {
  return count === 1 ? "1 plate" : `${count} plates`;
}

export function itemLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}
