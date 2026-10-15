/**
 * Round to at most 2 decimals and drop trailing zeros: 0.75, 2, 0, 12.5.
 * Used for values the app calculates, so they never show float noise
 * like 12.000000001 or 3.3333333. Rounds to the paisa, the precision the
 * database stores money in; never apply it to a total that is sent as typed.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // Half away from zero, so +x and -x round to mirror-image values
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

/** An empty field instead of a 0 the user never typed. */
export function blankIfZero(
  value: number | string | null | undefined,
): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

/** Profit % of a price over its cost, to 2 decimals. Nothing without a positive cost. */
export function profitFromPrice(
  price: number,
  cost: number,
): number | undefined {
  if (!(cost > 0) || !Number.isFinite(price)) return undefined;
  return round2(((price - cost) / cost) * 100);
}

/** Price that gives a profit % over cost, to the paisa. */
export function priceFromProfit(profit: number, cost: number): number {
  return round2(cost * (1 + profit / 100));
}
