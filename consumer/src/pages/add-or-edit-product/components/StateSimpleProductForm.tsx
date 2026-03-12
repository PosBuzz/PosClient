import React from "react";
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
  Divider,
  Alert,
} from "antd";
import {
  AlertOutlined,
  AimOutlined,
  BarcodeOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  ProductFormState,
  ValidationState,
} from "../hooks/useProductFormState";
import { getValidationStatus } from "../utils/validation";
import { FormAttribute, FormSerial } from "../../../types/product.types";
import ImageInput from "../../../components/ImageInput";
import CommonSelector from "../CommonSelector";
import StateBatchAddingForm, { BatchData } from "./StateBatchAddingForm";

const { Text } = Typography;
const { Option } = Select;

interface StateSimpleProductFormProps {
  formState: ProductFormState;
  validationState: ValidationState;
  variantId: string;
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
  onGenerateSKU: (variantId: string) => void;
  onGenerateBarcode: (variantId: string) => void;
  onBatchesChange: (variantId: string, batches: BatchData[]) => void;
  isEditMode?: boolean;
}

const StateSimpleProductForm: React.FC<StateSimpleProductFormProps> = ({
  formState,
  validationState,
  variantId,
  onVariantUpdate,
  onAddVariantAttribute,
  onUpdateVariantAttribute,
  onDeleteVariantAttribute,
  onAddVariantSerial,
  onUpdateVariantSerial,
  onDeleteVariantSerial,
  onGenerateSKU,
  onGenerateBarcode,
  onBatchesChange,
  isEditMode = false,
}) => {
  const variant = formState.variants[variantId];

  if (!variant) {
    return <Alert message="Variant not found" type="error" />;
  }

  const handleFieldUpdate = (field: string, value: any) => {
    onVariantUpdate(variantId, { [field]: value });
  };
  const handleImageChange = (urls: string[]) => {
    handleFieldUpdate("image", urls[0] || null);
  };

  const getFieldValidationStatus = (field: string) => {
    return getValidationStatus(
      `variant_${variantId}_${field}`,
      validationState,
    );
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Row 1: Product Name, SKU, Barcode */}
        <Row gutter={[6, 4]}>
          {" "}
          <Col xs={24} sm={3}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Product Name
              </Text>
              <Input
                size="small"
                value={variant.name}
                onChange={(e) =>
                  onVariantUpdate(variantId, { name: e.target.value })
                }
                disabled={!formState.has_variants}
                placeholder={
                  formState.has_variants
                    ? "Enter variant name"
                    : "Product name will sync from basic info"
                }
                {...getFieldValidationStatus("name")}
              />
              {getFieldValidationStatus("name").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("name").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} sm={3}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                SKU
              </Text>
              <Input
                size="small"
                placeholder="Auto-generate or enter SKU"
                value={variant.sku}
                onChange={(e) => handleFieldUpdate("sku", e.target.value)}
                status={getFieldValidationStatus("sku").status}
                maxLength={50}
                suffix={
                  <Tooltip title="Generate SKU">
                    <Button
                      type="text"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => onGenerateSKU(variantId)}
                    />
                  </Tooltip>
                }
              />
              {getFieldValidationStatus("sku").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("sku").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} sm={3}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Barcode
              </Text>
              <Input
                size="small"
                placeholder="Auto-generate or enter barcode"
                value={variant.barcode}
                onChange={(e) => handleFieldUpdate("barcode", e.target.value)}
                status={getFieldValidationStatus("barcode").status}
                maxLength={20}
                suffix={
                  <Tooltip title="Generate Barcode">
                    <Button
                      type="text"
                      size="small"
                      icon={<BarcodeOutlined />}
                      onClick={() => onGenerateBarcode(variantId)}
                    />
                  </Tooltip>
                }
              />
              {getFieldValidationStatus("barcode").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("barcode").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={12} sm={2}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Regular Price *
              </Text>
              <InputNumber
                type="number"
                size="small"
                placeholder="0.00"
                min={0}
                max={999999.99}
                value={variant.regular_price}
                onChange={(value) => handleFieldUpdate("regular_price", value)}
                style={{ width: "100%" }}
                status={getFieldValidationStatus("regular_price").status}
                precision={2}
                prefix="$"
              />
              {getFieldValidationStatus("regular_price").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("regular_price").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={12} sm={2}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Wholesale Price
              </Text>
              <InputNumber
                type="number"
                size="small"
                placeholder="0.00"
                min={0}
                max={999999.99}
                value={variant.wholesale_price}
                onChange={(value) =>
                  handleFieldUpdate("wholesale_price", value)
                }
                style={{ width: "100%" }}
                status={getFieldValidationStatus("wholesale_price").status}
                precision={2}
                prefix="$"
              />
              {getFieldValidationStatus("wholesale_price").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("wholesale_price").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={12} sm={2}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Sale Unit *
              </Text>{" "}
              <CommonSelector
                label=""
                type="unit"
                value={variant.sale_unit_id}
                onChange={(value) => handleFieldUpdate("sale_unit_id", value)}
                size="small"
              />
              {getFieldValidationStatus("sale_unit_id").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("sale_unit_id").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={12} sm={2}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Purchase Unit *
              </Text>{" "}
              <CommonSelector
                label=""
                type="unit"
                value={variant.purchase_unit_id}
                onChange={(value) =>
                  handleFieldUpdate("purchase_unit_id", value)
                }
                size="small"
              />
              {getFieldValidationStatus("purchase_unit_id").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("purchase_unit_id").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={12} sm={2}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                <Space size={2}>
                  <AlertOutlined />
                  Alert Qty
                </Space>
              </Text>
              <InputNumber
                type="number"
                size="small"
                placeholder="10"
                min={0}
                value={variant.alert_quantity}
                onChange={(value) => handleFieldUpdate("alert_quantity", value)}
                style={{ width: "100%" }}
                addonAfter="units"
                status={getFieldValidationStatus("alert_quantity").status}
              />
              {getFieldValidationStatus("alert_quantity").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("alert_quantity").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={12} sm={2}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                <Space size={2}>
                  <AimOutlined />
                  Daily Target
                </Space>
              </Text>
              <InputNumber
                type="number"
                size="small"
                placeholder="0"
                min={0}
                value={variant.daily_sale_objective || 0}
                onChange={(value) =>
                  handleFieldUpdate("daily_sale_objective", value || 0)
                }
                style={{ width: "100%" }}
                addonAfter="/day"
                status={getFieldValidationStatus("daily_sale_objective").status}
              />
              {getFieldValidationStatus("daily_sale_objective").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("daily_sale_objective").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={12} sm={3}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Warranty
              </Text>
              <InputNumber
                type="number"
                size="small"
                placeholder="12"
                min={0}
                max={120}
                value={variant.warranty_period}
                onChange={(value) =>
                  handleFieldUpdate("warranty_period", value)
                }
                style={{ width: "100%" }}
                addonAfter="months"
                status={getFieldValidationStatus("warranty_period").status}
              />
              {getFieldValidationStatus("warranty_period").help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getFieldValidationStatus("warranty_period").help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} sm={2}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>
                Product Image
              </Text>
              <ImageInput
                name="product-image"
                label=""
                value={variant.image ? [variant.image] : []}
                onChange={handleImageChange}
                maxCount={1}
                useForm={false}
                listType="text"
              />
            </div>
          </Col>
        </Row>
        <Divider style={{ margin: "8px 0" }} /> {/* Attributes Section */}
        <Card
          size="small"
          title={
            <Space size={4}>
              <Text strong style={{ fontSize: 11 }}>
                Attributes ({variant.attributes?.length || 0})
              </Text>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  onAddVariantAttribute(variantId, { name: "", value: "" })
                }
                style={{ height: 20, fontSize: 10 }}
              >
                Add
              </Button>
            </Space>
          }
          styles={{ body: { padding: 8 } }}
        >
          {variant.attributes && variant.attributes.length > 0 ? (
            <Row gutter={[4, 2]}>
              {variant.attributes.map((attr, index) => (
                <Col xs={24} sm={12} md={8} key={index}>
                  <div
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <Input
                      placeholder="Name"
                      size="small"
                      value={attr.name}
                      onChange={(e) =>
                        onUpdateVariantAttribute(variantId, index, {
                          name: e.target.value,
                        })
                      }
                      style={{ flex: 1 }}
                      maxLength={50}
                      status={
                        getValidationStatus(
                          `variant_${variantId}_attr_${index}_name`,
                          validationState,
                        ).status
                      }
                    />
                    <Input
                      placeholder="Value"
                      size="small"
                      value={attr.value}
                      onChange={(e) =>
                        onUpdateVariantAttribute(variantId, index, {
                          value: e.target.value,
                        })
                      }
                      style={{ flex: 1 }}
                      maxLength={100}
                      status={
                        getValidationStatus(
                          `variant_${variantId}_attr_${index}_value`,
                          validationState,
                        ).status
                      }
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => onDeleteVariantAttribute(variantId, index)}
                      style={{ minWidth: 24, height: 24 }}
                    />
                  </div>
                  <div>
                    {getValidationStatus(
                      `variant_${variantId}_attr_${index}_name`,
                      validationState,
                    ).help && (
                      <Text type="danger" style={{ fontSize: 10 }}>
                        {
                          getValidationStatus(
                            `variant_${variantId}_attr_${index}_name`,
                            validationState,
                          ).help
                        }
                      </Text>
                    )}
                    {getValidationStatus(
                      `variant_${variantId}_attr_${index}_value`,
                      validationState,
                    ).help && (
                      <Text type="danger" style={{ fontSize: 10 }}>
                        {
                          getValidationStatus(
                            `variant_${variantId}_attr_${index}_value`,
                            validationState,
                          ).help
                        }
                      </Text>
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>
              No attributes added. Click 'Add' to add product attributes.
            </Text>
          )}
        </Card>
        {/* Serial Numbers Section */}
        <Card
          size="small"
          title={
            <Space size={4}>
              <Text strong style={{ fontSize: 11 }}>
                Serial Numbers ({variant.serials?.length || 0})
              </Text>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  onAddVariantSerial(variantId, {
                    serial_number: "",
                    status: "available",
                    notes: "",
                  })
                }
                style={{ height: 20, fontSize: 10 }}
              >
                Add
              </Button>
            </Space>
          }
          styles={{ body: { padding: 8 } }}
        >
          {variant.serials && variant.serials.length > 0 ? (
            variant.serials.map((serial, index) => (
              <Row
                key={index}
                gutter={[4, 2]}
                align="middle"
                style={{ marginBottom: 2 }}
              >
                <Col xs={10} sm={8}>
                  <Input
                    placeholder="Serial #"
                    size="small"
                    value={serial.serial_number}
                    onChange={(e) =>
                      onUpdateVariantSerial(variantId, index, {
                        serial_number: e.target.value,
                      })
                    }
                    maxLength={50}
                    status={
                      getValidationStatus(
                        `variant_${variantId}_serial_${index}_serial_number`,
                        validationState,
                      ).status
                    }
                  />
                  {getValidationStatus(
                    `variant_${variantId}_serial_${index}_serial_number`,
                    validationState,
                  ).help && (
                    <Text type="danger" style={{ fontSize: 10 }}>
                      {
                        getValidationStatus(
                          `variant_${variantId}_serial_${index}_serial_number`,
                          validationState,
                        ).help
                      }
                    </Text>
                  )}
                </Col>
                <Col xs={6} sm={3}>
                  <Select
                    style={{ width: "100%" }}
                    size="small"
                    placeholder="Status"
                    value={serial.status}
                    onChange={(value) =>
                      onUpdateVariantSerial(variantId, index, { status: value })
                    }
                  >
                    <Option value="available">Available</Option>
                    <Option value="sold">Sold</Option>
                    <Option value="defective">Defective</Option>
                    <Option value="returned">Returned</Option>
                  </Select>
                </Col>
                <Col xs={6} sm={8}>
                  <Input
                    placeholder="Notes"
                    size="small"
                    value={serial.notes}
                    onChange={(e) =>
                      onUpdateVariantSerial(variantId, index, {
                        notes: e.target.value,
                      })
                    }
                    maxLength={200}
                    status={
                      getValidationStatus(
                        `variant_${variantId}_serial_${index}_notes`,
                        validationState,
                      ).status
                    }
                  />
                  {getValidationStatus(
                    `variant_${variantId}_serial_${index}_notes`,
                    validationState,
                  ).help && (
                    <Text type="danger" style={{ fontSize: 10 }}>
                      {
                        getValidationStatus(
                          `variant_${variantId}_serial_${index}_notes`,
                          validationState,
                        ).help
                      }
                    </Text>
                  )}
                </Col>
                <Col xs={2}>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<MinusCircleOutlined />}
                    onClick={() => onDeleteVariantSerial(variantId, index)}
                    style={{ minWidth: 24, height: 24 }}
                  />
                </Col>
              </Row>
            ))
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>
              No serial numbers added. Click 'Add' to add serial numbers.
            </Text>
          )}{" "}
        </Card>{" "}
        {/* Inventory Management Section - Hidden in edit mode */}
        {!isEditMode && (
          <StateBatchAddingForm
            variantName={variant.name}
            batches={variant.batches || []}
            onBatchesChange={(batches) => onBatchesChange(variantId, batches)}
            disabled={false}
            size="small"
            validationState={validationState}
            variantId={variantId}
          />
        )}
      </div>
    </div>
  );
};

export default StateSimpleProductForm;
