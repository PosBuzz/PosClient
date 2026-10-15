import { afterEach, describe, expect, it, vi } from "vitest";
import type { Return } from "../types/return.types";
import {
  buildReturnThermalReceipt,
  printReturnThermalReceipt,
} from "./return-thermal-receipt";

const baseReturn = {
  id: 7,
  return_number: "RET-0007",
  original_sale_id: 3,
  branch_id: 1,
  branch: { id: 1, name: "Main" },
  user: { id: 4, name: "Rina" },
  return_date: "2026-10-16T10:30:00",
  total_refund: "150",
  total_exchange: 40,
  reason: "Damaged",
  notes: null,
  original_sale: { id: 3, sale_number: "S-0003", customer_name: "Karim" },
  items: [
    {
      sale_item_id: 1,
      variant_id: 1,
      quantity: 2,
      unit_price: 75,
      refund_amount: 150,
      variant: { id: 1, name: "Red", product: { id: 1, name: "Shirt" } },
    },
  ],
  exchanges: [
    {
      variant_id: 2,
      quantity: 1,
      unit_price: 40,
      line_total: 40,
      product_name: "Cap",
      variant_name: "Blue",
    },
  ],
  payments: [{ payment_method: "CASH", amount: 110 }],
} as unknown as Return;

describe("return thermal receipt", () => {
  afterEach(() => vi.restoreAllMocks());

  it("[CO-PRINT-010] marks the payload as a return and totals the net refund", () => {
    const data = buildReturnThermalReceipt(baseReturn);
    expect(data.isReturn).toBe(true);
    expect(data.documentType).toBe("RETURN");
    expect(data.orderId).toBe("RET-0007");
    expect(data.total).toBe(110);
    expect(data.openCashDrawer).toBe(false);
    expect(data.paymentStatus).toBe("REFUNDED");
    expect(data.payments).toEqual([{ payment_method: "Cash", amount: 110 }]);
    expect(data.notes).toContain("Original sale: S-0003");
    expect(data.notes).toContain("Reason: Damaged");
  });

  it("[CO-PRINT-011] lists returned items then exchange items", () => {
    const data = buildReturnThermalReceipt(baseReturn);
    expect(data.items.map((i) => [i.name, i.lineTotal])).toEqual([
      ["Shirt - Red", 150],
      ["Exchange: Cap - Blue", 40],
    ]);
  });

  it("[CO-PRINT-012] never goes below zero when the exchange exceeds the refund", () => {
    const data = buildReturnThermalReceipt({
      ...baseReturn,
      total_refund: 20,
    } as Return);
    expect(data.total).toBe(0);
  });

  it("[CO-PRINT-013] posts to the agent and throws the agent's text on failure", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("no printer", { status: 500 }));
    await printReturnThermalReceipt(baseReturn);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8080/print");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).isReturn).toBe(
      true,
    );
    await expect(printReturnThermalReceipt(baseReturn)).rejects.toThrow(
      "no printer",
    );
  });
});
