import { useCallback } from "react";
import { FormAttribute, FormSerial } from "../../../types/product.types";
import { useMessageStore } from "../../../stores/messageStore";
import { ProductFormState, ValidationState, VariantBatchInput } from "../types";
import { createDefaultVariant } from "../utils/transformers";
import {
  buildSimpleProductSku,
  buildVariantSku,
  clearVariantValidationEntries,
  makeBarcode,
} from "../utils/form-generators";

interface UseVariantActionsParams {
  formState: ProductFormState;
  setFormState: React.Dispatch<React.SetStateAction<ProductFormState>>;
  setValidationState: React.Dispatch<React.SetStateAction<ValidationState>>;
}

// Handles variant CRUD + nested rows + product type toggling.
export const useVariantActions = ({
  formState,
  setFormState,
  setValidationState,
}: UseVariantActionsParams) => {
  const { messageApi } = useMessageStore();

  const updateVariant = useCallback(
    (
      variantKey: string,
      updates: Partial<ProductFormState["variants"][string]>,
    ) => {
      const updatedFieldKeys = Object.keys(updates);

      setFormState((prev) => ({
        ...prev,
        variants: {
          ...prev.variants,
          [variantKey]: {
            ...prev.variants[variantKey],
            ...updates,
          },
        },
      }));

      setValidationState((prev) =>
        clearVariantValidationEntries(prev, variantKey, updatedFieldKeys),
      );
    },
    [setFormState, setValidationState],
  );

  const addVariant = useCallback(() => {
    setFormState((prev) => {
      const keys = Object.keys(prev.variants);
      const nextKey = String(
        keys.length > 0 ? Math.max(...keys.map((key) => Number(key))) + 1 : 0,
      );
      const nextVariantName = `Variant ${keys.length + 1}`;
      const prefixSource = prev.name.trim() || nextVariantName;

      const nextVariants = {
        ...prev.variants,
        [nextKey]: {
          ...createDefaultVariant(prev.name),
          name: nextVariantName,
          is_default: false,
          sku: buildVariantSku(prefixSource),
          barcode: makeBarcode(),
        },
      };

      if (!prev.has_variants && nextVariants["0"]) {
        nextVariants["0"] = {
          ...nextVariants["0"],
          name: prev.name.trim() || "Default",
          is_default: true,
        };
      }

      return {
        ...prev,
        has_variants: true,
        variants: nextVariants,
      };
    });

    messageApi?.success("New variant added");
  }, [messageApi, setFormState]);

  const deleteVariant = useCallback(
    (variantKey: string) => {
      setFormState((prev) => {
        const entries = Object.entries(prev.variants);
        if (entries.length <= 1) {
          return prev;
        }

        const variant = prev.variants[variantKey];
        if (variant?.is_default) {
          return prev;
        }

        const nextDeleted = [...prev.deletedVariantIds];
        if (variant?.id) {
          nextDeleted.push(variant.id);
        }

        const nextVariants = { ...prev.variants };
        delete nextVariants[variantKey];

        return {
          ...prev,
          variants: nextVariants,
          deletedVariantIds: nextDeleted,
        };
      });
    },
    [setFormState],
  );

  const toggleProductType = useCallback(
    (hasVariants: boolean) => {
      let rollbackBlocked = false;

      setFormState((prev) => {
        if (hasVariants) {
          return {
            ...prev,
            has_variants: true,
            variants: {
              ...prev.variants,
              "0": {
                ...(prev.variants["0"] || createDefaultVariant(prev.name)),
                name: prev.variants["0"]?.name || prev.name || "Default",
                is_default: true,
              },
            },
          };
        }

        if (prev.original_has_variants) {
          rollbackBlocked = true;
          return prev;
        }

        const firstKey = Object.keys(prev.variants)[0] || "0";
        const firstVariant =
          prev.variants[firstKey] || createDefaultVariant(prev.name);

        return {
          ...prev,
          has_variants: false,
          variants: {
            "0": {
              ...firstVariant,
              name: prev.name.trim() || firstVariant.name || "Default",
              is_default: true,
              sku: buildSimpleProductSku(),
              barcode: makeBarcode(),
            },
          },
        };
      });

      if (rollbackBlocked) {
        // For this specific rule, we show toast instead of inline field error.
        setValidationState((prev) => ({
          ...prev,
          has_variants: { status: "", help: "" },
        }));

        messageApi?.warning(
          "Variant product cannot be converted back to simple product.",
        );

        return;
      }

      setValidationState((prev) => ({
        ...prev,
        has_variants: { status: "", help: "" },
      }));
    },
    [messageApi, setFormState, setValidationState],
  );

  const addVariantAttribute = useCallback(
    (variantKey: string, attribute: FormAttribute) => {
      const current = formState.variants[variantKey]?.attributes || [];
      updateVariant(variantKey, { attributes: [...current, attribute] });
    },
    [formState.variants, updateVariant],
  );

  const updateVariantAttribute = useCallback(
    (variantKey: string, index: number, updates: Partial<FormAttribute>) => {
      const current = [...(formState.variants[variantKey]?.attributes || [])];
      current[index] = { ...current[index], ...updates };
      updateVariant(variantKey, { attributes: current });
    },
    [formState.variants, updateVariant],
  );

  const deleteVariantAttribute = useCallback(
    (variantKey: string, index: number) => {
      const current = [...(formState.variants[variantKey]?.attributes || [])];
      current.splice(index, 1);
      updateVariant(variantKey, { attributes: current });
    },
    [formState.variants, updateVariant],
  );

  const addVariantSerial = useCallback(
    (variantKey: string, serial: FormSerial) => {
      const current = formState.variants[variantKey]?.serials || [];
      updateVariant(variantKey, { serials: [...current, serial] });
    },
    [formState.variants, updateVariant],
  );

  const updateVariantSerial = useCallback(
    (variantKey: string, index: number, updates: Partial<FormSerial>) => {
      const current = [...(formState.variants[variantKey]?.serials || [])];
      current[index] = { ...current[index], ...updates };
      updateVariant(variantKey, { serials: current });
    },
    [formState.variants, updateVariant],
  );

  const deleteVariantSerial = useCallback(
    (variantKey: string, index: number) => {
      const current = [...(formState.variants[variantKey]?.serials || [])];
      current.splice(index, 1);
      updateVariant(variantKey, { serials: current });
    },
    [formState.variants, updateVariant],
  );

  const updateVariantBatches = useCallback(
    (variantKey: string, batches: VariantBatchInput[]) => {
      updateVariant(variantKey, { batches });
    },
    [updateVariant],
  );

  return {
    updateVariant,
    addVariant,
    deleteVariant,
    toggleProductType,
    addVariantAttribute,
    updateVariantAttribute,
    deleteVariantAttribute,
    addVariantSerial,
    updateVariantSerial,
    deleteVariantSerial,
    updateVariantBatches,
  };
};
