import {
  PriceType,
  ProductVariantForSale,
  SaleItem,
} from "../types/sale.types";

// Calculates line total, tax amount, and taxable base amount for either inclusive or exclusive tax methods.
export const calculateTaxAndTotal = (
  price: number,
  quantity: number,
  taxPercentage: number,
  taxMethod: string,
) => {
  const baseAmount = quantity * price;
  let taxAmount: number;
  let lineTotal: number;
  let taxableAmount: number;

  const validTaxPercentage = Number(taxPercentage) || 0;

  if (taxMethod === "INCLUSIVE") {
    lineTotal = baseAmount;
    taxAmount = (baseAmount * validTaxPercentage) / 100;
    taxableAmount = baseAmount - taxAmount;
  } else {
    taxAmount = (baseAmount * validTaxPercentage) / 100;
    lineTotal = baseAmount + taxAmount;
    taxableAmount = baseAmount;
  }

  return {
    line_total: Number(lineTotal) || 0,
    tax_amount: Number(taxAmount) || 0,
    taxable_amount: Number(taxableAmount) || 0,
  };
};

// Returns the wholesale price if it's a wholesale sale, otherwise falls back to the regular price.
export const getVariantPriceForSale = (
  variant: ProductVariantForSale,
  priceType: PriceType,
) => {
  return priceType === PriceType.WHOLESALE
    ? (Number(variant.wholesale_price) ?? Number(variant.regular_price))
    : Number(variant.regular_price);
};

// Adds a variant to the sale items array, or increments its quantity and recalculates totals if it already exists.
export const upsertVariantInSaleItems = ({
  sourceItems,
  variant,
  quantityToAdd,
  priceType,
}: {
  sourceItems: SaleItem[];
  variant: ProductVariantForSale;
  quantityToAdd: number;
  priceType: PriceType;
}) => {
  const existingItem = sourceItems.find(
    (item) => item.variant_id === variant.id,
  );
  const price = getVariantPriceForSale(variant, priceType);

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantityToAdd;
    const { line_total, tax_amount } = calculateTaxAndTotal(
      price,
      newQuantity,
      Number(variant.tax_percentage) || 0,
      variant.tax_method || "EXCLUSIVE",
    );

    return sourceItems.map((item) =>
      item.variant_id === variant.id
        ? {
            ...item,
            quantity: newQuantity,
            unit_price: Number(price) || 0,
            tax_amount: Number(tax_amount) || 0,
            line_total: Number(line_total) || 0,
          }
        : item,
    );
  }

  const { line_total, tax_amount } = calculateTaxAndTotal(
    price,
    quantityToAdd,
    Number(variant.tax_percentage) || 0,
    variant.tax_method || "EXCLUSIVE",
  );

  const newItem: SaleItem = {
    variant_id: variant.id,
    variant_name: variant.name,
    variant_sku: variant.sku,
    quantity: quantityToAdd,
    unit_price: Number(price || 0),
    average_discount_amount: 0,
    special_discount_amount: 0,
    promotion_discount_amount: 0,
    tax_amount: Number(tax_amount || 0),
    line_total: Number(line_total || 0),
    product_name: variant.product_name,
    regular_price: Number(variant.regular_price || 0),
    wholesale_price: Number(variant.wholesale_price || 0),
    image: variant.image,
    unit_name: variant.unit_name,
    tax_percentage: Number(variant.tax_percentage || 0),
    tax_method: variant.tax_method || "EXCLUSIVE",
  };

  return [...sourceItems, newItem];
};

// Updates a specific item's quantity to a new absolute value and recalculates its tax and line total.
export const updateSaleItemQuantity = ({
  sourceItems,
  variantId,
  quantity,
  variants,
}: {
  sourceItems: SaleItem[];
  variantId: number;
  quantity: number;
  variants: ProductVariantForSale[];
}) => {
  return sourceItems.map((item) => {
    if (item.variant_id !== variantId) {
      return item;
    }

    const variant = variants.find((v) => v.id === variantId);
    const { line_total, tax_amount } = calculateTaxAndTotal(
      Number(item.unit_price),
      quantity,
      Number(item.tax_percentage) || 0,
      variant?.tax_method || item.tax_method || "EXCLUSIVE",
    );

    return {
      ...item,
      quantity,
      tax_amount: Number(tax_amount) || 0,
      line_total: Number(line_total) || 0,
    };
  });
};

// Removes a specific variant from the sale items array by its ID.
export const removeSaleItem = (sourceItems: SaleItem[], variantId: number) => {
  return sourceItems.filter((item) => item.variant_id !== variantId);
};

// Safely updates a specific item's special discount, ensuring the value is never negative.
export const updateSaleItemSpecialDiscount = (
  sourceItems: SaleItem[],
  variantId: number,
  amount: number,
) => {
  return sourceItems.map((item) =>
    item.variant_id === variantId
      ? {
          ...item,
          special_discount_amount: Math.max(0, Number(amount) || 0),
        }
      : item,
  );
};
