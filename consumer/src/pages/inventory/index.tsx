import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryApi, InventoryBatch } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";

const { Text } = Typography;
const { Option } = Select;

export default function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Input state (tracks what the user is typing)
  const [searchText, setSearchText] = useState("");
  // Debounced state (used for actual API calls)
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [selectedVariant, setSelectedVariant] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce function to delay API calls
  const debouncedSearch = useCallback(
    debounce((nextValue: string) => setDebouncedSearchText(nextValue), 500),
    []
  );

  // Effect to trigger debounced search when searchText changes
  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel(); // Cleanup on unmount
    };
  }, [searchText, debouncedSearch]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchText, selectedBranch, selectedVariant]);

  // Queries
  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: [
      "batches",
      currentPage,
      pageSize,
      debouncedSearchText,
      selectedBranch,
      selectedVariant,
    ],
    queryFn: () =>
      inventoryApi.getBatches({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearchText || undefined,
        branch_id: selectedBranch,
        variant_id: selectedVariant,
      }),
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => inventoryApi.getBranches(),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["inventory-summary", selectedBranch],
    queryFn: () => inventoryApi.getSummary(selectedBranch),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: inventoryApi.deleteBatch,
    onSuccess: () => {
      message.success("Batch deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "Failed to delete batch");
    },
  });

  const handleDelete = (batchId: number) => {
    deleteMutation.mutate(batchId);
  };

  const handleEdit = (batchId: number) => {
    navigate(`/inventory/batches/edit/${batchId}`);
  };

  // Handle search input change (this updates the input value instantly, but API call is debounced)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  // Handle search clear
  const handleSearchClear = () => {
    setSearchText("");
    setDebouncedSearchText("");
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearchText("");
    setDebouncedSearchText("");
    setSelectedBranch(undefined);
    setSelectedVariant(undefined);
    setCurrentPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      debouncedSearchText ||
      selectedBranch !== undefined ||
      selectedVariant !== undefined
    );
  };

  const handleView = (batch: InventoryBatch) => {
    Modal.info({
      title: "Batch Details",
      width: 600,
      content: (
        <div style={{ marginTop: 16 }}>
          <Row gutter={[16, 8]}>
            <Col span={8}>
              <Text strong>Product:</Text>
            </Col>
            <Col span={16}>
              <Text>
                {batch.variant.product.name} - {batch.variant.name}
              </Text>
            </Col>

            <Col span={8}>
              <Text strong>Reference:</Text>
            </Col>
            <Col span={16}>
              <Text>{batch.batch_number}</Text>
            </Col>

            <Col span={8}>
              <Text strong>Quantity:</Text>
            </Col>
            <Col span={16}>
              <Text>{batch.quantity} units</Text>
            </Col>

            <Col span={8}>
              <Text strong>Cost Price:</Text>
            </Col>
            <Col span={16}>
              <Text>${parseFloat(batch.cost_price).toFixed(2)} per unit</Text>
            </Col>

            <Col span={8}>
              <Text strong>Total Value:</Text>
            </Col>
            <Col span={16}>
              <Text strong>
                ${(parseFloat(batch.cost_price) * batch.quantity).toFixed(2)}
              </Text>
            </Col>

            {batch.branch && (
              <>
                <Col span={8}>
                  <Text strong>Branch:</Text>
                </Col>
                <Col span={16}>
                  <Text>{batch.branch.name}</Text>
                </Col>
              </>
            )}

            {batch.vendor && (
              <>
                <Col span={8}>
                  <Text strong>Vendor:</Text>
                </Col>
                <Col span={16}>
                  <Text>{batch.vendor.name}</Text>
                </Col>
              </>
            )}

            {batch.expiry_date && (
              <>
                <Col span={8}>
                  <Text strong>Expiry Date:</Text>
                </Col>
                <Col span={16}>
                  <Text>
                    {dayjs(batch.expiry_date).format("MMM DD, YYYY")}
                    {dayjs(batch.expiry_date).isBefore(
                      dayjs().add(30, "days")
                    ) && (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        Expiring Soon
                      </Tag>
                    )}
                  </Text>
                </Col>
              </>
            )}

            <Col span={8}>
              <Text strong>Created:</Text>
            </Col>
            <Col span={16}>
              <Text>
                {dayjs(batch.created_at).format("MMM DD, YYYY HH:mm")}
              </Text>
            </Col>
          </Row>
        </div>
      ),
    });
  };

  const getExpiryStatus = (expiryDate: string) => {
    if (!expiryDate) return null;

    const now = dayjs();
    const expiry = dayjs(expiryDate);
    const daysUntilExpiry = expiry.diff(now, "days");

    if (daysUntilExpiry < 0) {
      return { color: "red", text: "Expired" };
    } else if (daysUntilExpiry <= 7) {
      return { color: "red", text: `${daysUntilExpiry}d left` };
    } else if (daysUntilExpiry <= 30) {
      return { color: "orange", text: `${daysUntilExpiry}d left` };
    }
    return null;
  };

  const columns: ColumnsType<InventoryBatch> = [
    {
      title: "Product",
      key: "product",
      render: (_, record) => (
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
      key: "batch_number",
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      render: (quantity) => <Text strong>{quantity} units</Text>,
    },
    {
      title: "Cost Price",
      dataIndex: "cost_price",
      key: "cost_price",
      align: "right",
      render: (price) => `$${parseFloat(price).toFixed(2)}`,
    },
    {
      title: "Total Value",
      key: "total_value",
      align: "right",
      render: (_, record) => (
        <Text strong>
          ${(parseFloat(record.cost_price) * record.quantity).toFixed(2)}
        </Text>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <Tag color={record.branch ? "blue" : "default"}>
          {record.branch?.name || "Warehouse"}
        </Tag>
      ),
    },
    {
      title: "Expiry",
      dataIndex: "expiry_date",
      key: "expiry_date",
      render: (date) => {
        if (!date) return <Text type="secondary">No expiry</Text>;

        const status = getExpiryStatus(date);
        return (
          <div>
            <div>{dayjs(date).format("MMM DD, YYYY")}</div>
            {status && (
              <Tag color={status.color} style={{ marginTop: 4 }}>
                {status.text}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Batch"
            description="Are you sure you want to delete this batch? This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okType="danger"
            icon={<WarningOutlined style={{ color: "red" }} />}
          >
            <Tooltip title="Delete">
              <Button
                type="primary"
                size="small"
                icon={<DeleteOutlined />}
                danger
                loading={
                  deleteMutation.isPending &&
                  deleteMutation.variables === record.id
                }
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Show center loader for initial loading states (but not for table loading)
  if ((branchesLoading || summaryLoading) && currentPage === 1) {
    return <CenterLoader />;
  }

  return (
    <>
      {/* Header */}
      <PageTitle
        title="Inventory Management"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory" },
        ]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/inventory/batches/add")}
          >
            Add Inventory
          </Button>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card size="small">
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#1890ff",
                  }}
                >
                  {summary.total_batches}
                </div>
                <div style={{ color: "#666" }}>Total Batches</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#52c41a",
                  }}
                >
                  {summary.total_quantity}
                </div>
                <div style={{ color: "#666" }}>Total Units</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#faad14",
                  }}
                >
                  {summary.low_stock_variants}
                </div>
                <div style={{ color: "#666" }}>Low Stock Items</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#ff4d4f",
                  }}
                >
                  {summary.expiring_soon}
                </div>
                <div style={{ color: "#666" }}>Expiring Soon</div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Search by product name, variant, or reference number..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={handleSearchChange}
              allowClear
              onClear={handleSearchClear}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              placeholder="All Branches"
              style={{ width: "100%" }}
              value={selectedBranch}
              onChange={setSelectedBranch}
              allowClear
              loading={branchesLoading}
            >
              <Option value={undefined}>Warehouse</Option>
              {branches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4} lg={3}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {batchesData?.meta?.total || 0} batches found
              </Text>
              {hasActiveFilters() && (
                <Button
                  type="link"
                  size="small"
                  onClick={handleClearAllFilters}
                  style={{ padding: 0, height: "auto", fontSize: "11px" }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleClearAllFilters}
              style={{ width: "100%" }}
            >
              Reset Filters
            </Button>
          </Col>
        </Row>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Space wrap>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  Active filters:
                </Text>

                {debouncedSearchText && (
                  <Tag closable onClose={handleSearchClear}>
                    Search: "{debouncedSearchText}"
                  </Tag>
                )}

                {selectedBranch !== undefined && (
                  <Tag
                    closable
                    onClose={() => setSelectedBranch(undefined)}
                  >
                    Branch:{" "}
                    {branches.find((b) => b.id === selectedBranch)?.name ||
                      "Warehouse"}
                  </Tag>
                )}
              </Space>
            </Col>
          </Row>
        )}
      </Card>

      {/* Alerts for expiring items */}
      {summary && summary.expiring_soon > 0 && (
        <Alert
          message="Items Expiring Soon"
          description={`You have ${summary.expiring_soon} batches that will expire within the next 30 days. Please review and take necessary action.`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button
              size="small"
              type="text"
              onClick={() => navigate("/inventory/batches/expiring")}
            >
              View Details
            </Button>
          }
        />
      )}

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={batchesData?.data || []}
          rowKey="id"
          loading={batchesLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: batchesData?.meta.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} batches`,
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>
    </>
  );
}
