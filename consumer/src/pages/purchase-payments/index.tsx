import { DollarOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { purchasePaymentsApi } from "../../api/purchase-payments-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import type { PurchaseBatchesFilters } from "../../types/purchase-payment.types";
import { setPageTitle } from "../../utils/setPageTitle";
import { formatCurrency } from "../../utils/formatters";

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const PurchasePayments = () => {
  const { user } = useAuthStore();

  const [filters, setFilters] = useState<PurchaseBatchesFilters>({
    page: 1,
    limit: 20,
    search: "",
    payment_status: "unpaid",
  });

  const purchaseBatchesQuery = useQuery({
    queryKey: [queryKeys.purchasePaymentBatches, filters],
    queryFn: () => purchasePaymentsApi.getPurchaseBatches(filters),
    placeholderData: (previousData) => previousData,
    staleTime: queryStaleTimeMap[queryKeys.purchasePaymentBatches],
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    }, 300),
    [],
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = (value: string) => {
    debouncedSearch(value);
  };

  const hasActiveFilters = () => {
    return (
      filters.search ||
      filters.date_from ||
      filters.date_to ||
      filters.branch_id ||
      filters.vendor_id ||
      filters.vendorless ||
      filters.payment_status !== "unpaid"
    );
  };

  const clearFilters = () => {
    setFilters({ page: 1, limit: 20, search: "", payment_status: "unpaid" });
  };

  const handleTableChange = (pagination: any) => {
    setFilters((prev) => ({
      ...prev,
      page: pagination.current,
      limit: pagination.pageSize,
    }));
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setFilters((prev) => ({
        ...prev,
        date_from: dates[0].startOf("day").toISOString(),
        date_to: dates[1].endOf("day").toISOString(),
        page: 1,
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        date_from: undefined,
        date_to: undefined,
        page: 1,
      }));
    }
  };

  const columns = [
    {
      title: "Batch #",
      dataIndex: "batch_number",
      key: "batch_number",
      width: 120,
      render: (text: string) => (
        <Text strong style={{ color: "#1890ff" }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Product",
      key: "product",
      width: 180,
      render: (_: any, record: any) =>
        `${record.variant?.product?.name || "-"} - ${record.variant?.name || "-"}`,
    },
    {
      title: "Vendor",
      key: "vendor",
      width: 120,
      render: (_: any, record: any) => record.vendor?.name || "-",
    },
    {
      title: "Branch",
      key: "branch",
      width: 100,
      render: (_: any, record: any) => record.branch?.name || "-",
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 60,
    },
    {
      title: "Total Cost",
      dataIndex: "total_cost",
      key: "total_cost",
      width: 110,
      align: "right" as const,
      render: (val: number) => <Text strong>{formatCurrency(val)}</Text>,
    },
    {
      title: "Paid",
      dataIndex: "paid_amount",
      key: "paid_amount",
      width: 110,
      align: "right" as const,
      render: (val: number) => (
        <Text style={{ color: "#52c41a" }}>{formatCurrency(val)}</Text>
      ),
    },
    {
      title: "Remaining",
      dataIndex: "remaining_amount",
      key: "remaining_amount",
      width: 110,
      align: "right" as const,
      render: (val: number) => (
        <Text strong style={{ color: "#ff4d4f" }}>
          {formatCurrency(val)}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "payment_status",
      key: "payment_status",
      width: 90,
      render: (status: string) => (
        <Tag
          color={
            status === "paid"
              ? "green"
              : status === "due"
                ? "red"
                : "orange"
          }
        >
          {status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: any, record: any) => (
        <Link to={`/purchase-payments/${record.id}`}>
          <Button
            type={record.payment_status === "paid" ? "default" : "primary"}
            icon={<DollarOutlined />}
            size="small"
          >
            {record.payment_status === "paid" ? "View" : "Pay"}
          </Button>
        </Link>
      ),
    },
  ];

  const data = purchaseBatchesQuery.data?.data || [];
  const meta = purchaseBatchesQuery.data?.meta;

  const totalRemaining = data.reduce(
    (sum, b) => sum + (Number(b.remaining_amount) || 0),
    0,
  );
  const totalPaid = data.reduce(
    (sum, b) => sum + (Number(b.paid_amount) || 0),
    0,
  );

  return (
    <div>
      {setPageTitle("Purchase Payments")}
      <PageTitle
        title="Purchase Payments"
        breadcrumbs={[{ title: "Home" }, { title: "Purchase Payments" }]}
      />

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Tracked Batches"
              value={meta?.total || 0}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Paid"
              value={totalPaid}
              precision={2}
              valueStyle={{ color: "#52c41a" }}
              prefix="$"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Owed"
              value={totalRemaining}
              precision={2}
              valueStyle={{ color: "#ff4d4f" }}
              prefix="$"
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Purchase Payment Ledger"
        extra={
          hasActiveFilters() && (
            <Button onClick={clearFilters} type="link">
              Clear Filters
            </Button>
          )
        }
      >
        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search by batch #, product"
              prefix={<SearchOutlined />}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              style={{ width: "100%" }}
              onChange={handleDateRangeChange}
              format="MMM DD, YYYY"
              value={
                filters.date_from && filters.date_to
                  ? [dayjs(filters.date_from), dayjs(filters.date_to)]
                  : null
              }
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Payment status"
              style={{ width: "100%" }}
              value={filters.vendorless ? "vendorless" : filters.payment_status}
              onChange={(value: NonNullable<PurchaseBatchesFilters["payment_status"]> | "vendorless") => {
                if (value === "vendorless") {
                  setFilters((prev) => ({
                    ...prev,
                    vendorless: true,
                    payment_status: "all",
                    page: 1,
                  }));
                  return;
                }

                setFilters((prev) => ({
                  ...prev,
                  vendorless: undefined,
                  payment_status: value,
                  page: 1,
                }));
              }}
            >
              <Option value="unpaid">Unpaid</Option>
              <Option value="all">All</Option>
              <Option value="due">Due</Option>
              <Option value="partial">Partial</Option>
              <Option value="paid">Paid</Option>
              <Option value="vendorless">No Vendor</Option>
            </Select>
          </Col>
          {user?.branches && user.branches.length > 1 && (
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder="Filter by branch"
                style={{ width: "100%" }}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, branch_id: value, page: 1 }))
                }
                value={filters.branch_id}
                allowClear
              >
                {user.branches.map((branch) => (
                  <Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Option>
                ))}
              </Select>
            </Col>
          )}
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={purchaseBatchesQuery.isLoading}
          onChange={handleTableChange}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: meta?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} batches`,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
};

export default PurchasePayments;
