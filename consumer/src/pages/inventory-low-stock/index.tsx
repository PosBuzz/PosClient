import {
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { inventoryApi } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useModalStore } from "../../stores/modalStore";
import useDarkMode from "../../hooks/useDarkMode";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { Option } = Select;

interface LowStockItem {
  id: number;
  name: string;
  sku?: string;
  alert_quantity: number;
  product: {
    id: number;
    name: string;
  };
  total_stock: number;
  stock_by_branch: Record<string, number>;
  shortage: number;
  inventory_items: Array<{
    quantity: number;
    branch: {
      id: number;
      name: string;
    };
  }>;
}

export default function InventoryLowStockPage() {
  const navigate = useNavigate();
  const { modal } = useModalStore();
  const isDarkMode = useDarkMode();

  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search
  const debouncedSearch = useCallback(
    debounce((nextValue: string) => setDebouncedSearchText(nextValue), 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchText, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchText, selectedBranch]);

  // Queries
  const { data: lowStockData, isLoading: lowStockLoading } = useQuery({
    queryKey: [
      queryKeys.lowStockItems,
      currentPage,
      pageSize,
      debouncedSearchText,
      selectedBranch,
    ],
    queryFn: () =>
      inventoryApi.getLowStockItems({
        page: currentPage,
        limit: pageSize,
        branch_id: selectedBranch,
      }),
    staleTime: 3600 * 1000,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: 3600 * 1000,
  });
  const getUrgencyConfig = (item: LowStockItem) => {
    const stockRatio = item.total_stock / (item.alert_quantity || 1);

    if (item.total_stock === 0) {
      return {
        level: "critical" as const,
        color: "#ff4d4f",
        bgColor: "#fff2f0",
        text: "Out of Stock",
        icon: <WarningOutlined />,
      };
    } else if (stockRatio <= 0.25) {
      return {
        level: "critical" as const,
        color: "#ff4d4f",
        bgColor: "#fff2f0",
        text: "Critical",
        icon: <WarningOutlined />,
      };
    } else if (stockRatio <= 0.5) {
      return {
        level: "warning" as const,
        color: "#fa8c16",
        bgColor: "#fff7e6",
        text: "Warning",
        icon: <WarningOutlined />,
      };
    } else {
      return {
        level: "attention" as const,
        color: "#fadb14",
        bgColor: "#feffe6",
        text: "Low",
        icon: <WarningOutlined />,
      };
    }
  };
  const handleView = (record: LowStockItem) => {
    const urgency = getUrgencyConfig(record);
    const stockRatio = record.total_stock / (record.alert_quantity || 1);

    modal?.info({
      title: "Low Stock Item Details",
      width: 800,
      content: (
        <div style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Product:</Text>
              <br />
              <Text>{record.product.name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Variant:</Text>
              <br />
              <Text>{record.name}</Text>
            </Col>
            {record.sku && (
              <Col span={12}>
                <Text strong>SKU:</Text>
                <br />
                <Text code>{record.sku}</Text>
              </Col>
            )}
            <Col span={12}>
              <Text strong>Current Stock:</Text>
              <br />
              <Text strong style={{ fontSize: "16px", color: urgency.color }}>
                {record.total_stock} units
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Alert Threshold:</Text>
              <br />
              <Text>{record.alert_quantity} units</Text>
            </Col>
            <Col span={12}>
              <Text strong>Stock Level:</Text>
              <br />
              <Space>
                <Progress
                  percent={Number(
                    Math.min(stockRatio * 100, 100).toPrecision(4)
                  )}
                  strokeColor={urgency.color}
                  size="small"
                  style={{ width: 100 }}
                />
                <Tag
                  color={
                    urgency.level === "critical"
                      ? "red"
                      : urgency.level === "warning"
                      ? "orange"
                      : "yellow"
                  }
                >
                  {urgency.text}
                </Tag>
              </Space>
            </Col>
          </Row>

          <div style={{ marginTop: 24 }}>
            <Text strong>Stock by Branch:</Text>
            <Table
              dataSource={Object.entries(record.stock_by_branch).map(
                ([branchName, stock]) => ({
                  key: branchName,
                  branch_name: branchName,
                  stock,
                })
              )}
              rowKey="key"
              pagination={false}
              size="small"
              style={{ marginTop: 8 }}
              columns={[
                {
                  title: "Branch",
                  dataIndex: "branch_name",
                  key: "branch_name",
                  render: (name) => (
                    <Space>
                      <ShopOutlined />
                      <Text>{name}</Text>
                    </Space>
                  ),
                },
                {
                  title: "Stock",
                  dataIndex: "stock",
                  key: "stock",
                  align: "right",
                  render: (stock) => (
                    <Text
                      strong
                      style={{ color: stock > 0 ? "#52c41a" : "#ff4d4f" }}
                    >
                      {stock} units
                    </Text>
                  ),
                },
                {
                  title: "Status",
                  key: "status",
                  align: "center",
                  render: (_, branchRecord) => (
                    <Tag color={branchRecord.stock > 0 ? "green" : "red"}>
                      {branchRecord.stock > 0 ? "Available" : "Out of Stock"}
                    </Tag>
                  ),
                },
              ]}
            />
          </div>
        </div>
      ),
    });
  };

  const handleViewVariantStock = (variantId: number) => {
    navigate(`/inventory/variants/${variantId}/stock`);
  };

  const clearFilters = () => {
    setSearchText("");
    setDebouncedSearchText("");
    setSelectedBranch(undefined);
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return debouncedSearchText || selectedBranch !== undefined;
  };
  // Filter items by search text if needed (client-side filtering for better UX)
  const filteredData =
    lowStockData?.filter((item) => {
      if (!debouncedSearchText) return true;
      const searchLower = debouncedSearchText.toLowerCase();
      return (
        item.product.name.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower) ||
        (item.sku && item.sku.toLowerCase().includes(searchLower))
      );
    }) || [];
  const columns: ColumnsType<LowStockItem> = [
    {
      title: "Product",
      key: "product",
      render: (_, record) => {
        const urgency = getUrgencyConfig(record);
        return (
          <div>
            <Link to={`/products/view/${record.product.id}`}>
              <div
                style={{
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {urgency.icon}
                {record.product.name}
              </div>
            </Link>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.name}
              {record.sku && ` • SKU: ${record.sku}`}
            </Text>
          </div>
        );
      },
    },
    {
      title: "Current Stock",
      key: "current_stock",
      align: "right",
      render: (_, record) => {
        const urgency = getUrgencyConfig(record);
        const stockRatio = record.total_stock / (record.alert_quantity || 1);
        return (
          <Space direction="vertical" size={4}>
            <Text
              strong
              style={{
                color: urgency.color,
                fontSize: "16px",
              }}
            >
              {record.total_stock} units
            </Text>
            <Progress
              percent={Math.min(stockRatio * 100, 100)}
              strokeColor={urgency.color}
              size="small"
              showInfo={false}
            />
          </Space>
        );
      },
    },
    {
      title: "Alert Threshold",
      dataIndex: "alert_quantity",
      key: "alert_quantity",
      align: "right",
      render: (qty) => <Text>{qty} units</Text>,
    },
    {
      title: "Stock Ratio",
      key: "stock_ratio",
      align: "center",
      render: (_, record) => {
        const stockRatio = record.total_stock / (record.alert_quantity || 1);
        const percentage = Math.round(stockRatio * 100);
        const urgency = getUrgencyConfig(record);
        return (
          <Tag
            color={
              urgency.level === "critical"
                ? "red"
                : urgency.level === "warning"
                ? "orange"
                : "yellow"
            }
          >
            {percentage}%
          </Tag>
        );
      },
      sorter: (a, b) => {
        const ratioA = a.total_stock / (a.alert_quantity || 1);
        const ratioB = b.total_stock / (b.alert_quantity || 1);
        return ratioA - ratioB;
      },
    },
    {
      title: "Urgency",
      key: "urgency",
      align: "center",
      render: (_, record) => {
        const urgency = getUrgencyConfig(record);
        return (
          <Tag
            color={
              urgency.level === "critical"
                ? "red"
                : urgency.level === "warning"
                ? "orange"
                : "yellow"
            }
            icon={urgency.icon}
          >
            {urgency.text}
          </Tag>
        );
      },
      sorter: (a, b) => {
        const urgencyOrder = { critical: 3, warning: 2, attention: 1 };
        const urgencyA = getUrgencyConfig(a);
        const urgencyB = getUrgencyConfig(b);
        return urgencyOrder[urgencyB.level] - urgencyOrder[urgencyA.level];
      },
      defaultSortOrder: "ascend",
    },
    {
      title: "Branches",
      key: "branches",
      render: (_, record) => (
        <Space wrap>
          {Object.entries(record.stock_by_branch).map(([branchName, stock]) => (
            <Tag key={branchName} color={stock > 0 ? "blue" : "red"}>
              {branchName}: {stock}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 150,
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
          <Tooltip title="View Variant Stock">
            <Button
              type="primary"
              size="small"
              onClick={() => handleViewVariantStock(record.id)}
            >
              View Stock
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const getCardStyle = () => ({
    backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
    borderColor: isDarkMode ? "#303030" : "#d9d9d9",
  });

  const getSummaryTextColor = () => (isDarkMode ? "#d9d9d9" : "#666");

  if (branchesLoading && currentPage === 1) {
    return <CenterLoader />;
  }

  const criticalCount = filteredData.filter(
    (item) => getUrgencyConfig(item).level === "critical"
  ).length;
  const warningCount = filteredData.filter(
    (item) => getUrgencyConfig(item).level === "warning"
  ).length;
  const attentionCount = filteredData.filter(
    (item) => getUrgencyConfig(item).level === "attention"
  ).length;

  return (
    <>
      {setPageTitle("Low Stock Items")}
      <PageTitle
        title="Low Stock Items"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Low Stock" },
        ]}
      />
      {/* Alert Summary */}
      {filteredData.length > 0 && (
        <Alert
          message="Low Stock Alert"
          description={`You have ${filteredData.length} items below their alert thresholds. ${criticalCount} critical, ${warningCount} warning level.`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button
              size="small"
              type="text"
              onClick={() => navigate("/inventory/stock-by-variant")}
            >
              View All Stock
            </Button>
          }
        />
      )}
      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {" "}
        <Col span={6}>
          <Card style={getCardStyle()}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#ff4d4f",
                }}
              >
                {criticalCount}
              </div>
              <div style={{ color: getSummaryTextColor() }}>Critical</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={getCardStyle()}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#fa8c16",
                }}
              >
                {warningCount}
              </div>
              <div style={{ color: getSummaryTextColor() }}>Warning</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={getCardStyle()}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#fadb14",
                }}
              >
                {attentionCount}
              </div>
              <div style={{ color: getSummaryTextColor() }}>Attention</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={getCardStyle()}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#1890ff",
                }}
              >
                {filteredData.length}
              </div>
              <div style={{ color: getSummaryTextColor() }}>Total Items</div>
            </div>
          </Card>
        </Col>
      </Row>{" "}
      {/* Filters */}
      <Card style={{ ...getCardStyle(), marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search products, variants, or SKU..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="All Branches"
              style={{ width: "100%" }}
              value={selectedBranch}
              onChange={setSelectedBranch}
              allowClear
              loading={branchesLoading}
            >
              {branches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={clearFilters}
              style={{ width: "100%" }}
            >
              Reset
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
                  <Tag
                    closable
                    onClose={() => {
                      setSearchText("");
                      setDebouncedSearchText("");
                    }}
                  >
                    Search: "{debouncedSearchText}"
                  </Tag>
                )}

                {selectedBranch !== undefined && (
                  <Tag closable onClose={() => setSelectedBranch(undefined)}>
                    Branch:{" "}
                    {branches.find((b) => b.id === selectedBranch)?.name}
                  </Tag>
                )}
              </Space>
            </Col>
          </Row>
        )}
      </Card>
      {/* Table */}
      <Card style={getCardStyle()}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="variant_id"
          loading={lowStockLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: filteredData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} low stock items`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1400 }}
          rowClassName={(record) => {
            const urgency = getUrgencyConfig(record);
            if (urgency.level === "critical") return "table-row-critical";
            if (urgency.level === "warning") return "table-row-warning";
            return "table-row-attention";
          }}
        />
      </Card>{" "}
      <style>{`
        .table-row-critical {
          background-color: ${isDarkMode ? "#2a1a1a" : "#fff2f0"} !important;
        }
        .table-row-warning {
          background-color: ${isDarkMode ? "#2a2219" : "#fff7e6"} !important;
        }
        .table-row-attention {
          background-color: ${isDarkMode ? "#262a16" : "#feffe6"} !important;
        }
      `}</style>
    </>
  );
}
