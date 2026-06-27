type ProductSearchLike = {
  product_name?: string | null;
  product_code?: string | null;
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
};

export const getProductVariantSearchLabel = (
  variant: ProductSearchLike,
): string =>
  [
    variant.product_name,
    variant.name,
    variant.product_code,
    variant.sku,
    variant.barcode,
  ]
    .filter(Boolean)
    .join(" - ");
