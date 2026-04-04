import { ProductFormData } from "../../../types/product.types";
import { ProductFormState, ProductPayloadVariant } from "../types";

// Dedicated payload mappers to keep add/update API shapes separated.

const toDecimalString = (
  value: number | string | null | undefined,
  fallback = "0.00",
): string => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed.toFixed(2);
};

const mapVariantsForPayload = (
  formState: ProductFormState,
  includeBatches: boolean,
): ProductPayloadVariant[] => {
  return Object.values(formState.variants).map((variant) => ({
    ...(variant.id ? { id: variant.id } : {}),
    name: variant.name.trim(),
    sku: variant.sku.trim() || undefined,
    barcode: variant.barcode.trim() || undefined,
    regular_price: toDecimalString(variant.regular_price),
    wholesale_price:
      variant.wholesale_price !== null &&
      variant.wholesale_price !== undefined &&
      variant.wholesale_price !== ""
        ? toDecimalString(variant.wholesale_price)
        : undefined,
    sale_unit_id: variant.sale_unit_id,
    purchase_unit_id: variant.purchase_unit_id,
    warranty_period: variant.warranty_period,
    image: variant.image || null,
    is_default: Boolean(variant.is_default),
    alert_quantity: Number(variant.alert_quantity || 0),
    daily_sale_objective: Number(variant.daily_sale_objective || 0),
    attributes: variant.attributes,
    serials: variant.serials,
    ...(includeBatches && {
      batches: variant.batches
        .filter((batch) => batch.branch_id)
        .map((batch) => ({
          branch_id: Number(batch.branch_id),
          batch_number: batch.batch_number.trim(),
          quantity: Number(batch.quantity),
          cost_price: toDecimalString(batch.cost_price),
          vendor_id: batch.vendor_id,
          expiry_date: batch.expiry_date,
        })),
    }),
  }));
};

const mapCommonProductFields = (formState: ProductFormState) => ({
  name: formState.name.trim(),
  code: formState.code.trim() || undefined,
  description: formState.description.trim() || undefined,
  category_id: formState.category_id,
  brand_id: formState.brand_id,
  tag_ids: formState.tag_ids,
  has_variants: formState.has_variants,
  tax_method: formState.tax_method,
  tax: Number(formState.tax || 0),
});

export const mapStateToCreateProductPayload = (
  formState: ProductFormState,
): ProductFormData => {
  // Create flow keeps initial inventory batches.
  return {
    ...mapCommonProductFields(formState),
    variants: mapVariantsForPayload(formState, true),
  };
};

export const mapStateToUpdateProductPayload = (
  formState: ProductFormState,
): ProductFormData & {
  variant_ids_to_delete?: number[];
  is_edit_mode: true;
} => {
  // Update flow excludes create-only batch input and includes edit metadata.
  const payload: ProductFormData & {
    variant_ids_to_delete?: number[];
    is_edit_mode: true;
  } = {
    ...mapCommonProductFields(formState),
    variants: mapVariantsForPayload(formState, false),
    is_edit_mode: true,
  };

  if (formState.deletedVariantIds.length > 0) {
    payload.variant_ids_to_delete = formState.deletedVariantIds;
  }

  return payload;
};
