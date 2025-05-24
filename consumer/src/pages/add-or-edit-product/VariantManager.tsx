import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  MinusCircleOutlined,
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
} from "antd";
import { ProductVariant, VariantAttribute } from "../../types/product.types";
import CommonSelector from "./CommonSelector";
import ImageInput from "../../components/ImageInput";

const { Title, Text } = Typography;

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
                      className="w-full"
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
                      className="w-full"
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
                      className="w-full"
                      prefix="$"
                      value={variant.wholesale_price}
                      onChange={(value) =>
                        updateVariant(index, { wholesale_price: value })
                      }
                    />
                  </Col>
                </Row>
              </div>

              {/* Units & Warranty */}
              <div>
                <Text strong className="block mb-3">
                  Units & Warranty
                </Text>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <CommonSelector
                      label="Sale Unit"
                      type="unit"
                      value={variant.sale_unit_id}
                      onChange={(value) =>
                        updateVariant(index, { sale_unit_id: value as number })
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
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
                  <Col xs={24} md={8}>
                    <label className="block text-sm font-medium mb-1">
                      Warranty Period (Months)
                    </label>
                    <InputNumber
                      placeholder="12"
                      min={0}
                      className="w-full"
                      value={variant.warranty_period}
                      onChange={(value) =>
                        updateVariant(index, { warranty_period: value })
                      }
                      addonAfter="Months"
                    />
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
