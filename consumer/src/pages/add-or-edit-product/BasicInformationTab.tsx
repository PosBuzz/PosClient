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
  Switch,
} from "antd";
import { ProductFormData, TaxMethod } from "../../types/product.types";
import AiDescriptionGenerator from "./AiDescriptionGenerator";
import CommonSelector from "./CommonSelector";
import { GrTarget } from "react-icons/gr";

const { TextArea } = Input;

interface BasicInformationTabProps {
  formData: ProductFormData;
  updateFormField: <K extends keyof ProductFormData>(
    field: K,
    value: ProductFormData[K]
  ) => void;
  onDescriptionGenerated: (description: string) => void;
  onVariantToggle: (checked: boolean) => void;
  isEditMode?: boolean;
}

export default function BasicInformationTab({
  formData,
  updateFormField,
  onDescriptionGenerated,
  onVariantToggle,
  isEditMode,
}: BasicInformationTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Compact Product Basics */}
      <Card
        title={
          <Space size={4}>
            <ProductOutlined />
            <span style={{ fontSize: 12 }}>Basic Details</span>
          </Space>
        }
        size="small"
        bodyStyle={{ padding: 12 }}
      >
        {/* Row 1: Product Name and Code on same line */}
        <Row gutter={[8, 4]}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="name"
              label="Product Name"
              style={{ marginBottom: 4 }}
              rules={[
                { required: true, message: "Please enter product name" },
                { min: 2, message: "Name must be at least 2 characters" },
              ]}
            >
              <Input
                size="small"
                placeholder="Enter product name"
                onChange={(e) => updateFormField("name", e.target.value)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="code"
              label="Product Code"
              style={{ marginBottom: 4 }}
              tooltip="Unique identifier for this product"
            >
              <Input
                size="small"
                placeholder="Enter product code"
                onChange={(e) => updateFormField("code", e.target.value)}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Row 2: Description with AI generator */}
        <Form.Item
          name="description"
          label={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <span>Description</span>
              <AiDescriptionGenerator
                productName={formData.name}
                currentDescription={formData.description || ""}
                onDescriptionGenerated={onDescriptionGenerated}
              />
            </div>
          }
          style={{ marginBottom: 4 }}
        >
          <TextArea
            size="small"
            placeholder="Enter product description"
            rows={2}
            onChange={(e) => updateFormField("description", e.target.value)}
          />
        </Form.Item>
      </Card>

      {/* Compact Classification - All in one row */}
      <Card
        title={
          <Space size={4}>
            <TagsOutlined />
            <span style={{ fontSize: 12 }}>Classification</span>
          </Space>
        }
        size="small"
        bodyStyle={{ padding: 12 }}
      >
        <Row gutter={[6, 4]}>
          <Col xs={24} sm={8}>
            <Form.Item name="category_id" style={{ marginBottom: 4 }}>
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
                size="small"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="brand_id" style={{ marginBottom: 4 }}>
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
                size="small"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="tag_ids" style={{ marginBottom: 4 }}>
              <CommonSelector
                label="Tags"
                type="tag"
                mode="tags"
                value={formData.tag_ids}
                onChange={(value) =>
                  updateFormField("tag_ids", value as number[])
                }
                size="small"
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Compact Tax & Sales in one row */}
      <Row gutter={[8, 0]}>
        <Col xs={24} sm={12}>
          <Card
            title={
              <Space size={4}>
                <DollarCircleOutlined />
                <span style={{ fontSize: 12 }}>Tax Config</span>
              </Space>
            }
            size="small"
            bodyStyle={{ padding: 12 }}
          >
            <Row gutter={[6, 4]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="tax_method"
                  label="Method"
                  style={{ marginBottom: 4 }}
                  rules={[{ required: true, message: "Select tax method" }]}
                >
                  <Select
                    size="small"
                    placeholder="Tax method"
                    value={formData.tax_method}
                    onChange={(value) =>
                      updateFormField("tax_method", value as TaxMethod)
                    }
                    options={[
                      { label: "Exclusive", value: TaxMethod.EXCLUSIVE },
                      { label: "Inclusive", value: TaxMethod.INCLUSIVE },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="tax"
                  label="Rate (%)"
                  style={{ marginBottom: 4 }}
                  rules={[
                    { required: true, message: "Enter tax rate" },
                    {
                      type: "number",
                      min: 0,
                      max: 100,
                      message: "Rate: 0-100%",
                    },
                  ]}
                >
                  <InputNumber
                    size="small"
                    type="number"
                    placeholder="0"
                    min={0}
                    max={100}
                    precision={2}
                    style={{ width: "100%" }}
                    addonAfter="%"
                    value={formData.tax}
                    onChange={(value) => updateFormField("tax", value || 0)}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            title={
              <Space size={4}>
                <GrTarget />
                <span style={{ fontSize: 12 }}>Sales Target</span>
              </Space>
            }
            size="small"
            bodyStyle={{ padding: 12 }}
          >
            <Form.Item
              name="daily_sale_objective"
              label="Daily Objective"
              style={{ marginBottom: 4 }}
              tooltip="Target quantity per day"
            >
              <InputNumber
                size="small"
                type="number"
                placeholder="0"
                min={0}
                style={{ width: "100%" }}
                addonAfter="units/day"
                value={formData.daily_sale_objective}
                onChange={(value) =>
                  updateFormField("daily_sale_objective", value || 0)
                }
              />
            </Form.Item>
          </Card>
        </Col>
      </Row>

      {/* Compact Product Configuration */}
      {!isEditMode && (
        <Card
          title={
            <Space size={4}>
              <SettingOutlined />
              <span style={{ fontSize: 12 }}>Product Type</span>
            </Space>
          }
          size="small"
          bodyStyle={{ padding: 12 }}
        >
          <Form.Item
            name="has_variants"
            label="Variant Setting"
            style={{ marginBottom: 0 }}
            tooltip="Choose product type"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Switch
                size="small"
                checkedChildren="Has Variants"
                unCheckedChildren="Simple Product"
                checked={formData.has_variants}
                onChange={onVariantToggle}
              />
              <span style={{ fontSize: 11, color: "#666" }}>
                {formData.has_variants
                  ? "Multiple variants (size, color, etc.)"
                  : "Single product with no variants"}
              </span>
            </div>
          </Form.Item>
        </Card>
      )}
    </div>
  );
}
