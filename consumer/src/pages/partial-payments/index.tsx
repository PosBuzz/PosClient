import { CurrencyIcon, takaPrefix } from "../../components/Currency";
import { EyeOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { paymentsApi } from "../../api/payments-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import type {
  PartialPaymentFilters,
  SaleForPayment,
} from "../../types/payment.types";
import { setPageTitle } from "../../utils/setPageTitle";
import { formatCurrency } from "../../utils/formatters";

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const PartialPayments = () => {
  const { user } = useAuthStore();

  const [filters, setFilters] = useState<PartialPaymentFilters>({
    page: 1,
    limit: 20,
    search: "",
  });

  // Use real API query with optimized caching
  const paymentsQuery = useQuery({
    queryKey: [queryKeys.partialPayments, filters],
    queryFn: () => paymentsApi.getPartiallyPaidSales(filters),
    placeholderData: (previousData) => previousData,
    staleTime: queryStaleTimeMap[queryKeys.partialPayments],
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    }, 300),
    [],
  );

  // Cleanup debounced function on unmount
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
      filters.branch_id
    );
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      search: "",
    });
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
      title: "Sale Number",
      dataIndex: "sale_number",
      key: "sale_number",
      width: 140,
      fixed: "left" as const,
      render: (text: string) => (
        <Text strong style={{ color: "#1890ff" }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      width: 120,
      render: (date: string) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
      width: 150,
      render: (name: string, record: SaleForPayment) => (
        <Space direction="vertical" size={0}>
          <Text>{name || "Walk-in Customer"}</Text>
          {record.customer_phone && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.customer_phone}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
      width: 120,
    },
    {
      title: "Total Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      width: 120,
      align: "right" as const,
      render: (amount: number) => <Text strong>{formatCurrency(amount)}</Text>,
    },
    {
      title: "Received",
      dataIndex: "received_amount",
      key: "received_amount",
      width: 120,
      align: "right" as const,
      render: (amount: number) => (
        <Text style={{ color: "#52c41a" }}>{formatCurrency(amount)}</Text>
      ),
    },
    {
      title: "Remaining",
      dataIndex: "remaining_amount",
      key: "remaining_amount",
      width: 120,
      align: "right" as const,
      render: (amount: number) => (
        <Text strong style={{ color: "#ff4d4f" }}>
          {formatCurrency(amount)}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "payment_status",
      key: "payment_status",
      width: 100,
      render: () => <Tag color="orange">PARTIAL</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      fixed: "right" as const,
      render: (_: any, record: SaleForPayment) => (
        <Space size="small">
          <Tooltip title="View Sale">
            <Link to={`/sales/view/${record.id}`}>
              <Button type="text" icon={<EyeOutlined />} size="small" />
            </Link>
          </Tooltip>
          <Tooltip title="Make Payment">
            <Link to={`/partial-payments/${record.id}/pay`}>
              <Button type="primary" icon={<CurrencyIcon />} size="small">
                Pay
              </Button>
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const data = paymentsQuery.data?.data || [];
  const meta = paymentsQuery.data?.meta;

  // Calculate summary statistics
  const totalRemaining = data.reduce(
    (sum, sale) => sum + +sale.remaining_amount,
    0,
  );
  const totalReceived = data.reduce(
    (sum, sale) => sum + +sale.received_amount,
    0,
  );

  return (
    <div>
      {setPageTitle("Partial Payments")}
      <PageTitle
        title="Partial Payments"
        breadcrumbs={[{ title: "Home" }, { title: "Partial Payments" }]}
      />

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Unpaid & Partially Paid Sales"
              value={meta?.total || 0}
              prefix={takaPrefix}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Received"
              value={totalReceived}
              precision={2}
              valueStyle={{ color: "#52c41a" }}
              prefix="BDT"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Total Remaining"
              value={totalRemaining}
              precision={2}
              valueStyle={{ color: "#ff4d4f" }}
              prefix="BDT"
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Unpaid & Partially Paid Sales"
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
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by sale number, customer"
              prefix={<SearchOutlined />}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
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
          {user?.branches && user.branches.length > 1 && (
            <Col xs={24} sm={12} md={8}>
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
          loading={paymentsQuery.isLoading}
          onChange={handleTableChange}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: meta?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} sales`,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default PartialPayments;
