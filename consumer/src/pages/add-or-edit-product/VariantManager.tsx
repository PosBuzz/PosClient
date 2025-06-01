import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  MinusCircleOutlined,
  AlertOutlined,
  BarcodeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Space,
  Typography,
  Select,
  Tooltip,
} from "antd";
import {
  ProductVariant,
  VariantAttribute,
  ProductSerial,
} from "../../types/product.types";
import CommonSelector from "./CommonSelector";
import ImageInput from "../../components/ImageInput";
import BatchAddingForm, { BatchData } from "../../components/BatchAddingForm";
import { useEffect } from "react";

const { Title, Text } = Typography;
const { Option } = Select;

interface VariantManagerProps {
  variants: ProductVariant[];
  updateVariant: (index: number, variantData: Partial<ProductVariant>) => void;
  addVariant: () => number;
  deleteVariant: (index: number) => void;
  productName?: string;
  isEditMode?: boolean;
}

export default function VariantManager({
  variants,
  updateVariant,
  addVariant,
  deleteVariant,
  productName,
  isEditMode = false,
}: VariantManagerProps) {
  if (variants.length === 0) {
    return (
      <div className="text-center py-8">
        <Alert
          message="No variants added"
          description="Add your first variant to get started"
          type="info"
          showIcon
          className="mb-4"
        />
        <Button type="primary" onClick={addVariant} icon={<PlusOutlined />}>
          Add First Variant
        </Button>
      </div>
    );
  }

  // Auto-generate SKU for variant
  const generateSKU = (variantIndex: number) => {
    const baseName = productName || `Variant${variantIndex + 1}`;
    const timestamp = Date.now().toString().slice(-6);
    const prefix = baseName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3)
      .padEnd(3, "0");
    const sku = `${prefix}-V${variantIndex + 1}-${timestamp}`;
    updateVariant(variantIndex, { sku });
  };

  // Auto-generate barcode for variant
  const generateBarcode = (variantIndex: number) => {
    const countryCode = "123";
    const manufacturerCode = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    const productCode = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const baseNumber = countryCode + manufacturerCode + productCode;

    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(baseNumber[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const barcode = baseNumber + checkDigit;
    updateVariant(variantIndex, { barcode });
  };

  const updateVariantAttribute = (
    variantIndex: number,
    attrIndex: number,
    field: keyof VariantAttribute,
    value: string
  ) => {
    const variant = variants[variantIndex];
    const newAttributes = [...(variant.attributes || [])];
    newAttributes[attrIndex] = { ...newAttributes[attrIndex], [field]: value };
    updateVariant(variantIndex, { attributes: newAttributes });
  };

  const addVariantAttribute = (variantIndex: number) => {
    const variant = variants[variantIndex];
    const newAttributes = [
      ...(variant.attributes || []),
      { name: "", value: "" },
    ];
    updateVariant(variantIndex, { attributes: newAttributes });
  };

  const removeVariantAttribute = (variantIndex: number, attrIndex: number) => {
    const variant = variants[variantIndex];
    const newAttributes = (variant.attributes || []).filter(
      (_, i) => i !== attrIndex
    );
    updateVariant(variantIndex, { attributes: newAttributes });
  };

  const updateVariantSerial = (
    variantIndex: number,
    serialIndex: number,
    field: keyof ProductSerial,
    value: string
  ) => {
    const variant = variants[variantIndex];
    const newSerials = [...(variant.serials || [])];
    newSerials[serialIndex] = { ...newSerials[serialIndex], [field]: value };
    updateVariant(variantIndex, { serials: newSerials });
  };

  const addVariantSerial = (variantIndex: number) => {
    const variant = variants[variantIndex];
    const newSerials = [
      ...(variant.serials || []),
      { serial_number: "", status: "available" as const },
    ];
    updateVariant(variantIndex, { serials: newSerials });
  };

  const removeVariantSerial = (variantIndex: number, serialIndex: number) => {
    const variant = variants[variantIndex];
    const newSerials = (variant.serials || []).filter(
      (_, i) => i !== serialIndex
    );
    updateVariant(variantIndex, { serials: newSerials });
  };

  // Batch handling function
  const handleVariantBatchesChange = (
    variantIndex: number,
    batches: BatchData[]
  ) => {
    updateVariant(variantIndex, { batches });
  };

  const parentForm = Form.useFormInstance();
  useEffect(() => {}, [parentForm]);

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Compact header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Title level={5} style={{ margin: 0, fontSize: 14 }}>
          <Space size={4}>
            <SettingOutlined />
            Product Variants
            <Badge count={variants.length} showZero color="blue" />
          </Space>
        </Title>
        <Button
          type="dashed"
          onClick={addVariant}
          icon={<PlusOutlined />}
          size="small"
          style={{ height: 28 }}
        >
          Add Variant
        </Button>
      </div>

      {/* Compact variant cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {variants.map((variant, index) => (
          <Card
            key={`variant-${index}`}
            size="small"
            style={{ marginBottom: 0 }}
            title={
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong style={{ fontSize: 12 }}>
                  Variant {index + 1}
                </Text>
                {variants.length > 1 && (
                  <Popconfirm
                    title="Delete variant"
                    description="Are you sure?"
                    onConfirm={() => deleteVariant(index)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      style={{ height: 24 }}
                    />
                  </Popconfirm>
                )}
              </div>
            }
            bodyStyle={{ padding: 12 }}
          >
            {/* Compact Row 1: Variant Name, SKU, Barcode */}
            <Row gutter={[6, 4]}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Variant Name"
                  required
                  style={{ marginBottom: 4 }}
                >
                  <Input
                    size="small"
                    placeholder={`Variant ${index + 1} name`}
                    value={variant.name}
                    onChange={(e) =>
                      updateVariant(index, { name: e.target.value })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="SKU" style={{ marginBottom: 4 }}>
                  <Input
                    size="small"
                    placeholder="Auto-generate or enter SKU"
                    value={variant.sku || ""}
                    onChange={(e) =>
                      updateVariant(index, { sku: e.target.value })
                    }
                    suffix={
                      <Tooltip title="Generate SKU">
                        <Button
                          type="text"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => generateSKU(index)}
                        />
                      </Tooltip>
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label={
                    <Space size={2}>
                      <BarcodeOutlined />
                      Barcode
                    </Space>
                  }
                  style={{ marginBottom: 4 }}
                >
                  <Input
                    size="small"
                    placeholder="Auto-generate or enter barcode"
                    value={variant.barcode || ""}
                    onChange={(e) =>
                      updateVariant(index, { barcode: e.target.value })
                    }
                    suffix={
                      <Tooltip title="Generate EAN-13">
                        <Button
                          type="text"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => generateBarcode(index)}
                        />
                      </Tooltip>
                    }
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Compact Row 2: All pricing, units, and settings in one row */}
            <Row gutter={[4, 4]}>
              <Col xs={12} sm={4}>
                <Form.Item
                  label="Regular Price"
                  required
                  style={{ marginBottom: 4 }}
                >
                  <InputNumber
                    size="small"
                    type="number"
                    placeholder="0.00"
                    min={0}
                    precision={2}
                    style={{ width: "100%" }}
                    prefix="$"
                    value={variant.regular_price}
                    onChange={(value) =>
                      updateVariant(index, { regular_price: value })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={12} sm={4}>
                <Form.Item label="Wholesale Price" style={{ marginBottom: 4 }}>
                  <InputNumber
                    size="small"
                    type="number"
                    placeholder="0.00"
                    min={0}
                    precision={2}
                    style={{ width: "100%" }}
                    prefix="$"
                    value={variant.wholesale_price}
                    onChange={(value) =>
                      updateVariant(index, { wholesale_price: value })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={12} sm={3}>
                <Form.Item
                  label={
                    <Space size={2}>
                      <AlertOutlined />
                      Alert Qty
                    </Space>
                  }
                  style={{ marginBottom: 4 }}
                >
                  <InputNumber
                    size="small"
                    type="number"
                    placeholder="10"
                    min={0}
                    style={{ width: "100%" }}
                    value={variant.alert_quantity}
                    onChange={(value) =>
                      updateVariant(index, { alert_quantity: value || 0 })
                    }
                    addonAfter="units"
                  />
                </Form.Item>
              </Col>
              <Col xs={12} sm={3}>
                <CommonSelector
                  label="Sale Unit"
                  type="unit"
                  value={Number(variant.sale_unit_id) || undefined}
                  onChange={(value) =>
                    updateVariant(index, { sale_unit_id: value as number })
                  }
                  size="small"
                />
              </Col>
              <Col xs={12} sm={3}>
                <CommonSelector
                  label="Purchase Unit"
                  type="unit"
                  value={Number(variant.purchase_unit_id) || undefined}
                  onChange={(value) =>
                    updateVariant(index, {
                      purchase_unit_id: value as number,
                    })
                  }
                  size="small"
                />
              </Col>
              <Col xs={12} sm={3}>
                <Form.Item label="Warranty" style={{ marginBottom: 4 }}>
                  <InputNumber
                    size="small"
                    type="number"
                    placeholder="12"
                    min={0}
                    style={{ width: "100%" }}
                    value={variant.warranty_period}
                    onChange={(value) =>
                      updateVariant(index, {
                        warranty_period: value || undefined,
                      })
                    }
                    addonAfter="mo"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={4}>
                <Form.Item label="Image" style={{ marginBottom: 4 }}>
                  <ImageInput
                    name={`variant-image-${index}`}
                    label=""
                    value={variant.image ? [variant.image] : []}
                    onChange={(urls) =>
                      updateVariant(index, { image: urls[0] || "" })
                    }
                    maxCount={1}
                    useForm={false}
                    listType="text"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Compact Attributes Section */}
            {(variant.attributes || []).length > 0 ? (
              <Card
                size="small"
                style={{ marginTop: 6 }}
                title={
                  <Space size={4}>
                    <Text strong style={{ fontSize: 11 }}>
                      Attributes ({(variant.attributes || []).length})
                    </Text>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => addVariantAttribute(index)}
                      style={{ height: 20, fontSize: 10 }}
                    >
                      Add
                    </Button>
                  </Space>
                }
                bodyStyle={{ padding: 8 }}
              >
                <Row gutter={[4, 2]}>
                  {(variant.attributes || []).map((attr, attrIndex) => (
                    <Col xs={24} sm={12} md={8} key={attrIndex}>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          alignItems: "center",
                        }}
                      >
                        <Input
                          placeholder="Name"
                          value={attr.name}
                          size="small"
                          style={{ flex: 1 }}
                          onChange={(e) =>
                            updateVariantAttribute(
                              index,
                              attrIndex,
                              "name",
                              e.target.value
                            )
                          }
                        />
                        <Input
                          placeholder="Value"
                          value={attr.value}
                          size="small"
                          style={{ flex: 1 }}
                          onChange={(e) =>
                            updateVariantAttribute(
                              index,
                              attrIndex,
                              "value",
                              e.target.value
                            )
                          }
                        />
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<MinusCircleOutlined />}
                          onClick={() =>
                            removeVariantAttribute(index, attrIndex)
                          }
                          style={{ minWidth: 24, height: 24 }}
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            ) : (
              <div style={{ marginTop: 6 }}>
                <Button
                  type="dashed"
                  size="small"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => addVariantAttribute(index)}
                  style={{ height: 28 }}
                >
                  Add Attributes
                </Button>
              </div>
            )}

            {/* Compact Serial Numbers Section */}
            {(variant.serials || []).length > 0 ? (
              <Card
                size="small"
                style={{ marginTop: 6 }}
                title={
                  <Space size={4}>
                    <Text strong style={{ fontSize: 11 }}>
                      Serial Numbers ({(variant.serials || []).length})
                    </Text>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => addVariantSerial(index)}
                      style={{ height: 20, fontSize: 10 }}
                    >
                      Add
                    </Button>
                  </Space>
                }
                bodyStyle={{ padding: 8 }}
              >
                {(variant.serials || []).map((serial, serialIndex) => (
                  <Row
                    key={serialIndex}
                    gutter={[4, 2]}
                    align="middle"
                    style={{ marginBottom: 2 }}
                  >
                    <Col xs={10} sm={8}>
                      <Input
                        placeholder="Serial #"
                        value={serial.serial_number}
                        size="small"
                        onChange={(e) =>
                          updateVariantSerial(
                            index,
                            serialIndex,
                            "serial_number",
                            e.target.value
                          )
                        }
                      />
                    </Col>
                    <Col xs={6} sm={4}>
                      <Select
                        value={serial.status}
                        onChange={(value) =>
                          updateVariantSerial(
                            index,
                            serialIndex,
                            "status",
                            value
                          )
                        }
                        style={{ width: "100%" }}
                        size="small"
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
                        value={serial.notes || ""}
                        size="small"
                        onChange={(e) =>
                          updateVariantSerial(
                            index,
                            serialIndex,
                            "notes",
                            e.target.value
                          )
                        }
                      />
                    </Col>
                    <Col xs={2}>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<MinusCircleOutlined />}
                        onClick={() => removeVariantSerial(index, serialIndex)}
                        style={{ minWidth: 24, height: 24 }}
                      />
                    </Col>
                  </Row>
                ))}
              </Card>
            ) : (
              <div style={{ marginTop: 6 }}>
                <Button
                  type="dashed"
                  size="small"
                  block
                  icon={<BarcodeOutlined />}
                  onClick={() => addVariantSerial(index)}
                  style={{ height: 28 }}
                >
                  Add Serial Numbers
                </Button>
              </div>
            )}

            {/* Compact Inventory/Batch Section - Hidden in Edit Mode */}
            {!isEditMode && (
              <BatchAddingForm
                batches={variant.batches || []}
                onBatchesChange={(batches) =>
                  handleVariantBatchesChange(index, batches)
                }
                variantName={variant.name}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
