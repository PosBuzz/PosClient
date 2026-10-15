import { expect, it } from "vitest";
import { getProductVariantSearchLabel } from "./product-search.utils";
it("[CO-SRCH-001] search labels preserve product/variant/code/SKU/barcode order", () => {
  expect(
    getProductVariantSearchLabel({
      product_name: "Product",
      name: "Variant",
      product_code: "P1",
      sku: "SKU1",
      barcode: "BAR1",
    }),
  ).toBe("Product - Variant - P1 - SKU1 - BAR1");
  expect(
    getProductVariantSearchLabel({
      product_name: null,
      name: "Variant",
      sku: "",
      barcode: undefined,
    }),
  ).toBe("Variant");
  expect(getProductVariantSearchLabel({})).toBe("");
});
