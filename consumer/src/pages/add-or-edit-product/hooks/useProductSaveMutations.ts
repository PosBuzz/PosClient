import { useCallback } from "react";
import { useMutation, QueryClient } from "@tanstack/react-query";
import { MessageInstance } from "antd/es/message/interface";
import { productApi } from "../../../api/product-api";
import { queryKeys } from "../../../constants/queryKeys";
import { ProductFormState } from "../types";
import {
  mapStateToCreateProductPayload,
  mapStateToUpdateProductPayload,
} from "../utils/payload-mappers";

interface UseProductSaveMutationsParams {
  formState: ProductFormState;
  isEditMode: boolean;
  id?: string;
  validateForm: (options?: { skipBatchValidation?: boolean }) => boolean;
  markSnapshot: () => void;
  queryClient: QueryClient;
  messageApi: MessageInstance | null;
  navigate: (path: string) => void;
}

// Isolated save logic with separate create/update flows for easier navigation.
export const useProductSaveMutations = ({
  formState,
  isEditMode,
  id,
  validateForm,
  markSnapshot,
  queryClient,
  messageApi,
  navigate,
}: UseProductSaveMutationsParams) => {
  const invalidateAfterSave = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.products] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.product] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.productVariants] });
    queryClient.invalidateQueries({
      queryKey: [queryKeys.productsForInventory],
    });
    queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
  }, [queryClient]);

  const validateOrThrow = useCallback(
    (skipBatchValidation: boolean) => {
      const isValid = validateForm({ skipBatchValidation });
      if (!isValid) {
        throw new Error("All required field must be filled up");
      }
    },
    [validateForm],
  );

  const createProductMutation = useMutation({
    mutationFn: async () => {
      validateOrThrow(false);
      const payload = mapStateToCreateProductPayload(formState);
      return productApi.createProduct(payload);
    },
    onSuccess: () => {
      messageApi?.success("Product created successfully");
      invalidateAfterSave();
      markSnapshot();
      navigate("/products");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to create product";
      messageApi?.error(message);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async () => {
      validateOrThrow(true);
      if (!id) {
        throw new Error("Product id is required for update");
      }
      const payload = mapStateToUpdateProductPayload(formState);
      return productApi.updateProduct(Number(id), payload);
    },
    onSuccess: () => {
      messageApi?.success("Product updated successfully");
      invalidateAfterSave();
      markSnapshot();
      navigate("/products");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to update product";
      messageApi?.error(message);
    },
  });

  const onSave = useCallback(() => {
    if (isEditMode) {
      updateProductMutation.mutate();
      return;
    }
    createProductMutation.mutate();
  }, [createProductMutation, isEditMode, updateProductMutation]);

  return {
    onSave,
    isSaving:
      createProductMutation.isPending || updateProductMutation.isPending,
  };
};
