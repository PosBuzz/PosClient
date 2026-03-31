import {
  CalendarOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { ValidationState, VariantBatchInput } from "../types";

// Initial inventory batch editor for a variant (branch, ref, qty, cost, vendor, expiry).

const { Text } = Typography;

interface Option {
  id: number;
  name: string;
}

interface VariantBatchSectionProps {
  variantId: string;
  variantName: string;
  batches: VariantBatchInput[];
  branches: Option[];
  vendors: Option[];
  validationState: ValidationState;
  onChange: (batches: VariantBatchInput[]) => void;
}

const createBatchRef = (variantName: string) => {
  // Creates a readable, mostly-unique batch reference from variant name + timestamp.
  const prefix = (variantName || "INV")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");
  return `${prefix}-${Date.now().toString().slice(-6)}`;
};

const getError = (
  validationState: ValidationState,
  variantId: string,
  index: number,
  field: "branch_id" | "batch_number" | "quantity" | "cost_price",
) => {
  // Validation keys encode variant + batch row index + field name.
  const key = `variant_${variantId}_batch_${index}_${field}`;
  const status = validationState[key]?.status;
  return {
    status: status === "error" || status === "warning" ? status : undefined,
    help: validationState[key]?.help,
  };
};

export default function VariantBatchSection({
  variantId,
  variantName,
  batches,
  branches,
  vendors,
  validationState,
  onChange,
}: VariantBatchSectionProps) {
  const addBatch = () => {
    // Appends one default batch row.
    onChange([
      ...batches,
      {
        branch_id: null,
        batch_number: createBatchRef(variantName),
        quantity: 1,
        cost_price: 0,
      },
    ]);
  };

  const updateBatch = (
    index: number,
    field: keyof VariantBatchInput,
    value: number | string | undefined | null,
  ) => {
    // Updates one batch row in an immutable way.
    const next = [...batches];
    next[index] = {
      ...next[index],
      [field]: value,
    };
    onChange(next);
  };

  const removeBatch = (index: number) => {
    // Removes one batch row by index.
    const next = [...batches];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <Card
      title="Initial Inventory Batches"
      extra={
        <Button icon={<PlusOutlined />} onClick={addBatch}>
          Add Batch
        </Button>
      }
    >
      {batches.length === 0 && (
        <Text type="secondary">
          No batches added. Add if you want initial stock.
        </Text>
      )}

      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {batches.map((batch, index) => (
          <Card
            key={`${variantId}-batch-${index}`}
            size="small"
            title={`Batch ${index + 1}`}
            extra={
              <Button
                danger
                type="text"
                icon={<MinusCircleOutlined />}
                onClick={() => removeBatch(index)}
              />
            }
          >
            <Row gutter={[8, 8]}>
              <Col xs={24} md={6}>
                <Text strong>Branch *</Text>
                <Select
                  style={{ width: "100%" }}
                  value={batch.branch_id || undefined}
                  options={branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                  }))}
                  status={
                    getError(validationState, variantId, index, "branch_id")
                      .status
                  }
                  onChange={(value) => updateBatch(index, "branch_id", value)}
                />
                {getError(validationState, variantId, index, "branch_id")
                  .help && (
                  <Text type="danger">
                    {
                      getError(validationState, variantId, index, "branch_id")
                        .help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={6}>
                <Text strong>Reference *</Text>
                <Space.Compact style={{ width: "100%" }}>
                  <Input
                    value={batch.batch_number}
                    status={
                      getError(
                        validationState,
                        variantId,
                        index,
                        "batch_number",
                      ).status
                    }
                    onChange={(event) =>
                      updateBatch(index, "batch_number", event.target.value)
                    }
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() =>
                      updateBatch(
                        index,
                        "batch_number",
                        createBatchRef(variantName),
                      )
                    }
                  />
                </Space.Compact>
                {getError(validationState, variantId, index, "batch_number")
                  .help && (
                  <Text type="danger">
                    {
                      getError(
                        validationState,
                        variantId,
                        index,
                        "batch_number",
                      ).help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={4}>
                <Text strong>Quantity *</Text>
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  precision={0}
                  value={batch.quantity}
                  status={
                    getError(validationState, variantId, index, "quantity")
                      .status
                  }
                  onChange={(value) =>
                    updateBatch(index, "quantity", value || 1)
                  }
                />
                {getError(validationState, variantId, index, "quantity")
                  .help && (
                  <Text type="danger">
                    {
                      getError(validationState, variantId, index, "quantity")
                        .help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={4}>
                <Text strong>Cost Price *</Text>
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  precision={2}
                  value={
                    batch.cost_price === null ||
                    batch.cost_price === undefined ||
                    batch.cost_price === ""
                      ? undefined
                      : Number(batch.cost_price)
                  }
                  status={
                    getError(validationState, variantId, index, "cost_price")
                      .status
                  }
                  onChange={(value) =>
                    updateBatch(
                      index,
                      "cost_price",
                      value === null ? null : value,
                    )
                  }
                />
                {getError(validationState, variantId, index, "cost_price")
                  .help && (
                  <Text type="danger">
                    {
                      getError(validationState, variantId, index, "cost_price")
                        .help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={4}>
                <Text strong>Vendor</Text>
                <Select
                  allowClear
                  style={{ width: "100%" }}
                  value={batch.vendor_id}
                  options={vendors.map((vendor) => ({
                    value: vendor.id,
                    label: vendor.name,
                  }))}
                  onChange={(value) => updateBatch(index, "vendor_id", value)}
                />
              </Col>

              <Col xs={24} md={8}>
                <Text strong>
                  <Space size={4}>
                    <CalendarOutlined />
                    Expiry Date
                  </Space>
                </Text>
                <DatePicker
                  style={{ width: "100%" }}
                  value={batch.expiry_date ? dayjs(batch.expiry_date) : null}
                  onChange={(date) =>
                    updateBatch(index, "expiry_date", date?.toISOString())
                  }
                />
              </Col>
            </Row>
          </Card>
        ))}
      </Space>
    </Card>
  );
}
