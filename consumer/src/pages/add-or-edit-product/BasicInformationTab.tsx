import {
    DollarCircleOutlined,
    ProductOutlined,
    SettingOutlined,
    TagsOutlined,
} from "@ant-design/icons";
import {
    Card,
    Col,
    Form,
    Input,
    InputNumber,
    Row,
    Select,
    Space,
    Switch
} from "antd";
import { ProductFormData, TaxMethod } from "../../types/product.types";
import AiDescriptionGenerator from "./AiDescriptionGenerator";
import CommonSelector from "./CommonSelector";

const { TextArea } = Input;

interface BasicInformationTabProps {
  formData: ProductFormData;
  updateFormField: <K extends keyof ProductFormData>(
    field: K,
    value: ProductFormData[K]
  ) => void;
  onDescriptionGenerated: (description: string) => void;
  onVariantToggle: (checked: boolean) => void;
}

export default function BasicInformationTab({
  formData,
  updateFormField,
  onDescriptionGenerated,
  onVariantToggle,
}: BasicInformationTabProps) {
  return (
    <div className="space-y-6!">
      {/* Product Basics */}
      <Card
        title={
          <Space>
            <ProductOutlined />
            <span>Basic Details</span>
          </Space>
        }
        size="small"
        className="border-blue-200"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Form.Item
              name="name"
              label="Product Name"
              rules={[
                { required: true, message: "Please enter product name" },
                { min: 2, message: "Name must be at least 2 characters" },
              ]}
            >
              <Input
                placeholder="Enter product name"
                onChange={(e) => updateFormField("name", e.target.value)}
                className="hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item
              name="code"
              label="Product Code/SKU"
              tooltip="Unique identifier for this product"
            >
              <Input
                placeholder="Enter product code"
                onChange={(e) => updateFormField("code", e.target.value)}
                className="hover:border-blue-400 focus:border-blue-500"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label={
            <div className="flex items-center justify-between w-full">
              <span>Description</span>
              <AiDescriptionGenerator
                productName={formData.name}
                currentDescription={formData.description || ""}
                onDescriptionGenerated={onDescriptionGenerated}
              />
            </div>
          }
        >
          <TextArea
            placeholder="Enter product description"
            rows={4}
            onChange={(e) => updateFormField("description", e.target.value)}
            className="hover:border-blue-400 focus:border-blue-500"
          />
        </Form.Item>
      </Card>

      {/* Classification */}
      <Card
        title={
          <Space>
            <TagsOutlined />
            <span>Classification</span>
          </Space>
        }
        size="small"
        className="border-green-200"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Form.Item name="category_id">
              <CommonSelector
                label="Category"
                type="category"
                value={formData.category_id}
                onChange={(value) =>
                  updateFormField(
                    "category_id",
                    Array.isArray(value) ? value[0] : value
                  )
                }
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="brand_id">
              <CommonSelector
                label="Brand"
                type="brand"
                value={formData.brand_id}
                onChange={(value) =>
                  updateFormField(
                    "brand_id",
                    Array.isArray(value) ? value[0] : value
                  )
                }
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="tag_ids">
              <CommonSelector
                label="Tags"
                type="tag"
                mode="tags"
                value={formData.tag_ids}
                onChange={(value) =>
                  updateFormField("tag_ids", value as number[])
                }
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Tax Configuration */}
      <Card
        title={
          <Space>
            <DollarCircleOutlined />
            <span>Tax Configuration</span>
          </Space>
        }
        size="small"
        className="border-orange-200"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="tax_method"
              label="Tax Method"
              rules={[{ required: true, message: "Please select tax method" }]}
            >
              <Select
                placeholder="Select tax method"
                value={formData.tax_method}
                onChange={(value) =>
                  updateFormField("tax_method", value as TaxMethod)
                }
                options={[
                  { label: "Tax Exclusive", value: TaxMethod.EXCLUSIVE },
                  { label: "Tax Inclusive", value: TaxMethod.INCLUSIVE },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="tax"
              label="Tax Rate (%)"
              rules={[
                { required: true, message: "Please enter tax rate" },
                {
                  type: "number",
                  min: 0,
                  max: 100,
                  message: "Tax rate must be between 0-100%",
                },
              ]}
            >
              <InputNumber
                placeholder="0"
                min={0}
                max={100}
                precision={2}
                className="w-full!"
                addonAfter="%"
                value={formData.tax}
                onChange={(value) => updateFormField("tax", value || 0)}
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Product Configuration */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>Product Configuration</span>
          </Space>
        }
        size="small"
      >
        <Row gutter={[16, 16]} align="top">
          <Col xs={24}>
            <Form.Item
              name="has_variants"
              label="Product Type"
              tooltip="Choose whether this product has multiple variants (size, color, etc.)"
            >
              <Switch
                checkedChildren="Has Variants"
                unCheckedChildren="Simple Product"
                checked={formData.has_variants}
                onChange={onVariantToggle}
              />
              <div className="mt-2 text-sm text-gray-600">
                {formData.has_variants
                  ? "This product has multiple variants. Images and detailed configurations will be managed in the Variants tab."
                  : "This is a simple product. Image and configurations will be managed in the Product Details tab."}
              </div>
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
