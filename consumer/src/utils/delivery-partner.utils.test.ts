import { describe, expect, it } from "vitest";
import {
  balanceLabel,
  codFee,
  deliveredNet,
  expectedPayout,
  owedByCustomer,
  partnersCsv,
} from "./delivery-partner.utils";

process.env.TZ = "Asia/Dhaka";

describe("delivery partner helpers", () => {
  it("[CO-DP-001] the balance says who owes whom, ignoring sub-paisa noise", () => {
    expect(balanceLabel(10)).toEqual({
      text: "Partner owes you",
      tone: "success",
    });
    expect(balanceLabel(-0.5)).toEqual({
      text: "You owe partner",
      tone: "danger",
    });
    expect(balanceLabel(0.001)).toEqual({
      text: "All settled",
      tone: "secondary",
    });
    expect(balanceLabel(0)).toEqual({ text: "All settled", tone: "secondary" });
  });

  it("[CO-DP-002] the expected payout is the sum of the chosen orders, in cents", () => {
    expect(expectedPayout([{ net: 0.1 }, { net: 0.2 }])).toBe(0.3);
    expect(expectedPayout([{ net: 435 }, { net: -60 }])).toBe(375);
    expect(expectedPayout([])).toBe(0);
  });

  it("[CO-DP-003] the partner collects what the customer still owes, not counting earlier partner cash", () => {
    expect(
      owedByCustomer({
        total_amount: "500.00",
        payments: [
          { amount: "100.00", payment_method: "CASH" },
          { amount: "400.00", payment_method: "DELIVERY_PARTNER" },
        ],
      }),
    ).toBe(400);
    expect(
      owedByCustomer({
        total_amount: 100,
        payments: [{ amount: 150, payment_method: "CASH" }],
      }),
    ).toBe(0);
    expect(owedByCustomer({})).toBe(0);
  });

  it("[CO-DP-004] the COD fee is a percentage rounded to the paisa, and the delivered net subtracts both charges", () => {
    expect(codFee(500, 1)).toBe(5);
    expect(codFee(333.33, 1.5)).toBe(5);
    expect(codFee(100, 0)).toBe(0);
    expect(
      deliveredNet({ cod_amount: 500, delivery_charge: 60, cod_fee: 5 }),
    ).toBe(435);
    expect(deliveredNet({})).toBe(0);
  });

  it("[CO-DP-005] the CSV quotes every cell, escapes quotes and defuses spreadsheet formulas", () => {
    const csv = partnersCsv([
      {
        id: 1,
        name: '=HYPERLINK("x")',
        phone: null,
        is_active: true,
        balance: -60,
        unsettled_orders: 2,
        unsettled_net: 375.5,
      } as any,
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe(
      '"Partner","Phone","Active","Balance (BDT)","Who owes","Unsettled orders","Unsettled amount (BDT)"',
    );
    expect(row).toBe(
      `"'=HYPERLINK(""x"")","","Yes","-60.00","You owe partner","2","375.50"`,
    );
  });
});
