import { SaveOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Space, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { inventoryApi } from "../../api/inventory-api";
import { productApi } from "../../api/product-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";
import BasicInfoSection from "./components/BasicInfoSection";
import VariantManager from "./components/VariantManager";
import { useProductFormState } from "./hooks/useProductFormState";
import { useProductSaveMutations } from "./hooks/useProductSaveMutations";

// Page orchestrator: loads data, wires form state/actions, and handles save/cancel.

export default function AddOrEditProductPage() {
  const [activeTab, setActiveTab] = useState("basic");
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();

  const {
    formState,
    validationState,
    updateField,
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
    generateProductCode,
    generateSKU,
    generateBarcode,
    validateForm,
    initializeFromProduct,
    resetForm,
    markSnapshot,
  } = useProductFormState();

  const { data: productData, isLoading: productLoading } = useQuery({
    // Edit mode only: fetch product to hydrate form state.
    queryKey: [queryKeys.product, id],
    queryFn: () => productApi.getProduct(Number(id)),
    enabled: isEditMode,
    staleTime: queryStaleTimeMap[queryKeys.product],
  });

  const { data: branches = [] } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: inventoryApi.getBranches,
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: [queryKeys.vendors],
    queryFn: inventoryApi.getVendors,
    staleTime: queryStaleTimeMap[queryKeys.vendors],
  });

  useEffect(() => {
    // Keep hook state synchronized with route mode (add vs edit).
    if (isEditMode && productData) {
      initializeFromProduct(productData);
    }
    if (!isEditMode) {
      resetForm();
    }
  }, [initializeFromProduct, isEditMode, productData, resetForm]);

  const { onSave, isSaving } = useProductSaveMutations({
    formState,
    isEditMode,
    id,
    validateForm,
    markSnapshot,
    queryClient,
    messageApi,
    navigate,
  });

  const onCancel = useCallback(() => {
    navigate("/products");
  }, [navigate]);

  const tabItems = useMemo(
    () => [
      // Tab split keeps base product fields separate from variant-heavy form content.
      {
        key: "basic",
        label: "Basic Information",
        children: (
          <BasicInfoSection
            formState={formState}
            validationState={validationState}
            onFieldUpdate={updateField}
            onProductTypeToggle={toggleProductType}
            onGenerateCode={generateProductCode}
          />
        ),
      },
      {
        key: "variants",
        label: formState.has_variants
          ? `Variants (${Object.keys(formState.variants).length})`
          : "Details",
        children: (
          <VariantManager
            formState={formState}
            validationState={validationState}
            isEditMode={isEditMode}
            branches={branches}
            vendors={vendors}
            onAddVariant={addVariant}
            onDeleteVariant={deleteVariant}
            onVariantUpdate={updateVariant}
            onGenerateSKU={generateSKU}
            onGenerateBarcode={generateBarcode}
            onAddAttribute={addVariantAttribute}
            onUpdateAttribute={updateVariantAttribute}
            onDeleteAttribute={deleteVariantAttribute}
            onAddSerial={addVariantSerial}
            onUpdateSerial={updateVariantSerial}
            onDeleteSerial={deleteVariantSerial}
            onUpdateBatches={updateVariantBatches}
          />
        ),
      },
    ],
    [
      addVariant,
      addVariantAttribute,
      addVariantSerial,
      branches,
      deleteVariant,
      deleteVariantAttribute,
      deleteVariantSerial,
      formState,
      generateBarcode,
      generateProductCode,
      generateSKU,
      isEditMode,
      toggleProductType,
      updateField,
      updateVariant,
      updateVariantAttribute,
      updateVariantBatches,
      updateVariantSerial,
      validationState,
      vendors,
    ],
  );

  if (productLoading) {
    return <CenterLoader />;
  }

  return (
    <>
      {setPageTitle(isEditMode ? "Edit Product" : "Add Product")}
      <PageTitle
        title={isEditMode ? "Edit Product" : "Add Product"}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Products", href: "/products" },
          { title: isEditMode ? "Edit Product" : "Add Product" },
        ]}
        rightSection={
          <Space wrap>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={onSave}
              loading={isSaving}
            >
              {isEditMode ? "Update Product" : "Save Product"}
            </Button>
          </Space>
        }
      />

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </>
  );
}
