import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row, Space, Typography } from "antd";
import { FormAttribute } from "../../../types/product.types";
import { ValidationState } from "../types";

// Attribute list editor for one variant (name/value rows with per-row validation).

const { Text } = Typography;

interface VariantAttributesSectionProps {
  variantId: string;
  attributes: FormAttribute[];
  validationState: ValidationState;
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<FormAttribute>) => void;
  onDelete: (index: number) => void;
}

const getError = (
  validationState: ValidationState,
  variantId: string,
  index: number,
  field: "name" | "value",
) => {
  // Validation keys encode variant + row index + field name.
  const key = `variant_${variantId}_attribute_${index}_${field}`;
  const status = validationState[key]?.status;
  return {
    status: status === "error" || status === "warning" ? status : undefined,
    help: validationState[key]?.help,
  };
};

export default function VariantAttributesSection({
  variantId,
  attributes,
  validationState,
  onAdd,
  onUpdate,
  onDelete,
}: VariantAttributesSectionProps) {
  // Pure presentational editor for attribute rows.
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Row justify="space-between" align="middle">
        <Text strong>Attributes</Text>
        <Button icon={<PlusOutlined />} onClick={onAdd}>
          Add Attribute
        </Button>
      </Row>

      {attributes.length === 0 && (
        <Text type="secondary">No attributes added yet.</Text>
      )}

      {attributes.map((attribute, index) => (
        <Row key={`${variantId}-attr-${index}`} gutter={[8, 8]} align="middle">
          <Col xs={24} md={10}>
            <Input
              value={attribute.name}
              status={
                getError(validationState, variantId, index, "name").status
              }
              placeholder="Attribute name (e.g. Color)"
              onChange={(event) =>
                onUpdate(index, { name: event.target.value })
              }
            />
            {getError(validationState, variantId, index, "name").help && (
              <Text type="danger">
                {getError(validationState, variantId, index, "name").help}
              </Text>
            )}
          </Col>
          <Col xs={24} md={10}>
            <Input
              value={attribute.value}
              status={
                getError(validationState, variantId, index, "value").status
              }
              placeholder="Attribute value (e.g. Black)"
              onChange={(event) =>
                onUpdate(index, { value: event.target.value })
              }
            />
            {getError(validationState, variantId, index, "value").help && (
              <Text type="danger">
                {getError(validationState, variantId, index, "value").help}
              </Text>
            )}
          </Col>
          <Col xs={24} md={4}>
            <Button
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => onDelete(index)}
            >
              Remove
            </Button>
          </Col>
        </Row>
      ))}
    </Space>
  );
}
