import {
  ProductFormState,
  ProductFormValidationOptions,
  ValidationState,
} from "../types";

// Central validation rules for product + variant forms, returning field-keyed errors.

// Safe number conversion for numeric validations.
const asNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pushError = (
  map: ValidationState,
  field: string,
  help: string,
  status: "error" | "warning" = "error",
) => {
  // Keeps a flat error map keyed by UI field path.
  map[field] = { status, help };
};

export const getValidationStatus = (
  field: string,
  validationState: ValidationState,
) => {
  // Helper for components that expect a normalized status/help shape.
  return validationState[field] || { status: "", help: "" };
};

export const validateProductForm = (
  formState: ProductFormState,
  options: ProductFormValidationOptions = {},
): ValidationState => {
  // Main validator executed before save and reused for live UI feedback.
  // Validation map keys follow UI field paths, e.g. variant_0_regular_price.
  const validation: ValidationState = {};
  const variantEntries = Object.entries(formState.variants);

  if (!formState.name.trim()) {
    pushError(validation, "name", "Product name is required");
  }

  if (formState.tax < 0 || formState.tax > 100) {
    pushError(validation, "tax", "Tax rate must be between 0 and 100");
  }

  if (variantEntries.length === 0) {
    pushError(validation, "variants", "At least one variant is required");
    return validation;
  }

  if (!formState.has_variants && variantEntries.length > 1) {
    pushError(
      validation,
      "has_variants",
      "Simple product can only have one variant",
    );
  }

  if (formState.original_has_variants && !formState.has_variants) {
    pushError(
      validation,
      "has_variants",
      "Variant product cannot be converted back to simple product.",
    );
  }

  const seenSku = new Set<string>();
  const seenBarcode = new Set<string>();

  variantEntries.forEach(([variantId, variant]) => {
    if (!variant.name.trim()) {
      pushError(validation, `variant_${variantId}_name`, "Name is required");
    }

    if (asNumber(variant.regular_price) <= 0) {
      pushError(
        validation,
        `variant_${variantId}_regular_price`,
        "Regular price is required",
      );
    }

    if (!variant.sale_unit_id) {
      pushError(
        validation,
        `variant_${variantId}_sale_unit_id`,
        "Sale unit is required",
      );
    }

    if (!variant.purchase_unit_id) {
      pushError(
        validation,
        `variant_${variantId}_purchase_unit_id`,
        "Purchase unit is required",
      );
    }

    if (
      variant.wholesale_price !== null &&
      variant.wholesale_price !== undefined &&
      variant.wholesale_price !== ""
    ) {
      const wholesale = asNumber(variant.wholesale_price);
      if (wholesale < 0) {
        pushError(
          validation,
          `variant_${variantId}_wholesale_price`,
          "Wholesale price cannot be negative",
        );
      }
    }

    if (variant.sku.trim()) {
      // SKU uniqueness is case-insensitive.
      const sku = variant.sku.trim().toUpperCase();
      if (seenSku.has(sku)) {
        pushError(validation, `variant_${variantId}_sku`, "SKU must be unique");
      } else {
        seenSku.add(sku);
      }
    }

    if (variant.barcode.trim()) {
      // Barcode uniqueness is exact match.
      const barcode = variant.barcode.trim();
      if (seenBarcode.has(barcode)) {
        pushError(
          validation,
          `variant_${variantId}_barcode`,
          "Barcode must be unique",
        );
      } else {
        seenBarcode.add(barcode);
      }
    }

    const seenSerials = new Set<string>();
    variant.serials.forEach((serial, serialIndex) => {
      const serialNumber = serial.serial_number?.trim();
      if (!serialNumber) {
        pushError(
          validation,
          `variant_${variantId}_serial_${serialIndex}_serial_number`,
          "Serial number cannot be empty",
        );
      }
      if (serialNumber) {
        if (seenSerials.has(serialNumber.toUpperCase())) {
          pushError(
            validation,
            `variant_${variantId}_serial_${serialIndex}_serial_number`,
            "Serial number must be unique",
          );
        } else {
          seenSerials.add(serialNumber.toUpperCase());
        }
      }
    });

    variant.attributes.forEach((attribute, attributeIndex) => {
      if (!attribute.name?.trim()) {
        pushError(
          validation,
          `variant_${variantId}_attribute_${attributeIndex}_name`,
          "Attribute name is required",
        );
      }
      if (!attribute.value?.trim()) {
        pushError(
          validation,
          `variant_${variantId}_attribute_${attributeIndex}_value`,
          "Attribute value is required",
        );
      }
    });

    // Skip batch validation in edit mode where initial inventory batches are hidden.
    if (!options.skipBatchValidation) {
      variant.batches.forEach((batch, batchIndex) => {
        if (!batch.branch_id) {
          pushError(
            validation,
            `variant_${variantId}_batch_${batchIndex}_branch_id`,
            "Batch branch is required",
          );
        }
        if (!batch.batch_number?.trim()) {
          pushError(
            validation,
            `variant_${variantId}_batch_${batchIndex}_batch_number`,
            "Batch reference is required",
          );
        }
        if (!batch.quantity || batch.quantity < 1) {
          pushError(
            validation,
            `variant_${variantId}_batch_${batchIndex}_quantity`,
            "Batch quantity is required",
          );
        }
        if (asNumber(batch.cost_price) < 0) {
          pushError(
            validation,
            `variant_${variantId}_batch_${batchIndex}_cost_price`,
            "Batch cost cannot be negative",
          );
        }
      });
    }
  });

  return validation;
};

export const hasValidationErrors = (validationState: ValidationState) => {
  // True when at least one field remains in error state.
  return Object.values(validationState).some(
    (entry) => entry.status === "error",
  );
};
