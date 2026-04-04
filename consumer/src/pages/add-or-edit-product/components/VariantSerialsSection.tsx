import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row, Select, Space, Typography } from "antd";
import { FormSerial } from "../../../types/product.types";
import { ValidationState } from "../types";

// Serial list editor for one variant, including status and optional notes per serial.

const { Text } = Typography;

interface VariantSerialsSectionProps {
  variantId: string;
  serials: FormSerial[];
  validationState: ValidationState;
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<FormSerial>) => void;
  onDelete: (index: number) => void;
}

const getError = (
  validationState: ValidationState,
  variantId: string,
  index: number,
) => {
  // Validation keys encode variant + serial row index.
  const key = `variant_${variantId}_serial_${index}_serial_number`;
  const status = validationState[key]?.status;
  return {
    status: status === "error" || status === "warning" ? status : undefined,
    help: validationState[key]?.help,
  };
};

export default function VariantSerialsSection({
  variantId,
  serials,
  validationState,
  onAdd,
  onUpdate,
  onDelete,
}: VariantSerialsSectionProps) {
  // Pure presentational editor for serial rows.
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Row justify="space-between" align="middle">
        <Text strong>Serials</Text>
        <Button icon={<PlusOutlined />} onClick={onAdd}>
          Add Serial
        </Button>
      </Row>

      {serials.length === 0 && (
        <Text type="secondary">No serials added yet.</Text>
      )}

      {serials.map((serial, index) => (
        <Row
          key={`${variantId}-serial-${index}`}
          gutter={[8, 8]}
          align="middle"
        >
          <Col xs={24} md={8}>
            <Input
              placeholder="Serial number"
              value={serial.serial_number}
              maxLength={50}
              status={getError(validationState, variantId, index).status}
              onChange={(event) =>
                onUpdate(index, { serial_number: event.target.value })
              }
            />
            {getError(validationState, variantId, index).help && (
              <Text type="danger">
                {getError(validationState, variantId, index).help}
              </Text>
            )}
          </Col>
          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={serial.status || "available"}
              options={[
                { value: "available", label: "Available" },
                { value: "sold", label: "Sold" },
                { value: "defective", label: "Defective" },
                { value: "returned", label: "Returned" },
              ]}
              onChange={(value) => onUpdate(index, { status: value })}
            />
          </Col>
          <Col xs={24} md={8}>
            <Input
              placeholder="Notes (optional)"
              maxLength={200}
              value={serial.notes}
              onChange={(event) =>
                onUpdate(index, { notes: event.target.value })
              }
            />
          </Col>
          <Col xs={24} md={2}>
            <Button
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => onDelete(index)}
            />
          </Col>
        </Row>
      ))}
    </Space>
  );
}
