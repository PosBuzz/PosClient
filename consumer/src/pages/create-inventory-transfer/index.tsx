import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreateTransferData,
  inventoryApi,
  InventoryBatch,
} from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { useMessageStore } from "../../stores/messageStore";

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface TransferItem {
  key: string;
  batch_id: number;
  batch: InventoryBatch;
  quantity: number;
  max_quantity: number;
}

export default function AddInventoryTransfer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { messageApi } = useMessageStore();

  const [sourceBranchId, setSourceBranchId] = useState<number>();
  const [destinationBranchId, setDestinationBranchId] = useState<number>();
  const [selectedItems, setSelectedItems] = useState<TransferItem[]>([]);
  const [searchText, setSearchText] = useState("");

  // Queries
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: 3600 * 1000,
  });

  // Updated query to handle warehouse (null branch_id)
  const { data: sourceBatches, isLoading: sourceBatchesLoading } = useQuery({
    queryKey: ["all-batches", sourceBranchId, searchText],
    queryFn: () => {
      // If sourceBranchId is null, get warehouse batches
      if (sourceBranchId === null) {
        return inventoryApi.getBatches({
          search: searchText || undefined,
          limit: 100,
        });
      }
      // Otherwise get branch-specific batches
      return inventoryApi.getBranchBatches(sourceBranchId!, {
        search: searchText || undefined,
        limit: 100,
      });
    },
    staleTime: 3600 * 1000,
    enabled: sourceBranchId !== undefined,
  });

  // Create transfer mutation
  const createMutation = useMutation({
    mutationFn: inventoryApi.createTransfer,
    onSuccess: () => {
      messageApi?.success("Transfer created successfully");
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      navigate("/inventory/transfers");
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create transfer"
      );
    },
  });

  const handleSourceBranchChange = (branchId: number) => {
    setSourceBranchId(branchId);
    setSelectedItems([]); // Clear selected items when source changes
  };

  const handleAddItem = (batch: InventoryBatch) => {
    const existingItem = selectedItems.find(
      (item) => item.batch_id === batch.id
    );

    if (existingItem) {
      messageApi?.warning("This batch is already added");
      return;
    }

    const newItem: TransferItem = {
      key: `${batch.id}-${Date.now()}`,
      batch_id: batch.id,
      batch: batch,
      quantity: 1,
      max_quantity: batch.quantity,
    };

    setSelectedItems([...selectedItems, newItem]);
  };

  const handleRemoveItem = (key: string) => {
    setSelectedItems(selectedItems.filter((item) => item.key !== key));
  };

  const handleQuantityChange = (key: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.key === key ? { ...item, quantity } : item
      )
    );
  };

  const handleSubmit = async (values: any) => {
    if (sourceBranchId === undefined || destinationBranchId === undefined) {
      messageApi?.error("Please select both source and destination branches");
      return;
    }

    if (sourceBranchId === destinationBranchId) {
      messageApi?.error("Source and destination branches cannot be the same");
      return;
    }

    if (selectedItems.length === 0) {
      messageApi?.error("Please add at least one item to transfer");
      return;
    }

    // Validate quantities
    const invalidItems = selectedItems.filter(
      (item) => item.quantity <= 0 || item.quantity > item.max_quantity
    );

    if (invalidItems.length > 0) {
      messageApi?.error("Please check the quantities for all items");
      return;
    }

    const transferData: CreateTransferData = {
      source_branch_id: sourceBranchId,
      destination_branch_id: destinationBranchId,
      notes: values.notes,
      items: selectedItems.map((item) => ({
        batch_id: item.batch_id,
        quantity: item.quantity,
      })),
    };

    createMutation.mutate(transferData);
  };

  // Columns for available batches
  const availableBatchesColumns = [
    {
      title: "Product",
      key: "product",
      render: (_, record: InventoryBatch) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.variant.product.name}</div>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.variant.name}
          </Text>
        </div>
      ),
    },
    {
      title: "Reference",
      dataIndex: "batch_number",
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: "Available",
      dataIndex: "quantity",
      align: "right" as const,
      render: (quantity: number) => <Text strong>{quantity} units</Text>,
    },
    {
      title: "Cost Price",
      dataIndex: "cost_price",
      align: "right" as const,
      render: (price: string) => `$${parseFloat(price).toFixed(2)}`,
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, record: InventoryBatch) => (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => handleAddItem(record)}
          disabled={selectedItems.some((item) => item.batch_id === record.id)}
        >
          Add
        </Button>
      ),
    },
  ];

  // Columns for selected items
  const selectedItemsColumns = [
    {
      title: "Product",
      key: "product",
      render: (_, record: TransferItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.batch.variant.product.name}
          </div>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.batch.variant.name} - {record.batch.batch_number}
          </Text>
        </div>
      ),
    },
    {
      title: "Available",
      key: "available",
      align: "right" as const,
      render: (_, record: TransferItem) => (
        <Text>{record.max_quantity} units</Text>
      ),
    },
    {
      title: "Transfer Quantity",
      key: "quantity",
      align: "right" as const,
      render: (_, record: TransferItem) => (
        <InputNumber
          min={1}
          max={record.max_quantity}
          value={record.quantity}
          onChange={(value) => handleQuantityChange(record.key, value || 1)}
          style={{ width: 100 }}
          addonAfter="units"
        />
      ),
    },
    {
      title: "Total Value",
      key: "total_value",
      align: "right" as const,
      render: (_, record: TransferItem) => (
        <Text strong>
          ${(parseFloat(record.batch.cost_price) * record.quantity).toFixed(2)}
        </Text>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 80,
      render: (_, record: TransferItem) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.key)}
        />
      ),
    },
  ];

  if (branchesLoading) {
    return <CenterLoader />;
  }

  const totalTransferValue = selectedItems.reduce(
    (sum, item) => sum + parseFloat(item.batch.cost_price) * item.quantity,
    0
  );

  // Helper function to get branch name
  const getBranchName = (branchId: number | undefined) => {
    if (branchId === undefined) return "Unknown";
    return branches.find((b) => b.id === branchId)?.name || "Unknown";
  };

  return (
    <>
      <PageTitle
        title="Create Inventory Transfer"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory" },
          { title: "Transfers", href: "/inventory/transfers" },
          { title: "Create Transfer" },
        ]}
        rightSection={
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/inventory/transfers")}
          >
            Back to Transfers
          </Button>
        }
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {/* Branch Selection */}
        <Card title="Transfer Details" style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col span={10}>
              <Form.Item
                label="Source Branch"
                rules={[
                  { required: true, message: "Please select source branch" },
                ]}
              >
                <Select
                  placeholder="Select source branch"
                  value={sourceBranchId}
                  onChange={handleSourceBranchChange}
                  showSearch
                  optionFilterProp="children"
                >
                  {branches.map((branch) => (
                    <Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={4} style={{ textAlign: "center", paddingTop: 30 }}>
              <SwapOutlined style={{ fontSize: 24, color: "#1890ff" }} />
            </Col>

            <Col span={10}>
              <Form.Item
                label="Destination Branch"
                rules={[
                  {
                    required: true,
                    message: "Please select destination branch",
                  },
                ]}
              >
                <Select
                  placeholder="Select destination branch"
                  value={destinationBranchId}
                  onChange={setDestinationBranchId}
                  showSearch
                  optionFilterProp="children"
                >
                  {branches
                    .filter((branch) => branch.id !== sourceBranchId)
                    .map((branch) => (
                      <Option key={branch.id} value={branch.id}>
                        {branch.name}
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="Transfer Notes"
            extra="Optional notes about this transfer"
          >
            <TextArea
              rows={3}
              placeholder="Enter any additional notes about this transfer..."
            />
          </Form.Item>
        </Card>

        {/* Available Inventory */}
        {sourceBranchId !== null && (
          <Card
            title={`Available Inventory - ${getBranchName(sourceBranchId)}`}
            style={{ marginBottom: 24 }}
            extra={
              <Input
                placeholder="Search products..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
            }
          >
            <Table
              columns={availableBatchesColumns}
              dataSource={sourceBatches?.data || []}
              rowKey="id"
              loading={sourceBatchesLoading}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
              locale={{
                emptyText:
                  sourceBranchId === null
                    ? "No inventory found in warehouse"
                    : "No inventory found in this branch",
              }}
            />
          </Card>
        )}

        {/* Selected Items */}
        {selectedItems.length > 0 && (
          <Card title="Items to Transfer" style={{ marginBottom: 24 }}>
            <Table
              columns={selectedItemsColumns}
              dataSource={selectedItems}
              rowKey="key"
              pagination={false}
              size="small"
            />

            <Divider />

            <Row justify="end">
              <Col>
                <Space direction="vertical" align="end">
                  <div>
                    <Text strong>Total Items: </Text>
                    <Text>{selectedItems.length}</Text>
                  </div>
                  <div>
                    <Text strong>Total Units: </Text>
                    <Text>
                      {selectedItems.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      )}
                    </Text>
                  </div>
                  <div>
                    <Text strong>Total Value: </Text>
                    <Text strong style={{ fontSize: 16 }}>
                      ${totalTransferValue.toFixed(2)}
                    </Text>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>
        )}

        {/* Submit */}
        <div style={{ textAlign: "right" }}>
          <Space>
            <Button onClick={() => navigate("/inventory/transfers")}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending}
              icon={<SaveOutlined />}
              disabled={selectedItems.length === 0}
            >
              Create Transfer
            </Button>
          </Space>
        </div>
      </Form>
    </>
  );
}
