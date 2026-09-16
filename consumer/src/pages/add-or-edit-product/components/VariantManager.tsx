import { useState } from "react";
import { CopyOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Popconfirm, Space, Tabs, Typography } from "antd";
import { ProductFormState, ValidationState, VariantBatchInput } from "../types";
import VariantForm from "./VariantForm";
import { FormAttribute, FormSerial } from "../../../types/product.types";

// Manages the variant tab list and delegates each tab body to VariantForm.

const { Text } = Typography;

interface Option {
  id: number;
  name: string;
}

interface VariantManagerProps {
  formState: ProductFormState;
  validationState: ValidationState;
  isEditMode: boolean;
  branches: Option[];
  onAddVariant: () => void;
  onCopyVariant: (key: string) => string | undefined;
  onDeleteVariant: (variantKey: string) => void;
  onVariantUpdate: (
    variantKey: string,
    updates: Record<string, unknown>,
  ) => void;
  onGenerateSKU: (variantKey: string) => void;
  onGenerateBarcode: (variantKey: string) => void;
  onAddAttribute: (variantKey: string, attribute: FormAttribute) => void;
  onUpdateAttribute: (
    variantKey: string,
    index: number,
    updates: Partial<FormAttribute>,
  ) => void;
  onDeleteAttribute: (variantKey: string, index: number) => void;
  onAddSerial: (variantKey: string, serial: FormSerial) => void;
  onUpdateSerial: (
    variantKey: string,
    index: number,
    updates: Partial<FormSerial>,
  ) => void;
  onDeleteSerial: (variantKey: string, index: number) => void;
  onUpdateBatches: (variantKey: string, batches: VariantBatchInput[]) => void;
}

export default function VariantManager({
  formState,
  validationState,
  isEditMode,
  branches,
  onAddVariant,
  onCopyVariant,
  onDeleteVariant,
  onVariantUpdate,
  onGenerateSKU,
  onGenerateBarcode,
  onAddAttribute,
  onUpdateAttribute,
  onDeleteAttribute,
  onAddSerial,
  onUpdateSerial,
  onDeleteSerial,
  onUpdateBatches,
}: VariantManagerProps) {
  // Tab order follows object keys from current form state.
  const variantKeys = Object.keys(formState.variants);
  const [selectedKey, setSelectedKey] = useState(variantKeys[0]);
  const activeKey = variantKeys.includes(selectedKey)
    ? selectedKey
    : variantKeys[0];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      {formState.has_variants && (
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Text strong>Variants ({variantKeys.length})</Text>
          <Space>
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                const key = onCopyVariant(activeKey);
                if (key) setSelectedKey(key);
              }}
            >
              Copy & Add Variant
            </Button>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={onAddVariant}
            >
              Add Variant
            </Button>
          </Space>
        </Space>
      )}

      {Object.keys(validationState).length > 0 && (
        // Global reminder; detailed errors stay near each field.
        <Alert
          showIcon
          type="warning"
          message="Please resolve validation errors before saving."
        />
      )}

      <Tabs
        activeKey={activeKey}
        onChange={setSelectedKey}
        type={
          formState.has_variants && variantKeys.length > 1 ? "card" : "line"
        }
        items={variantKeys.map((variantKey, index) => {
          // One tab per variant; each tab renders a full VariantForm.
          return {
            key: variantKey,
            label: (
              <Space size={4}>
                <span>
                  {formState.has_variants ? `Variant ${index + 1}` : "Details"}
                </span>
              </Space>
            ),
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                <Space wrap>
                  {variantKeys.length > 1 && formState.has_variants && (
                    <Popconfirm
                      title="Delete variant"
                      description="Are you sure you want to remove this variant?"
                      okType="danger"
                      onConfirm={() => onDeleteVariant(variantKey)}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        Delete
                      </Button>
                    </Popconfirm>
                  )}
                </Space>

                <VariantForm
                  variantId={variantKey}
                  formState={formState}
                  validationState={validationState}
                  isEditMode={isEditMode}
                  branches={branches}
                  onVariantUpdate={onVariantUpdate}
                  onGenerateSKU={onGenerateSKU}
                  onGenerateBarcode={onGenerateBarcode}
                  onAddAttribute={onAddAttribute}
                  onUpdateAttribute={onUpdateAttribute}
                  onDeleteAttribute={onDeleteAttribute}
                  onAddSerial={onAddSerial}
                  onUpdateSerial={onUpdateSerial}
                  onDeleteSerial={onDeleteSerial}
                  onUpdateBatches={onUpdateBatches}
                />
              </Space>
            ),
          };
        })}
      />
    </Space>
  );
}
