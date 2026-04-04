import { useCallback } from "react";
import { ProductFormState, ValidationState } from "../types";

interface UseProductFieldActionsParams {
  setFormState: React.Dispatch<React.SetStateAction<ProductFormState>>;
  setValidationState: React.Dispatch<React.SetStateAction<ValidationState>>;
}

// Handles top-level product field updates.
export const useProductFieldActions = ({
  setFormState,
  setValidationState,
}: UseProductFieldActionsParams) => {
  const syncSimpleVariantName = (
    state: ProductFormState,
    productName: string,
  ): ProductFormState => {
    if (state.has_variants || !state.variants["0"]) {
      return state;
    }

    return {
      ...state,
      variants: {
        ...state.variants,
        "0": {
          ...state.variants["0"],
          name: productName.trim() || "Default",
        },
      },
    };
  };

  const updateField = useCallback(
    (field: keyof ProductFormState, value: unknown) => {
      setFormState((prev) => {
        const next = {
          ...prev,
          [field]: value,
        } as ProductFormState;

        if (field === "name") {
          return syncSimpleVariantName(next, String(value || ""));
        }
        return next;
      });

      setValidationState((prev) => ({
        ...prev,
        [String(field)]: { status: "", help: "" },
      }));
    },
    [setFormState, setValidationState],
  );

  return { updateField };
};
