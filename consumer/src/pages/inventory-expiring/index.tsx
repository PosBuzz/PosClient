import { Money } from "../../components/Currency";
import {
  CalendarOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
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
import { inventoryApi, InventoryBatch } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useModalStore } from "../../stores/modalStore";
import useDarkMode from "../../hooks/useDarkMode";
import { Link } from "react-router-dom";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { Option } = Select;

export default function InventoryExpiringPage() {
  const { modal } = useModalStore();
  const isDarkMode = useDarkMode();

  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [expiryDays, setExpiryDays] = useState(30);
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
  }, [debouncedSearchText, selectedBranch, expiryDays]);
  // Queries
  const { data: expiringData, isLoading: expiringLoading } = useQuery({
    queryKey: [queryKeys.expiringBatches, expiryDays, selectedBranch],
    queryFn: () =>
      inventoryApi.getExpiringBatches({
        days: expiryDays,
        branch_id: selectedBranch,
      }),
    staleTime: queryStaleTimeMap[queryKeys.expiringBatches],
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  const getExpiryStatus = (expiryDate: string) => {
    const now = dayjs();
    const expiry = dayjs(expiryDate);
    const daysUntilExpiry = expiry.diff(now, "days");

    if (daysUntilExpiry < 0) {
      return { color: "red", text: "Expired", urgency: 4 };
    } else if (daysUntilExpiry === 0) {
      return { color: "red", text: "Expires Today", urgency: 3 };
    } else if (daysUntilExpiry <= 7) {
      return { color: "orange", text: `${daysUntilExpiry}d left`, urgency: 2 };
    } else if (daysUntilExpiry <= 30) {
      return { color: "yellow", text: `${daysUntilExpiry}d left`, urgency: 1 };
    }
    return { color: "green", text: `${daysUntilExpiry}d left`, urgency: 0 };
  };

  const handleView = (batch: InventoryBatch) => {
    const expiryStatus = getExpiryStatus(batch.expiry_date!);

    modal?.info({
      title: "Expiring Batch Details",
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
              <Text strong>Batch Reference:</Text>
            </Col>
            <Col span={16}>
              <Text code>{batch.batch_number}</Text>
            </Col>

            <Col span={8}>
              <Text strong>Quantity:</Text>
            </Col>
            <Col span={16}>
              <Text strong>{batch.quantity} units</Text>
            </Col>

            <Col span={8}>
              <Text strong>Cost Price:</Text>
            </Col>
            <Col span={16}>
              <Text>
                <Money value={batch.cost_price} /> per unit
              </Text>
            </Col>

            <Col span={8}>
              <Text strong>Total Value:</Text>
            </Col>
            <Col span={16}>
              <Text strong>
                <Money value={parseFloat(batch.cost_price) * batch.quantity} />
              </Text>
            </Col>

            <Col span={8}>
              <Text strong>Branch:</Text>
            </Col>
            <Col span={16}>
              <Text>{batch.branch?.name || "Warehouse"}</Text>
            </Col>

            <Col span={8}>
              <Text strong>Expiry Date:</Text>
            </Col>
            <Col span={16}>
              <Space>
                <Text>{dayjs(batch.expiry_date).format("MMM DD, YYYY")}</Text>
                <Tag color={expiryStatus.color}>{expiryStatus.text}</Tag>
              </Space>
            </Col>

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

  const clearFilters = () => {
    setSearchText("");
    setDebouncedSearchText("");
    setSelectedBranch(undefined);
    setExpiryDays(30);
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return (
      debouncedSearchText || selectedBranch !== undefined || expiryDays !== 30
    );
  };

  const columns: ColumnsType<InventoryBatch> = [
    {
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div>
          <Link to={`/products/view/${record.variant.product.id}`}>
            <p style={{ fontWeight: 500 }}>{record.variant.product.name}</p>
          </Link>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.variant.name}
          </Text>
        </div>
      ),
    },
    {
      title: "Batch Reference",
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
      title: "Total Value",
      key: "total_value",
      align: "right",
      render: (_, record) => (
        <Text strong>
          <Money value={parseFloat(record.cost_price) * record.quantity} />
        </Text>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <Tag
          color={
            record.branch?.name.toLowerCase() === "warehouse"
              ? "default"
              : "blue"
          }
        >
          {record.branch?.name || "Warehouse"}
        </Tag>
      ),
    },
    {
      title: "Expiry Date",
      dataIndex: "expiry_date",
      key: "expiry_date",
      render: (date) => {
        const status = getExpiryStatus(date);
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <CalendarOutlined />
              <Text>{dayjs(date).format("MMM DD, YYYY")}</Text>
            </div>
            <Tag
              color={status.color}
              style={{ marginTop: 4 }}
              icon={status.urgency >= 2 ? <WarningOutlined /> : undefined}
            >
              {status.text}
            </Tag>
          </div>
        );
      },
      sorter: (a, b) => {
        const statusA = getExpiryStatus(a.expiry_date!);
        const statusB = getExpiryStatus(b.expiry_date!);
        return statusB.urgency - statusA.urgency;
      },
      defaultSortOrder: "ascend",
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          />
        </Tooltip>
      ),
    },
  ];
  // Filter batches by search text if needed (client-side filtering for better UX)
  const filteredData =
    expiringData?.filter((batch) => {
      if (!debouncedSearchText) return true;
      const searchLower = debouncedSearchText.toLowerCase();
      return (
        batch.variant.product.name.toLowerCase().includes(searchLower) ||
        batch.variant.name.toLowerCase().includes(searchLower) ||
        batch.batch_number.toLowerCase().includes(searchLower)
      );
    }) || [];

  const getCardStyle = () => ({
    backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
    borderColor: isDarkMode ? "#303030" : "#d9d9d9",
  });

  const getSummaryTextColor = () => (isDarkMode ? "#d9d9d9" : "#666");

  if (branchesLoading && currentPage === 1) {
    return <CenterLoader />;
  }

  return (
    <>
      {setPageTitle("Expiring Inventory")}
      <PageTitle
        title="Expiring Inventory"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Expiring" },
        ]}
      />{" "}
      {/* Filters */}
      <Card style={{ ...getCardStyle(), marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search products, variants, or batch numbers..."
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
            <Space.Compact style={{ width: "100%" }}>
              <Input
                addonBefore="Expiring within"
                style={{ width: "70%" }}
                value=""
                readOnly
              />
              <InputNumber
                style={{ width: "30%" }}
                value={expiryDays}
                onChange={(value) => setExpiryDays(value || 30)}
                min={1}
                max={365}
                addonAfter="days"
              />
            </Space.Compact>
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

        {/* Quick filters */}
        <Row style={{ marginTop: 16 }}>
          <Col span={24}>
            <Space wrap>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Quick filters:
              </Text>
              <Button size="small" onClick={() => setExpiryDays(7)}>
                This Week
              </Button>
              <Button size="small" onClick={() => setExpiryDays(30)}>
                This Month
              </Button>
              <Button size="small" onClick={() => setExpiryDays(90)}>
                3 Months
              </Button>
            </Space>
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

                {expiryDays !== 30 && (
                  <Tag closable onClose={() => setExpiryDays(30)}>
                    Expiring within: {expiryDays} days
                  </Tag>
                )}
              </Space>
            </Col>
          </Row>
        )}
      </Card>{" "}
      {/* Summary */}
      {expiringData && (
        <Card style={{ ...getCardStyle(), marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#ff4d4f",
                  }}
                >
                  {
                    expiringData.filter(
                      (b) => getExpiryStatus(b.expiry_date!).urgency >= 3
                    ).length
                  }
                </div>
                <div style={{ color: getSummaryTextColor() }}>
                  Expired/Today
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#fa8c16",
                  }}
                >
                  {
                    expiringData.filter(
                      (b) => getExpiryStatus(b.expiry_date!).urgency === 2
                    ).length
                  }
                </div>
                <div style={{ color: getSummaryTextColor() }}>This Week</div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#fadb14",
                  }}
                >
                  {
                    expiringData.filter(
                      (b) => getExpiryStatus(b.expiry_date!).urgency === 1
                    ).length
                  }
                </div>
                <div style={{ color: getSummaryTextColor() }}>This Month</div>
              </div>
            </Col>
            <Col span={6}>
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
            </Col>
          </Row>
        </Card>
      )}
      {/* Table */}
      <Card style={getCardStyle()}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={expiringLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: filteredData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} expiring batches`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1200 }}
          rowClassName={(record) => {
            const status = getExpiryStatus(record.expiry_date!);
            if (status.urgency >= 3) return "table-row-expired";
            if (status.urgency === 2) return "table-row-urgent";
            return "";
          }}
        />
      </Card>{" "}
      <style>{`
        .table-row-expired {
          background-color: ${isDarkMode ? "#2a1a1a" : "#fff2f0"} !important;
        }
        .table-row-urgent {
          background-color: ${isDarkMode ? "#2a2219" : "#fff7e6"} !important;
        }
      `}</style>
    </>
  );
}
