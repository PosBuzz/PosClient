import React from 'react';
import {
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
import {
  DollarCircleOutlined,
  ProductOutlined,
  TagsOutlined,
  AimOutlined,
} from "@ant-design/icons";
import { TaxMethod } from "../../../types/product.types";
import { ProductFormState, ValidationState } from "../hooks/useProductFormState";
import { getValidationStatus } from "../utils/validation";
import AiDescriptionGenerator from "../AiDescriptionGenerator";
import CommonSelector from "../CommonSelector";

const { TextArea } = Input;
const { Text } = Typography;

interface StateBasicInformationTabProps {
  formState: ProductFormState;
  validationState: ValidationState;
  onFieldUpdate: (field: string, value: any) => void;
  onVariantToggle: (hasVariants: boolean) => void;
  isEditMode?: boolean;
}

const StateBasicInformationTab: React.FC<StateBasicInformationTabProps> = ({
  formState,
  validationState,
  onFieldUpdate,
  onVariantToggle,
  isEditMode = false,
}) => {
  const handleDescriptionGenerated = (description: string) => {
    onFieldUpdate('description', description);
  };

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
        styles={{ body: { padding: 12 } }}
      >
        {/* Row 1: Product Name and Code */}
        <Row gutter={[8, 4]}>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>Product Name *</Text>
              <Input
                size="small"
                placeholder="Enter product name"
                value={formState.name}
                onChange={(e) => onFieldUpdate('name', e.target.value)}
                status={getValidationStatus('name', validationState).status}
                maxLength={100}
                showCount
              />
              {getValidationStatus('name', validationState).help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getValidationStatus('name', validationState).help}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>Product Code</Text>
              <Input
                size="small"
                placeholder="Enter product code"
                value={formState.code}
                onChange={(e) => onFieldUpdate('code', e.target.value)}
                status={getValidationStatus('code', validationState).status}
                maxLength={50}
                showCount
              />
              {getValidationStatus('code', validationState).help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getValidationStatus('code', validationState).help}
                </Text>
              )}
            </div>
          </Col>
        </Row>

        {/* Row 2: Description with AI generator */}
        <div style={{ marginBottom: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Text strong style={{ fontSize: 11 }}>Description</Text>
            <AiDescriptionGenerator
              productName={formState.name || ""}
              currentDescription={formState.description || ""}
              onDescriptionGenerated={handleDescriptionGenerated}
            />
          </div>
          <TextArea
            size="small"
            placeholder="Enter product description"
            rows={2}
            value={formState.description}
            onChange={(e) => onFieldUpdate('description', e.target.value)}
            status={getValidationStatus('description', validationState).status}
            maxLength={500}
            showCount
          />
          {getValidationStatus('description', validationState).help && (
            <Text type="danger" style={{ fontSize: 10 }}>
              {getValidationStatus('description', validationState).help}
            </Text>
          )}
        </div>
      </Card>

      {/* Compact Classification */}
      <Card
        title={
          <Space size={4}>
            <TagsOutlined />
            <span style={{ fontSize: 12 }}>Classification</span>
          </Space>
        }
        size="small"
        styles={{ body: { padding: 12 } }}
      >
        <Row gutter={[6, 4]}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>Category</Text>
              <CommonSelector
                label=""
                type="category"
                value={formState.category_id}
                onChange={(value) => onFieldUpdate('category_id', value)}
                size="small"
              />
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>Brand</Text>
              <CommonSelector
                label=""
                type="brand"
                value={formState.brand_id}
                onChange={(value) => onFieldUpdate('brand_id', value)}
                size="small"
              />
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>Tags</Text>
              <CommonSelector
                label=""
                type="tag"
                value={formState.tag_ids}
                onChange={(value) => onFieldUpdate('tag_ids', value)}
                mode="tags"
                size="small"
              />
            </div>
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
            styles={{ body: { padding: 12 } }}
          >
            <Row gutter={[6, 4]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 11 }}>Method</Text>
                  <Select
                    size="small"
                    placeholder="Tax method"
                    value={formState.tax_method}
                    onChange={(value) => onFieldUpdate('tax_method', value)}
                    style={{ width: "100%" }}
                    options={[
                      { value: TaxMethod.EXCLUSIVE, label: "Exclusive" },
                      { value: TaxMethod.INCLUSIVE, label: "Inclusive" },
                    ]}
                  />
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 11 }}>Rate (%)</Text>
                  <InputNumber
                    size="small"
                    placeholder="0"
                    min={0}
                    max={100}
                    value={formState.tax}
                    onChange={(value) => onFieldUpdate('tax', value || 0)}
                    style={{ width: "100%" }}
                    status={getValidationStatus('tax', validationState).status}
                  />
                  {getValidationStatus('tax', validationState).help && (
                    <Text type="danger" style={{ fontSize: 10 }}>
                      {getValidationStatus('tax', validationState).help}
                    </Text>
                  )}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            title={
              <Space size={4}>
                <AimOutlined />
                <span style={{ fontSize: 12 }}>Sales Target</span>
              </Space>
            }
            size="small"
            styles={{ body: { padding: 12 } }}
          >
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 11 }}>Daily Objective</Text>
              <InputNumber
                size="small"
                placeholder="0"
                min={0}
                value={formState.daily_sale_objective}
                onChange={(value) => onFieldUpdate('daily_sale_objective', value || 0)}
                style={{ width: "100%" }}
                addonAfter="units/day"
                status={getValidationStatus('daily_sale_objective', validationState).status}
              />
              {getValidationStatus('daily_sale_objective', validationState).help && (
                <Text type="danger" style={{ fontSize: 10 }}>
                  {getValidationStatus('daily_sale_objective', validationState).help}
                </Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Compact Product Configuration */}
      {!isEditMode && (
        <Card
          title={
            <Space size={4}>
              <ProductOutlined />
              <span style={{ fontSize: 12 }}>Product Type</span>
            </Space>
          }
          size="small"
          styles={{ body: { padding: 12 } }}
        >
          <div style={{ marginBottom: 0 }}>
            <Text strong style={{ fontSize: 11 }}>Variant Setting</Text>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <Switch
                size="small"
                checkedChildren="Has Variants"
                unCheckedChildren="Simple Product"
                checked={formState.has_variants}
                onChange={onVariantToggle}
              />
              <span style={{ fontSize: 11, color: "#666" }}>
                {formState.has_variants
                  ? "Multiple variants (size, color, etc.)"
                  : "Single product with no variants"}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default StateBasicInformationTab;
