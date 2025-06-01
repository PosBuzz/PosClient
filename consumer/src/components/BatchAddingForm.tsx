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
      <Card size={size} style={{ marginTop: 6 }} bodyStyle={{ padding: 8 }}>
        <div style={{ textAlign: "center", padding: "6px 0" }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            No inventory batches added
          </Text>
          <br />
          <Button
            size="small"
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addBatch}
            disabled={disabled}
            style={{ marginTop: 6, height: 24 }}
          >
            Add Inventory Batch
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      style={{ marginTop: 6 }}
      bodyStyle={{ padding: 8 }}
      title={
        <Space size={4}>
          <Text strong style={{ fontSize: 11 }}>
            Inventory Batches ({batches.length})
          </Text>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={addBatch}
            disabled={disabled}
            style={{ height: 20, fontSize: 10 }}
          >
            Add
          </Button>
        </Space>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {batches.map((batch, index) => (
          <Card key={index} size="small" bodyStyle={{ padding: 8 }}>
            {/* Compact header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Text strong style={{ fontSize: 11 }}>
                Batch {index + 1}
              </Text>
              {batches.length > 1 && (
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<MinusCircleOutlined />}
                  onClick={() => removeBatch(index)}
                  disabled={disabled}
                  style={{ height: 20, minWidth: 20 }}
                />
              )}
            </div>

            <Row gutter={[4, 2]}>
              <Col xs={24} sm={4}>
                <Form.Item
                  label="Branch/Location"
                  style={{ marginBottom: 4 }}
                  required
                >
                  <Select
                    size="small"
                    placeholder="Select branch"
                    value={batch.branch_id}
                    onChange={(value) => updateBatch(index, "branch_id", value)}
                    disabled={disabled}
                  >
                    {branches.map((branch) => (
                      <Option key={branch.id} value={branch.id}>
                        {branch.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={4}>
                <Form.Item
                  label="Reference Number"
                  style={{ marginBottom: 4 }}
                  required
                >
                  <Input
                    size="small"
                    placeholder="Enter reference number"
                    value={batch.batch_number}
                    onChange={(e) =>
                      updateBatch(index, "batch_number", e.target.value)
                    }
                    disabled={disabled}
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
                        style={{ height: 16, minWidth: 16 }}
                      />
                    }
                  />
                </Form.Item>
              </Col>

              <Col xs={8} sm={3}>
                <Form.Item label="Qty" style={{ marginBottom: 4 }} required>
                  <InputNumber
                    size="small"
                    type="number"
                    placeholder="0"
                    min={1}
                    precision={0}
                    style={{ width: "100%" }}
                    value={batch.quantity}
                    onChange={(value) =>
                      updateBatch(index, "quantity", value || 1)
                    }
                    disabled={disabled}
                    addonAfter="units"
                  />
                </Form.Item>
              </Col>

              <Col xs={8} sm={3}>
                <Form.Item
                  label="Cost/Unit"
                  style={{ marginBottom: 4 }}
                  required
                >
                  <InputNumber
                    size="small"
                    type="number"
                    placeholder="0.00"
                    min={0}
                    precision={2}
                    style={{ width: "100%" }}
                    value={batch.cost_price}
                    onChange={(value) =>
                      updateBatch(index, "cost_price", value || 0)
                    }
                    disabled={disabled}
                    prefix="$"
                  />
                </Form.Item>
              </Col>

              <Col xs={8} sm={3}>
                <Form.Item label="Total" style={{ marginBottom: 4 }}>
                  <Input
                    size="small"
                    value={`$${(
                      (batch.cost_price || 0) * (batch.quantity || 0)
                    ).toFixed(2)}`}
                    disabled
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={3}>
                <Form.Item label="Expiry" style={{ marginBottom: 4 }}>
                  <DatePicker
                    size="small"
                    style={{ width: "100%" }}
                    placeholder="Expiry date"
                    format="MM/DD/YY"
                    value={batch.expiry_date ? dayjs(batch.expiry_date) : null}
                    onChange={(date) =>
                      updateBatch(
                        index,
                        "expiry_date",
                        date ? date.format("YYYY-MM-DD") : undefined
                      )
                    }
                    disabled={disabled}
                    disabledDate={(current) =>
                      current && current < dayjs().startOf("day")
                    }
                    suffixIcon={<CalendarOutlined />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={4}>
                <Form.Item label="Supplier/Vendor" style={{ marginBottom: 2 }}>
                  <VendorSelector
                    value={batch.vendor_id}
                    onChange={(value) => updateBatch(index, "vendor_id", value)}
                    disabled={disabled}
                    size="small"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        ))}

        {/* Compact Summary */}
        {batches.length > 0 && (
          <Card size="small" bodyStyle={{ padding: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  Batches
                </Text>
                <br />
                <Text strong style={{ fontSize: 11 }}>
                  {batches.length}
                </Text>
              </div>
              <div style={{ textAlign: "center" }}>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  Total Qty
                </Text>
                <br />
                <Text strong style={{ fontSize: 11 }}>
                  {totalQuantity} units
                </Text>
              </div>
              <div style={{ textAlign: "center" }}>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  Total Cost
                </Text>
                <br />
                <Text strong style={{ fontSize: 11 }}>
                  ${totalCost.toFixed(2)}
                </Text>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
}
