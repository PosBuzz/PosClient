import { SaveOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Space, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get("copy_from");
  const isCopyMode = !isEditMode && Boolean(copyFromId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();

  const {
    formState,
    validationState,
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
  } = useProductFormState();

  const { data: productData, isLoading: productLoading } = useQuery({
    // Edit mode only: fetch product to hydrate form state.
    queryKey: [queryKeys.product, id],
    queryFn: () => productApi.getProduct(Number(id)),
    enabled: isEditMode,
    staleTime: queryStaleTimeMap[queryKeys.product],
  });

  const { data: copyProductData, isLoading: copyProductLoading } = useQuery({
    queryKey: [queryKeys.product, "copy", copyFromId],
    queryFn: () => productApi.getProduct(Number(copyFromId)),
    enabled: isCopyMode,
    staleTime: 0,
  });

  const { data: branches = [] } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: inventoryApi.getBranches,
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  useEffect(() => {
    // Keep hook state synchronized with route mode (add vs edit).
    if (isEditMode && productData) {
      initializeFromProduct(productData);
    }
    if (isCopyMode && copyProductData) {
      initializeFromProductCopy(copyProductData);
      return;
    }
    if (!isEditMode && !isCopyMode) {
      resetForm();
    }
  }, [
    copyProductData,
    initializeFromProduct,
    initializeFromProductCopy,
    isCopyMode,
    isEditMode,
    productData,
    resetForm,
  ]);

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
            onAddVariant={addVariant}
            onCopyVariant={copyVariant}
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
      copyVariant,
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
    ],
  );

  const pageTitle = isEditMode
    ? "Edit Product"
    : isCopyMode
      ? "Copy Product"
      : "Add Product";

  if (productLoading || copyProductLoading) {
    return <CenterLoader />;
  }

  return (
    <>
      {setPageTitle(pageTitle)}
      <PageTitle
        title={pageTitle}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Products", href: "/products" },
          { title: pageTitle },
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
