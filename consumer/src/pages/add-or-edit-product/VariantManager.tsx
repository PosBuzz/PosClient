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

const { Title, Text } = Typography;
const { Option } = Select;

interface VariantManagerProps {
  variants: ProductVariant[];
  updateVariant: (index: number, variantData: Partial<ProductVariant>) => void;
  addVariant: () => number;
  deleteVariant: (index: number) => void;
  productName?: string;
}

export default function VariantManager({
  variants,
  updateVariant,
  addVariant,
  deleteVariant,
  productName,
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

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <Space>
            <SettingOutlined />
            Product Variants
            <Badge count={variants.length} showZero color="blue" />
          </Space>
        </Title>
        <Button type="dashed" onClick={addVariant} icon={<PlusOutlined />} size="small">
          Add Variant
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {variants.map((variant, index) => (
          <Card
            key={`variant-${index}`}
            size="small"
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: 14 }}>
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
                    />
                  </Popconfirm>
                )}
              </div>
            }
          >
            <Form layout="vertical" size="small">
              {/* Row 1: Variant Name, SKU, Barcode */}
              <Row gutter={8}>
                <Col xs={24} sm={8}>
                  <Form.Item 
                    label="Variant Name" 
                    required
                    style={{ marginBottom: 8 }}
                  >
                    <Input
                      placeholder={`Variant ${index + 1} name`}
                      value={variant.name}
                      onChange={(e) => updateVariant(index, { name: e.target.value })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item 
                    label="SKU" 
                    style={{ marginBottom: 8 }}
                  >
                    <Input
                      placeholder="Auto-generate or enter SKU"
                      value={variant.sku || ""}
                      onChange={(e) => updateVariant(index, { sku: e.target.value })}
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
                      <Space>
                        <BarcodeOutlined />
                        Barcode
                      </Space>
                    }
                    style={{ marginBottom: 8 }}
                  >
                    <Input
                      placeholder="Auto-generate or enter barcode"
                      value={variant.barcode || ""}
                      onChange={(e) => updateVariant(index, { barcode: e.target.value })}
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

              {/* Row 2: Pricing */}
              <Row gutter={4}>
                <Col xs={24} sm={4}>
                  <Form.Item 
                    label="Regular Price" 
                    required
                    style={{ marginBottom: 8 }}
                  >
                    <InputNumber
                      placeholder="0.00"
                      min={0}
                      precision={2}
                      style={{ width: "100%" }}
                      prefix="$"
                      value={variant.regular_price}
                      onChange={(value) => updateVariant(index, { regular_price: value })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={4}>
                  <Form.Item 
                    label="Wholesale Price" 
                    style={{ marginBottom: 8 }}
                  >
                    <InputNumber
                      placeholder="0.00"
                      min={0}
                      precision={2}
                      style={{ width: "100%" }}
                      prefix="$"
                      value={variant.wholesale_price}
                      onChange={(value) => updateVariant(index, { wholesale_price: value })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={4}>
                  <Form.Item 
                    label={
                      <Space>
                        <AlertOutlined />
                        Alert Quantity
                      </Space>
                    }
                    style={{ marginBottom: 8 }}
                  >
                    <InputNumber
                      placeholder="10"
                      min={0}
                      style={{ width: "100%" }}
                      value={variant.alert_quantity}
                      onChange={(value) => updateVariant(index, { alert_quantity: value || 0 })}
                      addonAfter="units"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={4}>
                    <CommonSelector
                      label="Sale Unit"
                      type="unit"
                      value={Number(variant.sale_unit_id) || undefined}
                      onChange={(value) => updateVariant(index, { sale_unit_id: value as number })}
                      size="small"
                    />
                </Col>
                <Col xs={24} sm={4}>
                    <CommonSelector
                      label="Purchase Unit"
                      type="unit"
                      value={Number(variant.purchase_unit_id) || undefined}
                      onChange={(value) => updateVariant(index, { purchase_unit_id: value as number })}
                      size="small"
                    />
                </Col>
                <Col xs={24} sm={4}>
                  <Form.Item 
                    label="Warranty Period" 
                    style={{ marginBottom: 8 }}
                  >
                    <InputNumber
                      placeholder="12"
                      min={0}
                      style={{ width: "100%" }}
                      value={variant.warranty_period}
                      onChange={(value) => updateVariant(index, { warranty_period: value })}
                      addonAfter="months"
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 4: Image */}
              <Row>
                <Col span={4}>
                  <Form.Item 
                    label="Variant Image" 
                    style={{ marginBottom: 8 }}
                  >
                    <ImageInput
                      name={`variant-image-${index}`}
                      label=""
                      value={variant.image ? [variant.image] : []}
                      onChange={(urls) => updateVariant(index, { image: urls[0] || "" })}
                      maxCount={1}
                      useForm={false}
                      listType="text"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            {/* Attributes - Compact Section */}
            {(variant.attributes || []).length > 0 ? (
              <Card
                size="small"
                style={{ marginTop: 12 }}
                title={
                  <Space>
                    <Text strong style={{ fontSize: 12 }}>
                      Attributes ({(variant.attributes || []).length})
                    </Text>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => addVariantAttribute(index)}
                    >
                      Add
                    </Button>
                  </Space>
                }
              >
                {(variant.attributes || []).map((attr, attrIndex) => (
                  <Row key={attrIndex} gutter={4} align="middle" style={{ marginBottom: 4 }}>
                    <Col xs={10}>
                      <Input
                        placeholder="Name"
                        value={attr.name}
                        size="small"
                        onChange={(e) =>
                          updateVariantAttribute(index, attrIndex, "name", e.target.value)
                        }
                      />
                    </Col>
                    <Col xs={10}>
                      <Input
                        placeholder="Value"
                        value={attr.value}
                        size="small"
                        onChange={(e) =>
                          updateVariantAttribute(index, attrIndex, "value", e.target.value)
                        }
                      />
                    </Col>
                    <Col xs={4}>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<MinusCircleOutlined />}
                        onClick={() => removeVariantAttribute(index, attrIndex)}
                      />
                    </Col>
                  </Row>
                ))}
              </Card>
            ) : (
              <div style={{ marginTop: 12 }}>
                <Button
                  type="dashed"
                  size="small"
                  block
                  onClick={() => addVariantAttribute(index)}
                >
                  <PlusOutlined /> Add Attribute
                </Button>
              </div>
            )}

            {/* Serial Numbers - Compact Section */}
            {(variant.serials || []).length > 0 ? (
              <Card
                size="small"
                style={{ marginTop: 8}}
                title={
                  <Space>
                    <Text strong style={{ fontSize: 12 }}>
                      Serial Numbers ({(variant.serials || []).length})
                    </Text>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => addVariantSerial(index)}
                    >
                      Add
                    </Button>
                  </Space>
                }
              >
                {(variant.serials || []).map((serial, serialIndex) => (
                  <Row key={serialIndex} gutter={4} align="middle" style={{ marginBottom: 4 }}>
                    <Col xs={8}>
                      <Input
                        placeholder="Serial #"
                        value={serial.serial_number}
                        size="small"
                        onChange={(e) =>
                          updateVariantSerial(index, serialIndex, "serial_number", e.target.value)
                        }
                      />
                    </Col>
                    <Col xs={6}>
                      <Select
                        value={serial.status}
                        onChange={(value) =>
                          updateVariantSerial(index, serialIndex, "status", value)
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
                    <Col xs={8}>
                      <Input
                        placeholder="Notes"
                        value={serial.notes || ""}
                        size="small"
                        onChange={(e) =>
                          updateVariantSerial(index, serialIndex, "notes", e.target.value)
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
                      />
                    </Col>
                  </Row>
                ))}
              </Card>
            ) : (
              <div style={{ marginTop: 8 }}>
                <Button
                  type="dashed"
                  size="small"
                  block
                  onClick={() => addVariantSerial(index)}
                >
                  <BarcodeOutlined /> Add Serial Number
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}