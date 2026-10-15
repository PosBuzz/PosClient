import { describe, expect, it } from "vitest";
import {
  blankIfZero,
  priceFromProfit,
  profitFromPrice,
  round2,
} from "./number";

describe("number helpers", () => {
  it("[CO-NUM-001] round2 keeps at most two decimals and no trailing zeros", () => {
    expect(round2(0.75)).toBe(0.75);
    expect(round2(2)).toBe(2);
    expect(round2(0)).toBe(0);
    expect(round2(12.000000001)).toBe(12);
    expect(round2(10 / 3)).toBe(3.33);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(-0.004) === 0).toBe(true);
    expect(round2(Number.NaN)).toBe(0);
    expect(String(round2(12.5))).toBe("12.5");
  });

  it("[CO-NUM-002] blankIfZero leaves zero and non-numbers empty", () => {
    expect(blankIfZero(0)).toBeUndefined();
    expect(blankIfZero("0")).toBeUndefined();
    expect(blankIfZero(null)).toBeUndefined();
    expect(blankIfZero(undefined)).toBeUndefined();
    expect(blankIfZero("abc")).toBeUndefined();
    expect(blankIfZero(5)).toBe(5);
    expect(blankIfZero("2.5")).toBe(2.5);
  });

  it("[CO-NUM-003] profit and price agree in both directions, within one paisa", () => {
    expect(profitFromPrice(15, 10)).toBe(50);
    expect(priceFromProfit(50, 10)).toBe(15);
    expect(profitFromPrice(10, 0)).toBeUndefined();
    // price -> profit -> price never drifts by a paisa, for every price on a grid
    for (const cost of [0.5, 3, 7.25, 19.99, 120]) {
      for (let cents = 1; cents <= 40000; cents += 37) {
        const price = cents / 100;
        const back = priceFromProfit(profitFromPrice(price, cost)!, cost);
        // profit is shown to 2 decimals, which is worth cost * 0.0001 in price
        expect(Math.abs(back - price)).toBeLessThanOrEqual(
          Math.max(0.01, cost * 0.0001) + 1e-9,
        );
      }
      // profit -> price -> profit stays within the shown precision
      for (let p = -100; p <= 400; p += 0.37) {
        const profit = round2(p);
        const price = priceFromProfit(profit, cost);
        if (price === 0) continue;
        const again = profitFromPrice(price, cost)!;
        expect(Math.abs(again - profit)).toBeLessThanOrEqual(
          (0.005 / cost) * 100 + 0.01 + 1e-9,
        );
      }
    }
  });
});
