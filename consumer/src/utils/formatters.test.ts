import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  discountPercentSuffix,
  formatDate,
} from "./formatters";
describe("display formatters", () => {
  it("[CO-FMT-005] formats Decimal strings from API responses", () => {
    expect(formatCurrency("1234.50")).toBe("BDT 1234.50");
    expect(formatCurrency("0")).toBe("BDT 0.00");
  });
  it.each([
    [null, "N/A"],
    [undefined, "N/A"],
    [0, "BDT 0.00"],
    [1234.5, "BDT 1234.50"],
    [-5, "BDT -5.00"],
  ])("[CO-FMT-001] currency %s -> %s", (value, expected) =>
    expect(formatCurrency(value as number)).toBe(expected),
  );
  it("[CO-FMT-002] no meaningful base/discount yields no suffix", () => {
    for (const value of [null, undefined, 0, -1, NaN]) {
      expect(discountPercentSuffix(value, 100)).toBe("");
      expect(discountPercentSuffix(10, value)).toBe("");
    }
    expect(discountPercentSuffix(0.001, 100)).toBe("");
  });
  it("[CO-FMT-003] percentages round to two decimal places", () => {
    expect(discountPercentSuffix(10, 100)).toBe(" (10%)");
    expect(discountPercentSuffix(1, 3)).toBe(" (33.33%)");
  });
  it("[CO-FMT-004] fixed UTC date accepts string and Date", () => {
    const date = "2026-03-14T10:00:00Z";
    expect(formatDate(date)).toBe("Mar 14, 2026");
    expect(formatDate(new Date(date))).toBe("Mar 14, 2026");
  });
});
