import { useCallback } from "react";
import { ProductFormState } from "../types";
import {
  buildSimpleProductSku,
  buildVariantSku,
  createRandomDigits,
  getSecondVariantName,
  makeBarcode,
} from "../utils/form-generators";

interface UseProductIdentifierActionsParams {
  setFormState: React.Dispatch<React.SetStateAction<ProductFormState>>;
}

// Handles product code, SKU and barcode generators.
export const useProductIdentifierActions = ({
  setFormState,
}: UseProductIdentifierActionsParams) => {
  const generateProductCode = useCallback(() => {
    setFormState((prev) => {
      const prefix = (prev.name || "PRD")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 3)
        .padEnd(3, "X");
      return {
        ...prev,
        code: `${prefix}-${createRandomDigits(6)}`,
      };
    });
  }, [setFormState]);

  const generateSKU = useCallback(
    (variantKey: string) => {
      setFormState((prev) => {
        const variant = prev.variants[variantKey];
        if (!variant) {
          return prev;
        }

        const sku = prev.has_variants
          ? (() => {
              const prefixSource =
                prev.name.trim() ||
                getSecondVariantName(prev.variants) ||
                variant.name ||
                "SKU";
              return buildVariantSku(prefixSource);
            })()
          : buildSimpleProductSku();

        return {
          ...prev,
          variants: {
            ...prev.variants,
            [variantKey]: {
              ...variant,
              sku,
            },
          },
        };
      });
    },
    [setFormState],
  );

  const generateBarcode = useCallback(
    (variantKey: string) => {
      setFormState((prev) => {
        const variant = prev.variants[variantKey];
        if (!variant) {
          return prev;
        }

        return {
          ...prev,
          variants: {
            ...prev.variants,
            [variantKey]: {
              ...variant,
              barcode: makeBarcode(),
            },
          },
        };
      });
    },
    [setFormState],
  );

  return {
    generateProductCode,
    generateSKU,
    generateBarcode,
  };
};
