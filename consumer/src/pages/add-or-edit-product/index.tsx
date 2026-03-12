import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Tabs } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productApi } from "../../api/product-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { ProductFormData, TaxMethod } from "../../types/product.types";
import { useProductFormState } from "./hooks/useProductFormState";
import StateBasicInformationTab from "./components/StateBasicInformationTab";
import StateVariantManager from "./components/StateVariantManager";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const { messageApi } = useMessageStore();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic");
  const queryClient = useQueryClient();

  // Initialize our state management hook
  const {
    formState,
    validationState,
    updateField,
    addVariant,
    deleteVariant,
    duplicateVariant,
    updateVariant,
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
    initializeFormData,
    resetForm,
  } = useProductFormState();
  // Define helper functions for data transformation
  const transformProductToFormData = useCallback(
    (product: any): ProductFormData => {
      // Transform variants from backend format to frontend format
      const transformedVariants =
        product.variants?.map((variant: any) => ({
          id: variant.id,
          name: variant.name || "",
          sku: variant.sku || "",
          barcode: variant.barcode || "",
          regular_price: variant.regular_price || "0.00",
          wholesale_price: variant.wholesale_price || "",
          sale_unit_id: variant.sale_unit_id,
          purchase_unit_id: variant.purchase_unit_id,
          warranty_period: variant.warranty_period || undefined,
          image: variant.image || null,
          alert_quantity: variant.alert_quantity || 0,
          daily_sale_objective: variant.daily_sale_objective || 0,
          is_default: variant.is_default || false,
          // Transform VariantAttribute to attributes
          attributes:
            variant.VariantAttribute?.map((attr: any) => ({
              id: attr.id,
              name: attr.name,
              value: attr.value,
            })) || [],
          // Transform serials
          serials:
            variant.serials?.map((serial: any) => ({
              id: serial.id,
              serial_number: serial.serial_number,
              status: serial.status || "available",
              notes: serial.notes,
            })) || [],
          // Transform batches (for inventory in non-edit mode)
          batches:
            variant.inventory_items?.map((item: any) => ({
              id: item.id,
              branch_id: item.branch_id,
              batch_number: item.batch_number || "",
              quantity: item.quantity,
              cost_price: item.cost_price || "0.00",
              vendor_id: item.vendor_id,
              expiry_date: item.expiry_date,
            })) || [],
        })) || [];
      return {
        name: product.name || "",
        code: product.code || "",
        description: product.description || "",
        category_id: product.category_id,
        brand_id: product.brand_id,
        tag_ids:
          product.tags?.map((tagRelation: any) => tagRelation.tag.id) || [],
        has_variants: product.has_variants ?? true,
        tax_method: product.tax_method || TaxMethod.EXCLUSIVE,
        tax: product.tax || 0,
        variants: transformedVariants,
      };
    },
    [],
  );

  const transformFormToApiData = useCallback(() => {
    // Transform our form state back to API format
    const variants = Object.values(formState.variants).map((variant) => ({
      ...(variant.id && { id: variant.id }),
      name: variant.name,
      sku: variant.sku || undefined,
      barcode: variant.barcode || undefined,
      regular_price: variant.regular_price?.toString() || "0.00",
      wholesale_price: variant.wholesale_price?.toString() || undefined,
      sale_unit_id: variant.sale_unit_id,
      purchase_unit_id: variant.purchase_unit_id,
      warranty_period: variant.warranty_period || undefined,
      image: variant.image || null,
      alert_quantity: variant.alert_quantity || 0,
      daily_sale_objective: variant.daily_sale_objective || 0,
      is_default: variant.is_default || false,
      attributes:
        variant.attributes?.map((attr) => ({
          id: attr.id,
          name: attr.name,
          value: attr.value,
        })) || [],
      serials:
        variant.serials?.map((serial) => ({
          id: serial.id,
          serial_number: serial.serial_number,
          status: serial.status || "available",
          notes: serial.notes,
        })) || [],
      batches:
        variant.batches?.map((batch) => ({
          ...batch,
          cost_price: batch.cost_price?.toString() || "0.00",
        })) || [],
    })); // Prepare API data object, adding variant_ids_to_delete if any exist
    const apiData: any = {
      name: formState.name,
      code: formState.code,
      description: formState.description,
      category_id: formState.category_id,
      brand_id: formState.brand_id,
      tag_ids: formState.tag_ids,
      has_variants: formState.has_variants,
      tax_method: formState.tax_method,
      tax: formState.tax,
      variants,
    };

    // Add deleted variant IDs for edit mode
    if (formState.deletedVariantIds.length > 0) {
      apiData.variant_ids_to_delete = formState.deletedVariantIds;
      apiData.is_edit_mode = true; // Flag to preserve inventory on backend for edited variants
    } else if (isEditMode) {
      // If in edit mode but no variants deleted, still flag it for backend processing
      apiData.is_edit_mode = true;
    }

    return apiData;
  }, [formState]);

  // Fetch product data if in edit mode
  const { data: productData, isLoading: isLoadingProduct } = useQuery({
    queryKey: [queryKeys.product, id],
    queryFn: () => productApi.getProduct(Number(id!)),
    enabled: isEditMode,
    staleTime: queryStaleTimeMap[queryKeys.product],
  });

  // Initialize form with product data in edit mode
  useEffect(() => {
    if (productData && isEditMode) {
      const formData = transformProductToFormData(productData);
      initializeFormData(formData);
    } else {
      resetForm();
    }
  }, [productData, isEditMode, transformProductToFormData, initializeFormData]);

  // Save mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      // Validate form before submitting using the hook's validation

      const isValid = validateForm();
      if (!isValid) {
        throw new Error("Please fix validation errors before saving");
      }

      // Transform form data to API format
      const submitData = transformFormToApiData();

      return isEditMode
        ? productApi.updateProduct(Number(id), submitData)
        : productApi.createProduct(submitData);
    },
    onSuccess: () => {
      messageApi?.success(
        isEditMode
          ? "Product updated successfully"
          : "Product saved successfully",
      );
      queryClient.invalidateQueries({
        queryKey: [queryKeys.product],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.products],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.productVariants],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.productsForInventory],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.batches],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.inventorySummary],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.lowStockItems],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.productsForSale],
      });

      if (isEditMode && id) {
        queryClient.invalidateQueries({
          queryKey: [queryKeys.product, id],
        });
      }

      navigate("/products");
    },
    onError: (error: any) => {
      messageApi?.error(
        `${
          isEditMode ? "Failed to update product" : "Failed to save product"
        }: ${error.response?.data?.message || error.message || "Unknown error"}`,
      );
    },
  });

  const handleSubmit = async () => {
    try {
      await saveProductMutation.mutateAsync();
    } catch (error) {
      console.error("Submit error:", error);
    }
  };

  const handleCancel = () => {
    navigate("/products");
  };

  // Variant management handlers
  const handleDeleteVariant = useCallback(
    (variantId: string) => {
      deleteVariant(variantId);
    },
    [deleteVariant],
  );

  const handleAddVariant = useCallback(() => {
    addVariant();
  }, [addVariant]);

  const handleDuplicateVariant = useCallback(
    (variantId: string) => {
      duplicateVariant(variantId);
    },
    [duplicateVariant],
  );

  const handleVariantUpdate = useCallback(
    (variantId: string, updates: any) => {
      updateVariant(variantId, updates);
    },
    [updateVariant],
  );

  const handleAddVariantAttribute = useCallback(
    (variantId: string, attribute: any) => {
      addVariantAttribute(variantId, attribute);
    },
    [addVariantAttribute],
  );

  const handleUpdateVariantAttribute = useCallback(
    (variantId: string, attributeIndex: number, updates: any) => {
      updateVariantAttribute(variantId, attributeIndex, updates);
    },
    [updateVariantAttribute],
  );

  const handleDeleteVariantAttribute = useCallback(
    (variantId: string, attributeIndex: number) => {
      deleteVariantAttribute(variantId, attributeIndex);
    },
    [deleteVariantAttribute],
  );

  const handleAddVariantSerial = useCallback(
    (variantId: string, serial: any) => {
      addVariantSerial(variantId, serial);
    },
    [addVariantSerial],
  );

  const handleUpdateVariantSerial = useCallback(
    (variantId: string, serialIndex: number, updates: any) => {
      updateVariantSerial(variantId, serialIndex, updates);
    },
    [updateVariantSerial],
  );

  const handleDeleteVariantSerial = useCallback(
    (variantId: string, serialIndex: number) => {
      deleteVariantSerial(variantId, serialIndex);
    },
    [deleteVariantSerial],
  );

  const handleUpdateVariantBatches = useCallback(
    (variantId: string, batches: any[]) => {
      updateVariantBatches(variantId, batches);
    },
    [updateVariantBatches],
  );

  const handleGenerateSKU = useCallback(
    (variantId: string) => {
      generateSKU(variantId);
    },
    [generateSKU],
  );

  const handleGenerateBarcode = useCallback(
    (variantId: string) => {
      generateBarcode(variantId);
    },
    [generateBarcode],
  );

  // Show loading state
  if (isLoadingProduct) {
    return <CenterLoader />;
  }

  // Tab configuration
  const tabItems = [
    {
      key: "basic",
      label: "Basic Information",
      children: (
        <StateBasicInformationTab
          formState={formState}
          validationState={validationState}
          onFieldUpdate={updateField}
          onVariantToggle={(hasVariants) =>
            updateField("has_variants", hasVariants)
          }
          generateProductCode={generateProductCode}
          isEditMode={isEditMode}
        />
      ),
    },
    {
      key: "variants",
      label: formState.has_variants
        ? `Variants (${Object.keys(formState.variants).length})`
        : "Details",
      children: (
        <StateVariantManager
          formState={formState}
          validationState={validationState}
          onAddVariant={handleAddVariant}
          onDeleteVariant={handleDeleteVariant}
          onDuplicateVariant={handleDuplicateVariant}
          onVariantUpdate={handleVariantUpdate}
          onAddVariantAttribute={handleAddVariantAttribute}
          onUpdateVariantAttribute={handleUpdateVariantAttribute}
          onDeleteVariantAttribute={handleDeleteVariantAttribute}
          onAddVariantSerial={handleAddVariantSerial}
          onUpdateVariantSerial={handleUpdateVariantSerial}
          onDeleteVariantSerial={handleDeleteVariantSerial}
          onBatchesChange={handleUpdateVariantBatches}
          onGenerateSKU={handleGenerateSKU}
          onGenerateBarcode={handleGenerateBarcode}
          isEditMode={isEditMode}
        />
      ),
    },
  ];

  return (
    <>
      {setPageTitle("Product Form")}
      <PageTitle
        title={isEditMode ? "Edit Product" : "Add Product"}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Products", href: "/products" },
          { title: isEditMode ? "Edit Product" : "Add Product" },
        ]}
        rightSection={
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={saveProductMutation.isPending}
              disabled={
                saveProductMutation.isPending ||
                Object.keys(validationState).some(
                  (key) => validationState[key].status === "error",
                )
              }
            >
              {isEditMode ? "Update Product" : "Save Product"}
            </Button>
          </div>
        }
      />

      <Card className="shadow-sm">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="min-h-125"
        />
      </Card>
    </>
  );
}
