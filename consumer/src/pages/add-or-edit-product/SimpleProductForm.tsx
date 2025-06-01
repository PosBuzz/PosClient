import {
  AlertOutlined,
  BarcodeOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tooltip,
  Typography
} from "antd";
import { useCallback, useEffect } from "react";
import ImageInput from "../../components/ImageInput";
import {
  ProductSerial,
  ProductVariant,
  VariantAttribute,
} from "../../types/product.types";
import CommonSelector from "./CommonSelector";

const { Text, Title } = Typography;
const { Option } = Select;

interface SimpleProductFormProps {
  variant: ProductVariant;
  updateVariant: (variantData: Partial<ProductVariant>) => void;
  productName?: string;
}

export default function SimpleProductForm({
  variant,
  updateVariant,
  productName,
}: SimpleProductFormProps) {
  // Sync variant name with product name
  useEffect(() => {
    if (productName && variant.name !== productName) {
      updateVariant({ name: productName, is_default: true });
    }
  }, [productName, variant.name, updateVariant]);

  const handleFieldChange = useCallback(
    <K extends keyof ProductVariant>(field: K, value: ProductVariant[K]) => {
      updateVariant({ [field]: value });
    },
    [updateVariant]
  );

  // Auto-generate SKU for simple product
  const generateSKU = () => {
    const baseName = productName || "Product";
    const timestamp = Date.now().toString().slice(-6);
    const prefix = baseName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3)
      .padEnd(3, "0");
    const sku = `${prefix}-SKU-${timestamp}`;
    handleFieldChange("sku", sku);
  };

  // Auto-generate barcode for simple product
  const generateBarcode = () => {
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
    handleFieldChange("barcode", barcode);
  };

  const updateVariantAttribute = (
    attrIndex: number,
    field: keyof VariantAttribute,
    value: string
  ) => {
    const newAttributes = [...(variant.attributes || [])];
    newAttributes[attrIndex] = { ...newAttributes[attrIndex], [field]: value };
    updateVariant({ attributes: newAttributes });
  };

  const addVariantAttribute = () => {
    const newAttributes = [
      ...(variant.attributes || []),
      { name: "", value: "" },
    ];
    updateVariant({ attributes: newAttributes });
  };

  const removeVariantAttribute = (attrIndex: number) => {
    const newAttributes = (variant.attributes || []).filter(
      (_, i) => i !== attrIndex
    );
    updateVariant({ attributes: newAttributes });
  };

  const updateVariantSerial = (
    serialIndex: number,
    field: keyof ProductSerial,
    value: string
  ) => {
    const newSerials = [...(variant.serials || [])];
    newSerials[serialIndex] = { ...newSerials[serialIndex], [field]: value };
    updateVariant({ serials: newSerials });
  };

  const addVariantSerial = () => {
    const newSerials = [
      ...(variant.serials || []),
      { serial_number: "", status: "available" as const },
    ];
    updateVariant({ serials: newSerials });
  };

  const removeVariantSerial = (serialIndex: number) => {
    const newSerials = (variant.serials || []).filter(
      (_, i) => i !== serialIndex
    );
    updateVariant({ serials: newSerials });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <Space>
            <SettingOutlined />
            Simple Product Configuration
          </Space>
        </Title>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card
          size="small"
          title="Product Details"
        >
          <Form layout="vertical">
            {/* Row 1: Product Name (readonly), SKU, Barcode */}
            <Row gutter={8}>
              <Col xs={24} sm={8}>
                <Form.Item 
                  label="Product Name" 
                  style={{ marginBottom: 8 }}
                >
                  <Input
                    value={variant.name || productName}
                    disabled
                    placeholder="Product name will sync from basic info"
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
                    onChange={(e) => handleFieldChange("sku", e.target.value)}
                    suffix={
                      <Tooltip title="Generate SKU">
                        <Button
                          type="text"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={generateSKU}
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
                    onChange={(e) => handleFieldChange("barcode", e.target.value)}
                    suffix={
                      <Tooltip title="Generate EAN-13">
                        <Button
                          type="text"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={generateBarcode}
                        />
                      </Tooltip>
                    }
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Row 2: Pricing & Inventory */}
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
                    onChange={(value) => handleFieldChange("regular_price", value)}
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
                    onChange={(value) => handleFieldChange("wholesale_price", value)}
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
                    onChange={(value) => handleFieldChange("alert_quantity", value || 0)}
                    addonAfter="units"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={4}>
                <CommonSelector
                  label="Sale Unit"
                  type="unit"
                  value={Number(variant.sale_unit_id) || undefined}
                  onChange={(value) => handleFieldChange("sale_unit_id", value as number)}
                />
              </Col>
              <Col xs={24} sm={4}>
                <CommonSelector
                  label="Purchase Unit"
                  type="unit"
                  value={Number(variant.purchase_unit_id) || undefined}
                  onChange={(value) => handleFieldChange("purchase_unit_id", value as number)}
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
                    onChange={(value) => handleFieldChange("warranty_period", value)}
                    addonAfter="months"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Row 3: Image */}
            <Row>
              <Col span={4}>
                <Form.Item 
                  label="Product Image" 
                  style={{ marginBottom: 8 }}
                >
                  <ImageInput
                    name="product-image"
                    label=""
                    value={variant.image ? [variant.image] : []}
                    onChange={(urls) => handleFieldChange("image", urls[0] || "")}
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
                    onClick={addVariantAttribute}
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
                        updateVariantAttribute(attrIndex, "name", e.target.value)
                      }
                    />
                  </Col>
                  <Col xs={10}>
                    <Input
                      placeholder="Value"
                      value={attr.value}
                      size="small"
                      onChange={(e) =>
                        updateVariantAttribute(attrIndex, "value", e.target.value)
                      }
                    />
                  </Col>
                  <Col xs={4}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeVariantAttribute(attrIndex)}
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
                onClick={addVariantAttribute}
              >
                <PlusOutlined /> Add Attribute
              </Button>
            </div>
          )}

          {/* Serial Numbers - Compact Section */}
          {(variant.serials || []).length > 0 ? (
            <Card
              size="small"
              style={{ marginTop: 8 }}
              title={
                <Space>
                  <Text strong style={{ fontSize: 12 }}>
                    Serial Numbers ({(variant.serials || []).length})
                  </Text>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={addVariantSerial}
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
                        updateVariantSerial(serialIndex, "serial_number", e.target.value)
                      }
                    />
                  </Col>
                  <Col xs={6}>
                    <Select
                      value={serial.status}
                      onChange={(value) =>
                        updateVariantSerial(serialIndex, "status", value)
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
                        updateVariantSerial(serialIndex, "notes", e.target.value)
                      }
                    />
                  </Col>
                  <Col xs={2}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeVariantSerial(serialIndex)}
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
                onClick={addVariantSerial}
              >
                <BarcodeOutlined /> Add Serial Number
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}