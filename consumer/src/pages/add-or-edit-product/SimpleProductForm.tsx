import {
  AlertOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  PictureOutlined,
  PlusOutlined,
  SettingOutlined,
  BarcodeOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Space,
  Typography,
  Select,
  Badge,
  Divider,
} from "antd";
import { useCallback, useEffect } from "react";
import ImageInput from "../../components/ImageInput";
import {
  ProductVariant,
  VariantAttribute,
  ProductSerial,
} from "../../types/product.types";
import CommonSelector from "./CommonSelector";

const { Text } = Typography;
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
    <div className="space-y-6!">
      {/* Pricing Information */}
      <Card
        title={
          <Space>
            <DollarOutlined />
            <span>Pricing</span>
          </Space>
        }
        size="small"
        className="border-green-200"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div>
              <label className="block text-sm font-medium mb-1">
                Cost Price <span className="text-red-500">*</span>
              </label>
              <InputNumber
                placeholder="0.00"
                min={0}
                precision={2}
                className="w-full!"
                prefix="$"
                value={variant.cost_price}
                onChange={(value) => handleFieldChange("cost_price", value)}
              />
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div>
              <label className="block text-sm font-medium mb-1">
                Regular Price <span className="text-red-500">*</span>
              </label>
              <InputNumber
                placeholder="0.00"
                min={0}
                precision={2}
                className="w-full!"
                prefix="$"
                value={variant.regular_price}
                onChange={(value) => handleFieldChange("regular_price", value)}
              />
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div>
              <label className="block text-sm font-medium mb-1">
                Wholesale Price
              </label>
              <InputNumber
                placeholder="0.00"
                min={0}
                precision={2}
                className="w-full!"
                prefix="$"
                value={variant.wholesale_price}
                onChange={(value) =>
                  handleFieldChange("wholesale_price", value)
                }
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Units & Inventory */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>Units, Warranty & Inventory</span>
          </Space>
        }
        size="small"
        className="border-blue-200"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <CommonSelector
              label="Sale Unit"
              type="unit"
              value={Number(variant.sale_unit_id) || undefined}
              onChange={(value) =>
                handleFieldChange("sale_unit_id", value as number)
              }
            />
          </Col>
          <Col xs={24} md={6}>
            <CommonSelector
              label="Purchase Unit"
              type="unit"
              value={Number(variant.purchase_unit_id) || undefined}
              onChange={(value) =>
                handleFieldChange("purchase_unit_id", value as number)
              }
            />
          </Col>
          <Col xs={24} md={6}>
            <div>
              <label className="block text-sm font-medium mb-1">
                Warranty Period (Months)
              </label>
              <InputNumber
                placeholder="12"
                min={0}
                className="w-full!"
                value={variant.warranty_period}
                onChange={(value) =>
                  handleFieldChange("warranty_period", value)
                }
                addonAfter="Months"
              />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div>
              <label className="block text-sm font-medium mb-1">
                <Space>
                  <AlertOutlined />
                  Alert Quantity
                </Space>
              </label>
              <InputNumber
                placeholder="10"
                min={0}
                className="w-full!"
                value={variant.alert_quantity}
                onChange={(value) =>
                  handleFieldChange("alert_quantity", value || 0)
                }
                addonAfter="units"
              />
              <div className="text-xs text-gray-500 mt-1">
                Get alerts when stock is low
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Product Image */}
      <Card
        title={
          <Space>
            <PictureOutlined />
            <span>Product Image</span>
          </Space>
        }
        size="small"
        className="border-purple-200"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <ImageInput
              name="product-image"
              label="Product Image"
              value={variant.image ? [variant.image] : []}
              onChange={(urls) => handleFieldChange("image", urls[0] || "")}
              maxCount={1}
              useForm={false}
            />
          </Col>
        </Row>
      </Card>

      {/* Serial Numbers */}
      <Card
        title={
          <Space>
            <BarcodeOutlined />
            <span>Serial Numbers</span>
            {(variant.serials || []).length > 0 && (
              <Badge count={(variant.serials || []).length} color="green" />
            )}
          </Space>
        }
        size="small"
        className="border-indigo-200"
      >
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <Text type="secondary" className="text-sm">
              Track individual items with serial numbers
            </Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={addVariantSerial}
            >
              Add Serial
            </Button>
          </div>
        </div>

        {(variant.serials || []).length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded">
            <BarcodeOutlined className="text-2xl text-gray-400 mb-2" />
            <Text type="secondary">No serial numbers added</Text>
            <div className="mt-1">
              <Text type="secondary" className="text-xs">
                Add serial numbers for inventory tracking
              </Text>
            </div>
          </div>
        ) : (
          <div className="space-y-3!">
            {(variant.serials || []).map((serial, serialIndex) => (
              <Row key={serialIndex} gutter={12} align="middle">
                <Col xs={8}>
                  <Input
                    placeholder="Serial number"
                    value={serial.serial_number}
                    onChange={(e) =>
                      updateVariantSerial(
                        serialIndex,
                        "serial_number",
                        e.target.value
                      )
                    }
                  />
                </Col>
                <Col xs={6}>
                  <Select
                    value={serial.status}
                    onChange={(value) =>
                      updateVariantSerial(serialIndex, "status", value)
                    }
                    className="w-full"
                  >
                    <Option value="available">Available</Option>
                    <Option value="sold">Sold</Option>
                    <Option value="defective">Defective</Option>
                    <Option value="returned">Returned</Option>
                  </Select>
                </Col>
                <Col xs={8}>
                  <Input
                    placeholder="Notes (optional)"
                    value={serial.notes || ""}
                    onChange={(e) =>
                      updateVariantSerial(serialIndex, "notes", e.target.value)
                    }
                  />
                </Col>
                <Col xs={2}>
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => removeVariantSerial(serialIndex)}
                    title="Remove serial number"
                  />
                </Col>
              </Row>
            ))}
          </div>
        )}
      </Card>

      {/* Additional Information */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>Additional Information</span>
          </Space>
        }
        size="small"
        className="border-orange-200"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <Input
                placeholder="Enter SKU"
                value={variant.sku || ""}
                onChange={(e) => handleFieldChange("sku", e.target.value)}
                className="w-full!"
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div>
              <label className="block text-sm font-medium mb-1">Barcode</label>
              <Input
                placeholder="Enter barcode"
                value={variant.barcode || ""}
                onChange={(e) => handleFieldChange("barcode", e.target.value)}
                className="w-full!"
              />
            </div>
          </Col>
        </Row>

        <Divider />

        {/* Attributes Section */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <Text strong>Product Attributes</Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={addVariantAttribute}
            >
              Add Attribute
            </Button>
          </div>

          {(variant.attributes || []).length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded">
              <Text type="secondary">No attributes added</Text>
              <div className="mt-2">
                <Text type="secondary" className="text-xs">
                  Add attributes like Color, Size, Material, etc.
                </Text>
              </div>
            </div>
          ) : (
            <div className="space-y-3!">
              {(variant.attributes || []).map((attr, attrIndex) => (
                <Row key={attrIndex} gutter={12} align="middle">
                  <Col xs={10}>
                    <Input
                      placeholder="Attribute name (e.g., Color)"
                      value={attr.name}
                      onChange={(e) =>
                        updateVariantAttribute(
                          attrIndex,
                          "name",
                          e.target.value
                        )
                      }
                    />
                  </Col>
                  <Col xs={10}>
                    <Input
                      placeholder="Attribute value (e.g., Red)"
                      value={attr.value}
                      onChange={(e) =>
                        updateVariantAttribute(
                          attrIndex,
                          "value",
                          e.target.value
                        )
                      }
                    />
                  </Col>
                  <Col xs={4}>
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeVariantAttribute(attrIndex)}
                      title="Remove attribute"
                    />
                  </Col>
                </Row>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
