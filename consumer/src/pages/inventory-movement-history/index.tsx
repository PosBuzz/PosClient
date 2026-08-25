import {
  ArrowLeftOutlined,
  ReloadOutlined,
  FileTextOutlined,
  PlusOutlined,
  MinusOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { inventoryApi } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { Option } = Select;

interface MovementHistoryItem {
  id: number;
  type: "adjustment" | "transfer_in" | "transfer_out";
  date: string;
  quantity_change: number;
  reason?: string;
  notes?: string;
  batch_number?: string;
  location?: string;
  user?: {
    id: number;
    name: string;
  };
}

interface MovementHistoryResponse {
  data: MovementHistoryItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const InventoryMovementHistory: React.FC = () => {
  const { variantId } = useParams<{ variantId: string }>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [branchId, setBranchId] = useState<number | undefined>();

  // Get variant details first
  const {
    data: variantData,
    isLoading: isLoadingVariant,
    error: variantError,
  } = useQuery({
    queryKey: [queryKeys.variantStock, variantId],
    queryFn: () => inventoryApi.getVariantStock(Number(variantId!)),
    enabled: !!variantId,
    retry: 1,
    staleTime: queryStaleTimeMap[queryKeys.variantStock],
  });

  // Get movement history
  const {
    data: movementData,
    isLoading: isLoadingMovements,
    error: movementError,
    refetch,
  } = useQuery<MovementHistoryResponse>({
    queryKey: [
      queryKeys.movementHistory,
      variantId,
      currentPage,
      pageSize,
      branchId,
    ],
    queryFn: () =>
      inventoryApi.getInventoryMovementHistory(Number(variantId!), {
        page: currentPage,
        limit: pageSize,
        branch_id: branchId,
      }),
    enabled: !!variantId,
    retry: 1,
    staleTime: queryStaleTimeMap[queryKeys.movementHistory],
  });

  // Get branches for filter
  const { data: branchesData } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case "adjustment":
        return <FileTextOutlined style={{ color: "#1890ff" }} />;
      case "transfer_in":
        return <PlusOutlined style={{ color: "#52c41a" }} />;
      case "transfer_out":
        return <MinusOutlined style={{ color: "#ff4d4f" }} />;
      default:
        return <SwapOutlined />;
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case "adjustment":
        return "blue";
      case "transfer_in":
        return "green";
      case "transfer_out":
        return "red";
      default:
        return "default";
    }
  };

  const getMovementTypeName = (type: string) => {
    switch (type) {
      case "adjustment":
        return "Adjustment";
      case "transfer_in":
        return "Transfer In";
      case "transfer_out":
        return "Transfer Out";
      default:
        return type;
    }
  };

  const columns: ColumnsType<MovementHistoryItem> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type) => (
        <Space>
          {getMovementTypeIcon(type)}
          <Tag color={getMovementTypeColor(type)}>
            {getMovementTypeName(type)}
          </Tag>
        </Space>
      ),
      filters: [
        { text: "Adjustment", value: "adjustment" },
        { text: "Transfer In", value: "transfer_in" },
        { text: "Transfer Out", value: "transfer_out" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Quantity Change",
      dataIndex: "quantity_change",
      key: "quantity_change",
      render: (quantity) => (
        <Text
          style={{
            color:
              quantity > 0 ? "#52c41a" : quantity < 0 ? "#ff4d4f" : "inherit",
            fontWeight: "bold",
          }}
        >
          {quantity > 0 ? "+" : ""}
          {quantity}
        </Text>
      ),
    },
    {
      title: "Batch",
      dataIndex: "batch_number",
      key: "batch_number",
      render: (batchNumber) => batchNumber || "-",
    },
    {
      title: "Location",
      dataIndex: "location",
      key: "location",
      render: (location) => location || "-",
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason) => reason || "-",
      ellipsis: true,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes) => notes || "-",
      ellipsis: true,
    },
    {
      title: "User",
      dataIndex: "user",
      key: "user",
      render: (user) => user?.name || "-",
    },
  ];

  const handleTableChange = (pagination: any) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  const breadcrumbs = [
    {
      title: "Inventory",
      href: "/inventory/batches",
    },
    {
      title: "Stock by Variant",
      href: "/inventory/stock-by-variant",
    },
    {
      title: variantData?.name || "Movement History",
    },
  ];

  if (isLoadingVariant) {
    return <CenterLoader />;
  }

  if (variantError) {
    return (
      <div style={{ padding: "24px" }}>
        <Alert
          message="Error"
          description="Failed to load variant information. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      {setPageTitle("Inventory Movement History")}
      <PageTitle
        title={`Movement History - ${variantData?.name || "Variant"}`}
        breadcrumbs={breadcrumbs}
      />

      <Card>
        {/* Variant Info */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong>Product:</Text>
              <br />
              <Text>{variantData?.product?.name}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong>Variant:</Text>
              <br />
              <Text>{variantData?.name}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong>SKU:</Text>
              <br />
              <Text>{variantData?.sku || "N/A"}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong>Current Stock:</Text>
              <br />
              <Text style={{ fontSize: "16px", fontWeight: "bold" }}>
                {variantData?.total_stock || 0}
              </Text>
            </div>
          </Col>{" "}
          {variantData?.alert_quantity && (
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong>Alert Quantity (Per Branch):</Text>
                <br />
                <Text>{variantData.alert_quantity}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  Low stock alerts are triggered when any branch falls below
                  this threshold
                </Text>
              </div>
            </Col>
          )}
        </Row>

        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Select branch"
              style={{ width: "100%" }}
              allowClear
              value={branchId}
              onChange={setBranchId}
            >
              {branchesData?.map((branch: any) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={isLoadingMovements}
            >
              Refresh
            </Button>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              Back to Stock Details
            </Button>
          </Col>
        </Row>

        {/* Movement History Table */}
        <Table
          columns={columns}
          dataSource={movementData?.data}
          loading={isLoadingMovements}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: movementData?.meta?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} movements`,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
        />

        {movementError && (
          <Alert
            message="Error"
            description="Failed to load movement history. Please try again."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    </>
  );
};

export default InventoryMovementHistory;
