import { useCallback, useMemo, useRef, useState } from "react";
import { ProductFormState, ValidationState } from "../types";
import {
  createInitialFormState,
  mapProductToCopyFormState,
  mapProductToFormState,
} from "../utils/transformers";
import { buildSimpleProductSku, makeBarcode } from "../utils/form-generators";
import { validateProductForm } from "../utils/validation";
import { useProductFieldActions } from "./useProductFieldActions";
import { useVariantActions } from "./useVariantActions";
import { useProductIdentifierActions } from "./useProductIdentifierActions";

// Feature state engine: owns product/variant form data, generators, and edit actions.

export const useProductFormState = () => {
  const [formState, setFormState] = useState<ProductFormState>(() => {
    // New simple products start with auto-generated SKU/barcode on the main variant.
    const state = createInitialFormState();
    state.variants["0"] = {
      ...state.variants["0"],
      sku: buildSimpleProductSku(),
      barcode: makeBarcode(),
    };
    return state;
  });
  const [validationState, setValidationState] = useState<ValidationState>({});

  const initialSnapshotRef = useRef<string>(JSON.stringify(formState));

  const { updateField } = useProductFieldActions({
    setFormState,
    setValidationState,
  });

  const {
    updateVariant,
    addVariant,
    copyVariant,
    deleteVariant,
    toggleProductType,
    addVariantAttribute,
    updateVariantAttribute,
    deleteVariantAttribute,
    addVariantSerial,
    updateVariantSerial,
    deleteVariantSerial,
    updateVariantBatches,
  } = useVariantActions({
    formState,
    setFormState,
    setValidationState,
  });

  const { generateProductCode, generateSKU, generateBarcode } =
    useProductIdentifierActions({
      setFormState,
    });

  const validateForm = useCallback(
    (options?: { skipBatchValidation?: boolean }) => {
      // Runs centralized validation and stores result for UI rendering.
      const nextValidationState = validateProductForm(formState, options);
      setValidationState(nextValidationState);
      return Object.keys(nextValidationState).length === 0;
    },
    [formState],
  );

  const initializeFromProduct = useCallback(
    (product: Parameters<typeof mapProductToFormState>[0]) => {
      // Hydrates hook state when editing an existing product.
      const nextState = mapProductToFormState(product);
      setFormState(nextState);
      setValidationState({});
      initialSnapshotRef.current = JSON.stringify(nextState);
    },
    [],
  );

  const initializeFromProductCopy = useCallback(
    (product: Parameters<typeof mapProductToCopyFormState>[0]) => {
      const nextState = mapProductToCopyFormState(product);
      setFormState(nextState);
      setValidationState({});
      initialSnapshotRef.current = JSON.stringify(nextState);
    },
    [],
  );

  const resetForm = useCallback(() => {
    // Resets to clean add-form state with default simple variant identifiers.
    const nextState = createInitialFormState();
    nextState.variants["0"] = {
      ...nextState.variants["0"],
      sku: buildSimpleProductSku(),
      barcode: makeBarcode(),
    };
    setFormState(nextState);
    setValidationState({});
    initialSnapshotRef.current = JSON.stringify(nextState);
  }, []);

  const markSnapshot = useCallback(() => {
    // Sets current state as the baseline for dirty-check detection.
    initialSnapshotRef.current = JSON.stringify(formState);
  }, [formState]);

  const isDirty = useMemo(() => {
    return initialSnapshotRef.current !== JSON.stringify(formState);
  }, [formState]);

  return {
    formState,
    validationState,
    isDirty,
    updateField,
    updateVariant,
    addVariant,
    copyVariant,
    deleteVariant,
    toggleProductType,
    addVariantAttribute,
    updateVariantAttribute,
    deleteVariantAttribute,
    addVariantSerial,
    updateVariantSerial,
    deleteVariantSerial,
    updateVariantBatches,
    generateProductCode,
    generateSKU,
    generateBarcode,
    validateForm,
    initializeFromProduct,
    initializeFromProductCopy,
    resetForm,
    markSnapshot,
    setValidationState,
  };
};
