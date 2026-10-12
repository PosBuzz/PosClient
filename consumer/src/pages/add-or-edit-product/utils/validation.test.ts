import { describe, expect, it } from "vitest";
import type { ProductFormState } from "../types";
import { validateProductForm } from "./validation";

const form = (tax: number) =>
  ({
    name: "Tea",
    code: "TEA1",
    description: "",
    tag_ids: [],
    has_variants: false,
    tax_method: "EXCLUSIVE",
    tax,
    original_has_variants: false,
    variants: {},
    deletedVariantIds: [],
  }) as unknown as ProductFormState;

describe("product tax validation", () => {
  it.each([0, 5, 15, 100])(
    "[CO-PROD-001] whole-number tax %s is accepted",
    (tax) => expect(validateProductForm(form(tax)).tax).toBeUndefined(),
  );
  it.each([7.5, 0.1, -1, 101])(
    "[CO-PROD-002] tax %s is rejected (Product.tax is an integer column)",
    (tax) =>
      expect(validateProductForm(form(tax)).tax).toMatchObject({
        status: "error",
        help: "Tax rate must be a whole number between 0 and 100",
      }),
  );
});
