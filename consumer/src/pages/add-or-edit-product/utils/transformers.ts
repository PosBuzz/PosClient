import {
  FormAttribute,
  FormSerial,
  Product,
  TaxMethod,
} from "../../../types/product.types";
import { ProductFormState, VariantFormState } from "../types";
import {
  mapStateToCreateProductPayload,
  mapStateToUpdateProductPayload,
} from "./payload-mappers";
import {
  buildSimpleProductSku,
  buildVariantSku,
  createRandomDigits,
  makeBarcode,
} from "./form-generators";

// helper function
function toValidNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  return undefined;
}

// Mapping helpers between backend product payloads and local form state shape.

const toVariantState = (
  variant: Record<string, unknown>,
  index: number,
): VariantFormState => {
  // Converts one backend variant object into local editable variant state.
  const rawAttributes = Array.isArray(variant.VariantAttribute)
    ? (variant.VariantAttribute as FormAttribute[])
    : [];
  const rawSerials = Array.isArray(variant.serials)
    ? (variant.serials as FormSerial[])
    : [];

  return {
    id: variant.id != null ? Number(variant.id) : undefined,
    name: String(variant.name || `Variant ${index + 1}`),
    sku: String(variant.sku || ""),
    barcode: String(variant.barcode || ""),
    regular_price:
      (variant.regular_price as string | number | null | undefined) ?? null,
    wholesale_price:
      (variant.wholesale_price as string | number | null | undefined) ?? null,
    sale_unit_id: toValidNumber(variant.sale_unit_id),
    purchase_unit_id: toValidNumber(variant.purchase_unit_id),
    warranty_period:
      typeof variant.warranty_period === "number"
        ? variant.warranty_period
        : undefined,
    image: (variant.image as string | null | undefined) || null,
    is_default: Boolean(variant.is_default),
    alert_quantity:
      typeof variant.alert_quantity === "number" ? variant.alert_quantity : 0,
    daily_sale_objective:
      typeof variant.daily_sale_objective === "number"
        ? variant.daily_sale_objective
        : 0,
    attributes: rawAttributes.map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      value: attribute.value,
    })),
    serials: rawSerials.map((serial) => ({
      id: serial.id,
      serial_number: serial.serial_number,
      status: serial.status,
      notes: serial.notes,
    })),
    batches: [],
  };
};

export const createDefaultVariant = (
  productName?: string,
): VariantFormState => ({
  // Default shape used for new variants and empty-state initialization.
  name: productName?.trim() || "Default",
  sku: "",
  barcode: "",
  regular_price: null,
  wholesale_price: null,
  sale_unit_id: undefined,
  purchase_unit_id: undefined,
  warranty_period: undefined,
  image: null,
  is_default: true,
  alert_quantity: 0,
  daily_sale_objective: 0,
  attributes: [],
  serials: [],
  batches: [],
});

export const createInitialFormState = (): ProductFormState => ({
  // Initial add-product form state (simple product mode with one variant).
  name: "",
  code: "",
  description: "",
  category_id: undefined,
  brand_id: undefined,
  tag_ids: [],
  has_variants: false,
  original_has_variants: false,
  tax_method: TaxMethod.EXCLUSIVE,
  tax: 0,
  variants: { "0": createDefaultVariant("") },
  deletedVariantIds: [],
});

export const mapProductToFormState = (product: Product): ProductFormState => {
  // Maps fetched product details into hook state for edit mode.
  const variantsArray = Array.isArray(product.variants) ? product.variants : [];
  const variants = variantsArray.reduce<Record<string, VariantFormState>>(
    (acc, item, index) => {
      acc[String(index)] = toVariantState(
        item as unknown as Record<string, unknown>,
        index,
      );
      return acc;
    },
    {},
  );

  return {
    name: product.name || "",
    code: product.code || "",
    description: product.description || "",
    category_id: product.category_id ?? undefined,
    brand_id: product.brand_id ?? undefined,
    tag_ids: (product.tags || []).map((tagRel) => tagRel.tag.id),
    has_variants: Boolean(product.has_variants),
    original_has_variants: Boolean(product.has_variants),
    tax_method: (product.tax_method as TaxMethod) || TaxMethod.EXCLUSIVE,
    tax: Number(product.tax || 0),
    variants:
      Object.keys(variants).length > 0
        ? variants
        : { "0": createDefaultVariant(product.name) },
    deletedVariantIds: [],
  };
};

export const mapProductToCopyFormState = (
  product: Product,
): ProductFormState => {
  // Copies reusable catalogue details while regenerating create-only identifiers.
  const copiedState = mapProductToFormState(product);
  const productPrefix = "PRD";

  return {
    ...copiedState,
    name: "",
    code: `${productPrefix}-${createRandomDigits(6)}`,
    original_has_variants: false,
    variants: Object.entries(copiedState.variants).reduce<
      ProductFormState["variants"]
    >((acc, [key, variant]) => {
      acc[key] = {
        ...variant,
        id: undefined,
        sku: copiedState.has_variants
          ? buildVariantSku(variant.name || "SKU")
          : buildSimpleProductSku(),
        barcode: makeBarcode(),
        attributes: [],
        serials: [],
        batches: [],
      };
      return acc;
    }, {}),
    deletedVariantIds: [],
  };
};

export const mapStateToProductPayload = (
  formState: ProductFormState,
  isEditMode: boolean,
):
  | ReturnType<typeof mapStateToCreateProductPayload>
  | ReturnType<typeof mapStateToUpdateProductPayload> => {
  // Backward-compatible wrapper. Source-of-truth mappers live in payload-mappers.ts.
  return isEditMode
    ? mapStateToUpdateProductPayload(formState)
    : mapStateToCreateProductPayload(formState);
};
