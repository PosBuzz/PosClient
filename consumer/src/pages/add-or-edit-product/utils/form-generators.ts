import { ProductFormState, ValidationState } from "../types";

// Shared generators/helpers extracted from the form-state hook for easier navigation.

export const createRandomDigits = (length: number) => {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, "0");
};

export const getSkuPrefix = (source: string) => {
  return source
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");
};

export const getSecondVariantName = (
  variants: ProductFormState["variants"],
) => {
  const sortedKeys = Object.keys(variants).sort(
    (a, b) => Number(a) - Number(b),
  );
  const secondKey = sortedKeys[1];
  if (!secondKey) {
    return "";
  }
  return variants[secondKey]?.name?.trim() || "";
};

export const makeBarcode = () => {
  const countryCode = "123";
  const manufacturerCode = createRandomDigits(5);
  const productCode = createRandomDigits(4);
  const baseNumber = `${countryCode}${manufacturerCode}${productCode}`;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(baseNumber[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${baseNumber}${checkDigit}`;
};

export const buildSimpleProductSku = () => `PRO-${createRandomDigits(7)}`;

export const buildVariantSku = (prefixSource: string) => {
  const prefix = getSkuPrefix(prefixSource || "SKU");
  return `${prefix}-SKU-${createRandomDigits(5)}`;
};

export const clearVariantValidationEntries = (
  prev: ValidationState,
  variantKey: string,
  updatedFieldKeys: string[],
): ValidationState => {
  const next = { ...prev };

  updatedFieldKeys.forEach((field) => {
    const directKey = `variant_${variantKey}_${field}`;
    if (next[directKey]) {
      next[directKey] = { status: "", help: "" };
    }

    if (field === "attributes" || field === "serials" || field === "batches") {
      Object.keys(next).forEach((key) => {
        if (
          field === "attributes" &&
          key.startsWith(`variant_${variantKey}_attribute_`)
        ) {
          next[key] = { status: "", help: "" };
        }
        if (
          field === "serials" &&
          key.startsWith(`variant_${variantKey}_serial_`)
        ) {
          next[key] = { status: "", help: "" };
        }
        if (
          field === "batches" &&
          key.startsWith(`variant_${variantKey}_batch_`)
        ) {
          next[key] = { status: "", help: "" };
        }
      });
    }
  });

  return next;
};
