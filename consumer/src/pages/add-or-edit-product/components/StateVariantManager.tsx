import React, { useState } from "react";
import { Button, Space, Typography, Popconfirm, Tabs, Alert, Card } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type {
  ProductFormState,
  ValidationState,
} from "../hooks/useProductFormState";
import type { FormAttribute, FormSerial } from "../../../types/product.types";
import type { BatchData } from "./StateBatchAddingForm";
import StateSimpleProductForm from "./StateSimpleProductForm";
import { GoDotFill } from "react-icons/go";

const { Text } = Typography;

interface StateVariantManagerProps {
  formState: ProductFormState;
  validationState: ValidationState;
  onAddVariant: () => void;
  onDeleteVariant: (variantId: string) => void;
  onDuplicateVariant: (variantId: string) => void;
  onVariantUpdate: (variantId: string, updates: any) => void;
  onAddVariantAttribute: (variantId: string, attribute: FormAttribute) => void;
  onUpdateVariantAttribute: (
    variantId: string,
    attributeIndex: number,
    updates: any,
  ) => void;
  onDeleteVariantAttribute: (variantId: string, attributeIndex: number) => void;
  onAddVariantSerial: (variantId: string, serial: FormSerial) => void;
  onUpdateVariantSerial: (
    variantId: string,
    serialIndex: number,
    updates: any,
  ) => void;
  onDeleteVariantSerial: (variantId: string, serialIndex: number) => void;
  onBatchesChange: (variantId: string, batches: BatchData[]) => void;
  onGenerateSKU: (variantId: string) => void;
  onGenerateBarcode: (variantId: string) => void;
  isEditMode?: boolean;
}

const StateVariantManager: React.FC<StateVariantManagerProps> = ({
  formState,
  validationState,
  onAddVariant,
  onDeleteVariant,
  onDuplicateVariant,
  onVariantUpdate,
  onAddVariantAttribute,
  onUpdateVariantAttribute,
  onDeleteVariantAttribute,
  onAddVariantSerial,
  onUpdateVariantSerial,
  onDeleteVariantSerial,
  onBatchesChange,
  onGenerateSKU,
  onGenerateBarcode,
  isEditMode = false,
}) => {
  const [activeTab, setActiveTab] = useState("0");
  const variantIds = Object.keys(formState.variants);
  const canManageVariants = formState.has_variants;

  // Check if any variant has validation errors
  const getVariantErrors = (variantId: string) => {
    if (!validationState || typeof validationState !== "object") {
      return [];
    }
    return Object.keys(validationState).filter((field) =>
      field.startsWith(`variant_${variantId}_`),
    );
  };

  const hasVariantErrors = (variantId: string) => {
    return getVariantErrors(variantId).length > 0;
  };

  const getTabTitle = (variantId: string) => {
    const variant = formState.variants[variantId];
    const hasErrors = hasVariantErrors(variantId);
    const variantNumber = variantIds.indexOf(variantId) + 1;

    return (
      <Space size={4}>
        <span style={{ color: hasErrors ? "#ff4d4f" : undefined }}>
          Variant {variantNumber}
        </span>
        {variant?.name && variant.name !== formState.name && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({variant.name})
          </Text>
        )}
        {hasErrors && (
          <span style={{ color: "#ff4d4f", fontSize: 12 }}>
            <GoDotFill />
          </span>
        )}
      </Space>
    );
  };

  // Generate tab items for multiple variants
  const tabItems = variantIds.map((variantId) => ({
    key: variantId,
    label: getTabTitle(variantId),
    children: (
      <div style={{ marginTop: 16 }}>
        {" "}
        <StateSimpleProductForm
          formState={formState}
          validationState={validationState}
          variantId={variantId}
          onVariantUpdate={onVariantUpdate}
          onAddVariantAttribute={onAddVariantAttribute}
          onUpdateVariantAttribute={onUpdateVariantAttribute}
          onDeleteVariantAttribute={onDeleteVariantAttribute}
          onAddVariantSerial={onAddVariantSerial}
          onUpdateVariantSerial={onUpdateVariantSerial}
          onDeleteVariantSerial={onDeleteVariantSerial}
          onBatchesChange={onBatchesChange}
          onGenerateSKU={onGenerateSKU}
          onGenerateBarcode={onGenerateBarcode}
          isEditMode={isEditMode}
        />{" "}
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Space>
            {formState.has_variants && variantIds.length > 1 && (
              <Popconfirm
                title="Delete Variant"
                description="Are you sure you want to delete this variant?"
                onConfirm={() => onDeleteVariant(variantId)}
                okText="Yes"
                cancelText="No"
                okType="danger"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                >
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>
      </div>
    ),
  }));
  return (
    <div>
      {" "}
      {/* Show variant actions only when product type is set to variants. */}
      {canManageVariants && (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text strong>
            {formState.has_variants ? "Product Variants" : "Product Details"} (
            {variantIds.length})
          </Text>
          <Button type="dashed" icon={<PlusOutlined />} onClick={onAddVariant}>
            Add Variant
          </Button>
        </div>
      )}
      {/* Render variants */}
      {formState.has_variants && variantIds.length > 1 ? (
        <Tabs
          type="card"
          activeKey={activeTab}
          onChange={setActiveTab}
          hideAdd
          items={tabItems}
          tabBarStyle={{ marginBottom: 16 }}
        />
      ) : (
        <Card>
          {" "}
          <StateSimpleProductForm
            formState={formState}
            validationState={validationState}
            variantId="0"
            onVariantUpdate={onVariantUpdate}
            onAddVariantAttribute={onAddVariantAttribute}
            onUpdateVariantAttribute={onUpdateVariantAttribute}
            onDeleteVariantAttribute={onDeleteVariantAttribute}
            onAddVariantSerial={onAddVariantSerial}
            onUpdateVariantSerial={onUpdateVariantSerial}
            onDeleteVariantSerial={onDeleteVariantSerial}
            onBatchesChange={onBatchesChange}
            onGenerateSKU={onGenerateSKU}
            onGenerateBarcode={onGenerateBarcode}
            isEditMode={isEditMode}
          />
        </Card>
      )}
      {/* Error summary */}
      {Object.keys(validationState || {}).length > 0 && (
        <Alert
          type="warning"
          message="Please fix the validation errors above before proceeding"
          style={{ marginTop: 16 }}
          showIcon
        />
      )}
    </div>
  );
};

export default StateVariantManager;
