import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  MinusCircleOutlined,
  AlertOutlined,
  BarcodeOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Space,
  Typography,
  Select,
  Divider,
} from "antd";
import { ProductVariant, VariantAttribute, ProductSerial } from "../../types/product.types";
import CommonSelector from "./CommonSelector";
import ImageInput from "../../components/ImageInput";

const { Title, Text } = Typography;
const { Option } = Select;

interface VariantManagerProps {
  variants: ProductVariant[];
  updateVariant: (index: number, variantData: Partial<ProductVariant>) => void;
  addVariant: () => number;
  deleteVariant: (index: number) => void;
}

export default function VariantManager({
  variants,
  updateVariant,
  addVariant,
  deleteVariant,
}: VariantManagerProps) {
  if (variants.length === 0) {
    return (
      <div className="text-center py-12">
        <Alert
          message="No variants added"
          description="Add your first variant to get started"
          type="info"
          showIcon
          className="mb-6"
        />
        <Button type="primary" onClick={addVariant} icon={<PlusOutlined />}>
          Add First Variant
        </Button>
      </div>
    );
  }

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
    <div className="space-y-6!">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          <Space>
            <SettingOutlined />
            Product Variants
            <Badge count={variants.length} showZero color="blue" />
          </Space>
        </Title>
        <Button type="dashed" onClick={addVariant} icon={<PlusOutlined />}>
          Add Variant
        </Button>
      </div>

      <div className="space-y-6!">
        {variants.map((variant, index) => (
          <Card
            key={`variant-${index}`}
            size="small"
            className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow"
            title={
              <div className="flex items-center justify-between">
                <Space>
                  <Text strong className="text-lg">
                    Variant {index + 1}
                  </Text>
                </Space>
                {variants.length > 1 && (
                  <Popconfirm
                    title="Delete variant"
                    description="Are you sure you want to delete this variant?"
                    onConfirm={() => deleteVariant(index)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                )}
              </div>
            }
          >
            <div className="space-y-6!">
              {/* Basic Information */}
              <div>
                <Text strong className="block mb-3">
                  Basic Information
                </Text>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <label className="block text-sm font-medium mb-1">
                      Variant Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder={`Variant ${index + 1} name`}
                      value={variant.name}
                      onChange={(e) =>
                        updateVariant(index, { name: e.target.value })
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <label className="block text-sm font-medium mb-1">
                      SKU
                    </label>
                    <Input
                      placeholder="Variant SKU"
                      value={variant.sku}
                      onChange={(e) =>
                        updateVariant(index, { sku: e.target.value })
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <label className="block text-sm font-medium mb-1">
                      Barcode
                    </label>
                    <Input
                      placeholder="Barcode"
                      value={variant.barcode}
                      onChange={(e) =>
                        updateVariant(index, { barcode: e.target.value })
                      }
                    />
                  </Col>
                </Row>
              </div>

              {/* Pricing */}
              <div>
                <Text strong className="block mb-3">
                  Pricing
                </Text>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
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
                      onChange={(value) =>
                        updateVariant(index, { cost_price: value })
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
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
                      onChange={(value) =>
                        updateVariant(index, { regular_price: value })
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
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
                        updateVariant(index, { wholesale_price: value })
                      }
                    />
                  </Col>
                </Row>
              </div>

              {/* Units, Warranty & Inventory */}
              <div>
                <Text strong className="block mb-3">
                  Units, Warranty & Inventory
                </Text>
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <CommonSelector
                      label="Sale Unit"
                      type="unit"
                      value={variant.sale_unit_id ?? undefined}
                      onChange={(value) =>
                        updateVariant(index, { sale_unit_id: value as number })
                      }
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <CommonSelector
                      label="Purchase Unit"
                      type="unit"
                      value={variant.purchase_unit_id ?? undefined}
                      onChange={(value) =>
                        updateVariant(index, {
                          purchase_unit_id: value as number,
                        })
                      }
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <label className="block text-sm font-medium mb-1 w-full!">
                      Warranty Period (Months)
                    </label>
                    <InputNumber
                      style={{ width: "100%" }}
                      placeholder="12"
                      min={0}
                      value={variant.warranty_period}
                      onChange={(value) =>
                        updateVariant(index, { warranty_period: value })
                      }
                      addonAfter="Months"
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <label className="block text-sm font-medium mb-1 w-full!">
                      <Space>
                        <AlertOutlined />
                        Alert Quantity
                      </Space>
                    </label>
                    <InputNumber
                      style={{ width: "100%" }}
                      placeholder="10"
                      min={0}
                      value={variant.alert_quantity}
                      onChange={(value) =>
                        updateVariant(index, { alert_quantity: value || 0 })
                      }
                      addonAfter="units"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Get alerts when stock is low
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Image */}
              <div>
                <Text strong className="block mb-3">
                  Variant Image
                </Text>
                <Row>
                  <Col xs={24}>
                    <ImageInput
                      name={`variant-image-${index}`}
                      value={variant.image ? [variant.image] : []}
                      onChange={(urls) =>
                        updateVariant(index, { image: urls[0] || "" })
                      }
                      maxCount={1}
                      useForm={false}
                    />
                  </Col>
                </Row>
              </div>

              {/* Serial Numbers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Text strong>
                    <Space>
                      <BarcodeOutlined />
                      Serial Numbers
                      {(variant.serials || []).length > 0 && (
                        <Badge count={(variant.serials || []).length} color="green" />
                      )}
                    </Space>
                  </Text>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => addVariantSerial(index)}
                  >
                    Add Serial
                  </Button>
                </div>

                {(variant.serials || []).length === 0 ? (
                  <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded">
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
                                index,
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
                              updateVariantSerial(
                                index,
                                serialIndex,
                                "status",
                                value
                              )
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
                            icon={<MinusCircleOutlined />}
                            onClick={() => removeVariantSerial(index, serialIndex)}
                            title="Remove serial number"
                          />
                        </Col>
                      </Row>
                    ))}
                  </div>
                )}
              </div>

              <Divider />

              {/* Attributes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Text strong>Attributes</Text>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => addVariantAttribute(index)}
                  >
                    Add Attribute
                  </Button>
                </div>

                {(variant.attributes || []).length === 0 ? (
                  <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded">
                    <Text type="secondary">No attributes added</Text>
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
                                index,
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
                                index,
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
                            onClick={() =>
                              removeVariantAttribute(index, attrIndex)
                            }
                          />
                        </Col>
                      </Row>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
