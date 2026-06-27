import { CurrencyIcon } from "../../../components/Currency";
import {
  ProductOutlined,
  SyncOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { TaxMethod } from "../../../types/product.types";
import { ProductFormState, ValidationState } from "../types";
import MasterDataSelector from "./MasterDataSelector";

// Renders top-level product fields: details, classification, tax, and product type toggle.

const { TextArea } = Input;
const { Text } = Typography;

interface BasicInfoSectionProps {
  formState: ProductFormState;
  validationState: ValidationState;
  onFieldUpdate: (field: keyof ProductFormState, value: unknown) => void;
  onProductTypeToggle: (checked: boolean) => void;
  onGenerateCode: () => void;
}

const getError = (validationState: ValidationState, field: string) => {
  // Normalizes per-field validation value for Ant Design inputs.
  const status = validationState[field]?.status;
  const help = validationState[field]?.help;
  return {
    status: status === "error" || status === "warning" ? status : undefined,
    help,
  };
};

export default function BasicInfoSection({
  formState,
  validationState,
  onFieldUpdate,
  onProductTypeToggle,
  onGenerateCode,
}: BasicInfoSectionProps) {
  // This section controls only top-level product fields (not per-variant fields).
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Card
        title={
          <Space>
            <ProductOutlined />
            <span>Product Details</span>
          </Space>
        }
      >
        <Row gutter={[16, 8]}>
          <Col xs={24} md={12}>
            <Text strong>Product Name *</Text>
            <Input
              placeholder="Enter product name"
              value={formState.name}
              status={getError(validationState, "name").status}
              onChange={(event) => onFieldUpdate("name", event.target.value)}
            />
            {getError(validationState, "name").help && (
              <Text type="danger">
                {getError(validationState, "name").help}
              </Text>
            )}
          </Col>
          <Col xs={24} md={12}>
            <Text strong>Product Code</Text>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Enter product code"
                value={formState.code}
                status={getError(validationState, "code").status}
                onChange={(event) => onFieldUpdate("code", event.target.value)}
              />
              <Button icon={<SyncOutlined />} onClick={onGenerateCode} />
            </Space.Compact>
            {getError(validationState, "code").help && (
              <Text type="danger">
                {getError(validationState, "code").help}
              </Text>
            )}
          </Col>
          <Col xs={24}>
            <Space
              style={{ width: "100%", justifyContent: "space-between" }}
              align="center"
            >
              <Text strong>Description</Text>
              {/* <AiDescriptionGenerator
                productName={formState.name}
                onDescriptionGenerated={(description) =>
                  onFieldUpdate("description", description)
                }
              /> */}
            </Space>
            <TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Enter product description"
              value={formState.description}
              onChange={(event) =>
                onFieldUpdate("description", event.target.value)
              }
            />
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <Space>
            <TagsOutlined />
            <span>Classification</span>
          </Space>
        }
      >
        <Row gutter={[16, 8]}>
          <Col xs={24} sm={12} lg={8}>
            <Text strong>Category</Text>
            <MasterDataSelector
              type="category"
              label="Category"
              value={formState.category_id}
              onChange={(value) => onFieldUpdate("category_id", value)}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Text strong>Brand</Text>
            <MasterDataSelector
              type="brand"
              label="Brand"
              value={formState.brand_id}
              onChange={(value) => onFieldUpdate("brand_id", value)}
            />
          </Col>
          <Col xs={24} lg={8}>
            <Text strong>Tags</Text>
            <MasterDataSelector
              type="tag"
              label="Tag"
              mode="multiple"
              value={formState.tag_ids}
              onChange={(value) => onFieldUpdate("tag_ids", value || [])}
            />
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <Space>
            <CurrencyIcon />
            <span>Tax & Product Type</span>
          </Space>
        }
      >
        <Row gutter={[16, 8]}>
          <Col xs={24} sm={12}>
            <Text strong>Tax Method</Text>
            <Select
              style={{ width: "100%" }}
              value={formState.tax_method}
              options={[
                { label: "Exclusive", value: TaxMethod.EXCLUSIVE },
                { label: "Inclusive", value: TaxMethod.INCLUSIVE },
              ]}
              onChange={(value) => onFieldUpdate("tax_method", value)}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Text strong>Tax Rate (%)</Text>
            <InputNumber
              type="number"
              style={{ width: "100%" }}
              min={0}
              max={100}
              precision={2}
              value={formState.tax}
              status={getError(validationState, "tax").status}
              onChange={(value) => onFieldUpdate("tax", value || 0)}
            />
            {getError(validationState, "tax").help && (
              <Text type="danger">{getError(validationState, "tax").help}</Text>
            )}
          </Col>
          <Col xs={24}>
            <Space align="center" style={{ marginTop: 8 }}>
              <Switch
                checked={formState.has_variants}
                onChange={onProductTypeToggle}
              />
              <Text>
                {formState.has_variants
                  ? "Variant product"
                  : "Simple product (single variant)"}
              </Text>
            </Space>
            {getError(validationState, "has_variants").help && (
              <div>
                <Text type="danger">
                  {getError(validationState, "has_variants").help}
                </Text>
              </div>
            )}
          </Col>
        </Row>
      </Card>
    </Space>
  );
}
