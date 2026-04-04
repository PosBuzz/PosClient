import {
  AlertOutlined,
  AimOutlined,
  BarcodeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Space,
  Tabs,
  Typography,
} from "antd";
import { FormAttribute, FormSerial } from "../../../types/product.types";
import ImageInput from "../../../components/ImageInput";
import { ProductFormState, ValidationState, VariantBatchInput } from "../types";
import MasterDataSelector from "./MasterDataSelector";
import VariantAttributesSection from "./VariantAttributesSection";
import VariantBatchSection from "./VariantBatchSection";
import VariantSerialsSection from "./VariantSerialsSection";

// Full form for a single variant: identity, pricing, units, media, and nested tabs.

const { Text } = Typography;

interface Option {
  id: number;
  name: string;
}

interface VariantFormProps {
  variantId: string;
  formState: ProductFormState;
  validationState: ValidationState;
  isEditMode: boolean;
  branches: Option[];
  // vendors: Option[];
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

const getError = (
  validationState: ValidationState,
  variantKey: string,
  field: string,
) => {
  // Validation keys encode variant + field path.
  const key = `variant_${variantKey}_${field}`;
  const status = validationState[key]?.status;
  return {
    status: status === "error" || status === "warning" ? status : undefined,
    help: validationState[key]?.help,
  };
};

export default function VariantForm({
  variantId,
  formState,
  validationState,
  isEditMode,
  branches,
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
}: VariantFormProps) {
  const variant = formState.variants[variantId];

  if (!variant) {
    // Defensive guard for stale tab keys.
    return null;
  }

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card>
        <Row gutter={[12, 8]}>
          <Col xs={24} md={8}>
            <Text strong>Variant Name *</Text>
            <Input
              value={variant.name}
              disabled={!formState.has_variants}
              status={getError(validationState, variantId, "name").status}
              onChange={(event) =>
                onVariantUpdate(variantId, { name: event.target.value })
              }
            />
            {getError(validationState, variantId, "name").help && (
              <Text type="danger">
                {getError(validationState, variantId, "name").help}
              </Text>
            )}
          </Col>
          <Col xs={24} md={8}>
            <Text strong>SKU</Text>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={variant.sku}
                status={getError(validationState, variantId, "sku").status}
                onChange={(event) =>
                  onVariantUpdate(variantId, { sku: event.target.value })
                }
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => onGenerateSKU(variantId)}
              />
            </Space.Compact>
            {getError(validationState, variantId, "sku").help && (
              <Text type="danger">
                {getError(validationState, variantId, "sku").help}
              </Text>
            )}
          </Col>
          <Col xs={24} md={8}>
            <Text strong>Barcode</Text>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={variant.barcode}
                status={getError(validationState, variantId, "barcode").status}
                onChange={(event) =>
                  onVariantUpdate(variantId, { barcode: event.target.value })
                }
              />
              <Button
                icon={<BarcodeOutlined />}
                onClick={() => onGenerateBarcode(variantId)}
              />
            </Space.Compact>
            {getError(validationState, variantId, "barcode").help && (
              <Text type="danger">
                {getError(validationState, variantId, "barcode").help}
              </Text>
            )}
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Text strong>Regular Price *</Text>
            <InputNumber
              style={{ width: "100%" }}
              type="number"
              placeholder="0.00"
              min={0}
              precision={2}
              prefix="$"
              value={
                variant.regular_price !== null && variant.regular_price !== ""
                  ? Number(variant.regular_price)
                  : undefined
              }
              status={
                getError(validationState, variantId, "regular_price").status
              }
              onChange={(value) =>
                onVariantUpdate(variantId, { regular_price: value })
              }
            />
            {getError(validationState, variantId, "regular_price").help && (
              <Text type="danger">
                {getError(validationState, variantId, "regular_price").help}
              </Text>
            )}
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong>Wholesale Price</Text>
            <InputNumber
              style={{ width: "100%" }}
              type="number"
              placeholder="0.00"
              min={0}
              precision={2}
              prefix="$"
              value={
                variant.wholesale_price !== null &&
                variant.wholesale_price !== undefined &&
                variant.wholesale_price !== ""
                  ? Number(variant.wholesale_price)
                  : undefined
              }
              status={
                getError(validationState, variantId, "wholesale_price").status
              }
              onChange={(value) =>
                onVariantUpdate(variantId, { wholesale_price: value })
              }
            />
            {getError(validationState, variantId, "wholesale_price").help && (
              <Text type="danger">
                {getError(validationState, variantId, "wholesale_price").help}
              </Text>
            )}
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong>Sale Unit *</Text>
            <MasterDataSelector
              type="unit"
              label="Unit"
              value={variant.sale_unit_id}
              status={
                getError(validationState, variantId, "sale_unit_id").status
              }
              onChange={(value) =>
                onVariantUpdate(variantId, { sale_unit_id: value })
              }
            />
            {getError(validationState, variantId, "sale_unit_id").help && (
              <Text type="danger">
                {getError(validationState, variantId, "sale_unit_id").help}
              </Text>
            )}
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong>Purchase Unit *</Text>
            <MasterDataSelector
              type="unit"
              label="Unit"
              value={variant.purchase_unit_id}
              status={
                getError(validationState, variantId, "purchase_unit_id").status
              }
              onChange={(value) =>
                onVariantUpdate(variantId, { purchase_unit_id: value })
              }
            />
            {getError(validationState, variantId, "purchase_unit_id").help && (
              <Text type="danger">
                {getError(validationState, variantId, "purchase_unit_id").help}
              </Text>
            )}
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Text strong>
              <Space size={4}>
                <AlertOutlined />
                Alert Quantity
              </Space>
            </Text>
            <InputNumber
              style={{ width: "100%" }}
              type="number"
              placeholder="10"
              min={0}
              value={variant.alert_quantity}
              onChange={(value) =>
                onVariantUpdate(variantId, {
                  alert_quantity: Number(value || 0),
                })
              }
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong>
              <Space size={4}>
                <AimOutlined />
                Daily Target
              </Space>
            </Text>
            <InputNumber
              style={{ width: "100%" }}
              type="number"
              placeholder="0"
              min={0}
              value={variant.daily_sale_objective}
              onChange={(value) =>
                onVariantUpdate(variantId, {
                  daily_sale_objective: Number(value || 0),
                })
              }
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text strong>Warranty (months)</Text>
            <InputNumber
              style={{ width: "100%" }}
              type="number"
              placeholder="12"
              min={0}
              max={120}
              value={variant.warranty_period}
              onChange={(value) =>
                onVariantUpdate(variantId, { warranty_period: value })
              }
            />
          </Col>
          <Col xs={24} md={6}>
            <Text strong>Image</Text>
            <ImageInput
              name={`variant-image-${variantId}`}
              useForm={false}
              maxCount={1}
              listType="text"
              value={variant.image ? [variant.image] : []}
              onChange={(urls) =>
                onVariantUpdate(variantId, { image: urls[0] || null })
              }
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Tabs
          items={[
            ...(!isEditMode
              ? [
                  {
                    key: "batches",
                    label: `Add Inventory (${variant.batches.length})`,
                    children: (
                      <VariantBatchSection
                        variantId={variantId}
                        variantName={variant.name}
                        branches={branches}
                        batches={variant.batches}
                        validationState={validationState}
                        onChange={(batches) =>
                          onUpdateBatches(variantId, batches)
                        }
                      />
                    ),
                  },
                ]
              : []),
            {
              key: "attributes",
              label: `Attributes (${variant.attributes.length})`,
              children: (
                <VariantAttributesSection
                  variantId={variantId}
                  attributes={variant.attributes}
                  validationState={validationState}
                  onAdd={() =>
                    onAddAttribute(variantId, { name: "", value: "" })
                  }
                  onUpdate={(index, updates) =>
                    onUpdateAttribute(variantId, index, updates)
                  }
                  onDelete={(index) => onDeleteAttribute(variantId, index)}
                />
              ),
            },
            {
              key: "serials",
              label: `Serials (${variant.serials.length})`,
              children: (
                <VariantSerialsSection
                  variantId={variantId}
                  serials={variant.serials}
                  validationState={validationState}
                  onAdd={() =>
                    onAddSerial(variantId, {
                      serial_number: "",
                      status: "available",
                    })
                  }
                  onUpdate={(index, updates) =>
                    onUpdateSerial(variantId, index, updates)
                  }
                  onDelete={(index) => onDeleteSerial(variantId, index)}
                />
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
