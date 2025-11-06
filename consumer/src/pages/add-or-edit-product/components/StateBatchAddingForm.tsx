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
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "../../../api/inventory-api";
import VendorSelector from "../../../components/VendorSelector";
import { queryKeys, queryStaleTimeMap } from "../../../constants/queryKeys";

const { Text } = Typography;
const { Option } = Select;

export interface BatchData {
  branch_id: number | null;
  batch_number: string;
  quantity: number;
  cost_price: number;
  vendor_id?: number;
  expiry_date?: string;
}

interface StateBatchAddingFormProps {
  variantName?: string;
  batches: BatchData[];
  onBatchesChange: (batches: BatchData[]) => void;
  disabled?: boolean;
  size?: "small" | "default";
  validationState?: {
    [key: string]: {
      status: "success" | "warning" | "error" | "validating" | "";
      help: string;
    };
  };
  variantId?: string;
}

export default function StateBatchAddingForm({
  variantName,
  batches,
  onBatchesChange,
  disabled = false,
  size = "default",
  validationState = {},
  variantId = "0",
}: StateBatchAddingFormProps) {
  // Helper function to get validation status for batch fields
  const getBatchValidationStatus = (batchIndex: number, field: string) => {
    const key = `variant_${variantId}_batch_${batchIndex}_${field}`;
    const validation = validationState[key];
    const status = validation?.status;
    return {
      status: status === "error" || status === "warning" ? status : undefined,
      help: validation?.help || "",
    };
  };

  // Queries
  const { data: branches = [] } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: queryStaleTimeMap[queryKeys.branches],
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
      <Card size={size} style={{ marginTop: 6, padding: 8 }}>
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
          <Card
            key={index}
            bordered={false}
            size="small"
            style={{ padding: 0 }}
          >
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
              <Button
                type="text"
                danger
                size="small"
                icon={<MinusCircleOutlined />}
                onClick={() => removeBatch(index)}
                disabled={disabled}
                style={{ height: 20, minWidth: 20 }}
              />
            </div>

            <Row gutter={[4, 2]}>
              {" "}
              <Col xs={24} sm={3}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: "#666" }}>
                    Branch/Location *
                  </Text>
                  <Select
                    size="small"
                    placeholder="Select branch/location"
                    value={batch.branch_id}
                    onChange={(value) => updateBatch(index, "branch_id", value)}
                    disabled={disabled}
                    style={{ width: "100%", marginTop: 2 }}
                    status={getBatchValidationStatus(index, "branch_id").status}
                  >
                    {branches.map((branch) => (
                      <Option key={branch.id} value={branch.id}>
                        {branch.name}
                      </Option>
                    ))}
                  </Select>
                  {getBatchValidationStatus(index, "branch_id").help && (
                    <Text type="danger" style={{ fontSize: 10 }}>
                      {getBatchValidationStatus(index, "branch_id").help}
                    </Text>
                  )}
                </div>
              </Col>
              <Col xs={24} sm={4}>
                {" "}
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: "#666" }}>
                    Reference Number *
                  </Text>
                  <Input
                    size="small"
                    placeholder="Enter reference number"
                    value={batch.batch_number}
                    onChange={(e) =>
                      updateBatch(index, "batch_number", e.target.value)
                    }
                    disabled={disabled}
                    style={{ marginTop: 2 }}
                    status={
                      getBatchValidationStatus(index, "batch_number").status
                    }
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
                  {getBatchValidationStatus(index, "batch_number").help && (
                    <Text type="danger" style={{ fontSize: 10 }}>
                      {getBatchValidationStatus(index, "batch_number").help}
                    </Text>
                  )}
                </div>
              </Col>{" "}
              <Col xs={8} sm={4}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: "#666" }}>Qty *</Text>
                  <InputNumber
                    type="number"
                    size="small"
                    placeholder="0"
                    min={1}
                    precision={0}
                    style={{ width: "100%", marginTop: 2 }}
                    value={batch.quantity}
                    onChange={(value) =>
                      updateBatch(index, "quantity", value || 1)
                    }
                    disabled={disabled}
                    addonAfter="units"
                    status={getBatchValidationStatus(index, "quantity").status}
                  />
                  {getBatchValidationStatus(index, "quantity").help && (
                    <Text type="danger" style={{ fontSize: 10 }}>
                      {getBatchValidationStatus(index, "quantity").help}
                    </Text>
                  )}
                </div>
              </Col>{" "}
              <Col xs={8} sm={3}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: "#666" }}>
                    Cost/Unit *
                  </Text>
                  <InputNumber
                    type="number"
                    size="small"
                    placeholder="0.00"
                    min={0}
                    precision={2}
                    style={{ width: "100%", marginTop: 2 }}
                    value={batch.cost_price}
                    onChange={(value) =>
                      updateBatch(index, "cost_price", value || 0)
                    }
                    disabled={disabled}
                    prefix="$"
                    status={
                      getBatchValidationStatus(index, "cost_price").status
                    }
                  />
                  {getBatchValidationStatus(index, "cost_price").help && (
                    <Text type="danger" style={{ fontSize: 10 }}>
                      {getBatchValidationStatus(index, "cost_price").help}
                    </Text>
                  )}
                </div>
              </Col>
              <Col xs={8} sm={3}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: "#666" }}>Total</Text>
                  <Input
                    size="small"
                    value={`$${(
                      (batch.cost_price || 0) * (batch.quantity || 0)
                    ).toFixed(2)}`}
                    disabled
                    style={{ marginTop: 2 }}
                  />
                </div>
              </Col>
              <Col xs={24} sm={2}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: "#666" }}>Expiry</Text>
                  <DatePicker
                    size="small"
                    style={{ width: "100%", marginTop: 2 }}
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
                </div>
              </Col>
              <Col xs={24} sm={3}>
                <div style={{ marginBottom: 2 }}>
                  <Text style={{ fontSize: 11, color: "#666" }}>
                    Supplier/Vendor
                  </Text>{" "}
                  <VendorSelector
                    value={batch.vendor_id}
                    onChange={(value) => updateBatch(index, "vendor_id", value)}
                    disabled={disabled}
                    size="small"
                  />
                </div>
              </Col>
            </Row>
          </Card>
        ))}

        {/* Compact Summary */}
        {batches.length > 0 && (
          <Card size="small" style={{ padding: 6 }}>
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
