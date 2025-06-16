import {
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  WarningOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Switch,
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

const { Text } = Typography;
const { Option } = Select;

interface StockByVariantItem {
  id: number;
  name: string;
  sku?: string;
  alert_quantity?: number;
  product: {
    id: number;
    name: string;
  };
  total_stock: number;
  is_low_stock: boolean;
  stock_by_branch: Record<string, number>;
  inventory_items: Array<{
    quantity: number;
    branch_id: number;
    branch: {
      id: number;
      name: string;
    };
  }>;
}

export default function InventoryStockByVariantPage() {
  const navigate = useNavigate();
  const { modal } = useModalStore();

  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [lowStockOnly, setLowStockOnly] = useState(false);
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
  }, [debouncedSearchText, selectedBranch, lowStockOnly]);

  // Queries
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: [
      queryKeys.stockByVariant,
      currentPage,
      pageSize,
      debouncedSearchText,
      selectedBranch,
      lowStockOnly,
    ],
    queryFn: () =>
      inventoryApi.getStockByVariant({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearchText || undefined,
        branch_id: selectedBranch,
        low_stock_only: lowStockOnly,
      }),
    staleTime: 3600 * 1000,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: 3600 * 1000,
  });
  const handleView = (record: StockByVariantItem) => {
    modal?.info({
      title: "Variant Stock Details",
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
              <Text strong>Total Stock:</Text>
              <br />
              <Text
                strong
                style={{
                  fontSize: "16px",
                  color: record.is_low_stock ? "#ff4d4f" : "#52c41a",
                }}
              >
                {record.total_stock} units
              </Text>
            </Col>
            {record.alert_quantity && (
              <Col span={12}>
                <Text strong>Alert Threshold:</Text>
                <br />
                <Text>{record.alert_quantity} units</Text>
              </Col>
            )}
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
                      style={{ color: stock > 0 ? "#52c41a" : "#8c8c8c" }}
                    >
                      {stock} units
                    </Text>
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
    setLowStockOnly(false);
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return debouncedSearchText || selectedBranch !== undefined || lowStockOnly;
  };
  const columns: ColumnsType<StockByVariantItem> = [
    {
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div>
          <Link to={`/products/view/${record.product.id}`}>
            <p style={{ fontWeight: 500 }}>{record.product.name}</p>
          </Link>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.name}
            {record.sku && ` • SKU: ${record.sku}`}
          </Text>
        </div>
      ),
    },
    {
      title: "Total Stock",
      key: "total_stock",
      align: "right",
      render: (_, record) => (
        <Space>
          <Text
            strong
            style={{
              color: record.is_low_stock
                ? "#ff4d4f"
                : record.total_stock > 0
                ? "#52c41a"
                : "#8c8c8c",
              fontSize: "16px",
            }}
          >
            {record.total_stock}
          </Text>
          <Text type="secondary">units</Text>
          {record.is_low_stock && (
            <Tooltip title="Low stock alert">
              <WarningOutlined style={{ color: "#ff4d4f" }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Alert Threshold",
      dataIndex: "alert_quantity",
      key: "alert_quantity",
      align: "right",
      render: (qty) => (
        <Text type="secondary">{qty ? `${qty} units` : "Not set"}</Text>
      ),
    },
    {
      title: "Branches",
      key: "branches",
      render: (_, record) => (
        <Space wrap>
          {Object.entries(record.stock_by_branch).map(([branchName, stock]) => (
            <Tag key={branchName} color={stock > 0 ? "blue" : "default"}>
              {branchName}: {stock}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Status",
      key: "status",
      align: "center",
      render: (_, record) => (
        <Tag
          color={
            record.is_low_stock
              ? "red"
              : record.total_stock > 0
              ? "green"
              : "default"
          }
        >
          {record.is_low_stock
            ? "Low Stock"
            : record.total_stock > 0
            ? "In Stock"
            : "Out of Stock"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 200,
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
          <Tooltip title="Movement History">
            <Button
              type="default"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() =>
                navigate(`/inventory/movement-history/${record.id}`)
              }
            >
              History
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (branchesLoading && currentPage === 1) {
    return <CenterLoader />;
  }

  return (
    <>
      <PageTitle
        title="Stock by Variant"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory" },
          { title: "Stock by Variant" },
        ]}
      />

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search products or variants..."
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
          <Col xs={24} sm={12} md={6}>
            <Space>
              <Text>Low Stock Only:</Text>
              <Switch
                checked={lowStockOnly}
                onChange={setLowStockOnly}
                checkedChildren="Yes"
                unCheckedChildren="No"
              />
            </Space>
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

                {lowStockOnly && (
                  <Tag closable onClose={() => setLowStockOnly(false)}>
                    Low Stock Only
                  </Tag>
                )}
              </Space>
            </Col>
          </Row>
        )}
      </Card>

      {/* Table */}
      <Card>
        {" "}
        <Table
          columns={columns}
          dataSource={stockData?.data || []}
          rowKey="id"
          loading={stockLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: stockData?.meta.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} variants`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </>
  );
}
