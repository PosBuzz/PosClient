import {
  CalendarOutlined,
  DollarOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "../api/inventory-api";
import VendorSelector from "./VendorSelector";

const { Text, Title } = Typography;
const { Option } = Select;

export interface BatchData {
  branch_id: number | null;
  batch_number: string;
  quantity: number;
  cost_price: number;
  vendor_id?: number;
  expiry_date?: string;
}

interface BatchAddingFormProps {
  variantName?: string;
  batches: BatchData[];
  onBatchesChange: (batches: BatchData[]) => void;
  disabled?: boolean;
  size?: "small" | "default";
}

export default function BatchAddingForm({
  variantName,
  batches,
  onBatchesChange,
  disabled = false,
  size = "default",
}: BatchAddingFormProps) {
  // Queries
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => inventoryApi.getBranches(),
  });

  // Generate batch number
  const generateBatchNumber = (variantName?: string) => {
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-6);
    const prefix = variantName?.slice(0, 3).toUpperCase() || "INV";
    return `${prefix}${timestamp}`;
  };

  // Add new batch
  const addBatch = () => {
    const newBatch: BatchData = {
      branch_id: null,
      batch_number: generateBatchNumber(variantName),
      quantity: 1,
      cost_price: 0,
      vendor_id: undefined,
      expiry_date: undefined,
    };
    onBatchesChange([...batches, newBatch]);
  };

  // Remove batch
  const removeBatch = (index: number) => {
    const newBatches = batches.filter((_, i) => i !== index);
    onBatchesChange(newBatches);
  };

  // Update batch data
  const updateBatch = (index: number, field: keyof BatchData, value: any) => {
    const newBatches = [...batches];
    newBatches[index] = { ...newBatches[index], [field]: value };
    onBatchesChange(newBatches);
  };

  // Calculate totals
  const totalQuantity = batches.reduce(
    (sum, batch) => sum + (batch.quantity || 0),
    0
  );
  const totalCost = batches.reduce(
    (sum, batch) => sum + (batch.cost_price || 0) * (batch.quantity || 0),
    0
  );

  if (batches.length === 0) {
    return (
      <Card size={size} style={{ marginTop: 12 }}>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <Text type="secondary">No inventory batches added</Text>
          <br />
          <Button
            size={size}
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addBatch}
            disabled={disabled}
            style={{ marginTop: 8 }}
          >
            Add Inventory Batch
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      size={size}
      style={{ marginTop: 12 }}
      title={
        <Space>
          <Text strong style={{ fontSize: size === "small" ? 12 : 14 }}>
            Inventory Batches ({batches.length})
          </Text>
          <Button
            type="dashed"
            size={size}
            icon={<PlusOutlined />}
            onClick={addBatch}
            disabled={disabled}
          >
            Add Batch
          </Button>
        </Space>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {batches.map((batch, index) => (
          <Card key={index} size="small">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text strong>Batch {index + 1}</Text>
              {batches.length > 1 && (
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<MinusCircleOutlined />}
                  onClick={() => removeBatch(index)}
                  disabled={disabled}
                />
              )}
            </div>

            <Row gutter={8}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Branch/Location"
                  style={{ marginBottom: 8 }}
                  required
                >
                  <Select
                    placeholder="Select branch"
                    value={batch.branch_id}
                    onChange={(value) => updateBatch(index, "branch_id", value)}
                    disabled={disabled}
                    size={size}
                  >
                    {branches.map((branch) => (
                      <Option key={branch.id} value={branch.id}>
                        {branch.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  label="Reference Number"
                  style={{ marginBottom: 8 }}
                  required
                >
                  <Input
                    placeholder="Enter reference number"
                    value={batch.batch_number}
                    onChange={(e) =>
                      updateBatch(index, "batch_number", e.target.value)
                    }
                    disabled={disabled}
                    size={size}
                    suffix={
                      <Button
                        type="link"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() =>
                          updateBatch(
                            index,
                            "batch_number",
                            generateBatchNumber(variantName)
                          )
                        }
                        disabled={disabled}
                        title="Generate reference number"
                      />
                    }
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={8}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Quantity"
                  style={{ marginBottom: 8 }}
                  required
                >
                  <InputNumber
                    type="number"
                    placeholder="Enter quantity"
                    min={1}
                    precision={0}
                    style={{ width: "100%" }}
                    value={batch.quantity}
                    onChange={(value) =>
                      updateBatch(index, "quantity", value || 1)
                    }
                    disabled={disabled}
                    size={size}
                    addonAfter="units"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item
                  label="Cost Price (per unit)"
                  style={{ marginBottom: 8 }}
                  required
                >
                  <InputNumber
                    type="number"
                    placeholder="Enter cost price"
                    min={0}
                    precision={2}
                    style={{ width: "100%" }}
                    value={batch.cost_price}
                    onChange={(value) =>
                      updateBatch(index, "cost_price", value || 0)
                    }
                    disabled={disabled}
                    size={size}
                    prefix={<DollarOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={8}>
                <Form.Item label="Total Cost" style={{ marginBottom: 8 }}>
                  <Input
                    value={`$${(
                      (batch.cost_price || 0) * (batch.quantity || 0)
                    ).toFixed(2)}`}
                    disabled
                    size={size}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={8}>
              <Col xs={24} sm={12}>
                <Form.Item label="Expiry Date" style={{ marginBottom: 8 }}>
                  <DatePicker
                    style={{ width: "100%" }}
                    placeholder="Select expiry date"
                    format="YYYY-MM-DD"
                    value={batch.expiry_date ? dayjs(batch.expiry_date) : null}
                    onChange={(date) =>
                      updateBatch(
                        index,
                        "expiry_date",
                        date ? date.format("YYYY-MM-DD") : undefined
                      )
                    }
                    disabled={disabled}
                    size={size}
                    disabledDate={(current) =>
                      current && current < dayjs().startOf("day")
                    }
                    suffixIcon={<CalendarOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item label="Supplier/Vendor" style={{ marginBottom: 8 }}>
                  <VendorSelector
                    value={batch.vendor_id}
                    onChange={(value) => updateBatch(index, "vendor_id", value)}
                    disabled={disabled}
                    size={size}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        ))}

        {/* Summary */}
        {batches.length > 0 && (
          <Card size="small">
            <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
              Inventory Summary
            </Title>
            <Row gutter={16}>
              <Col span={8}>
                <Text type="secondary">Total Batches:</Text>
                <br />
                <Text strong>{batches.length}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">Total Quantity:</Text>
                <br />
                <Text strong>{totalQuantity} units</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">Total Cost:</Text>
                <br />
                <Text strong>${totalCost.toFixed(2)}</Text>
              </Col>
            </Row>
          </Card>
        )}
      </div>
    </Card>
  );
}
