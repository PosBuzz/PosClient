import {
  ArrowLeftOutlined,
  GiftOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { Money, takaPrefix } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import type {
  CustomerHistoryResponse,
  CustomerReturnHistory,
  CustomerRewardHistory,
  CustomerSaleHistory,
  CustomerSummary,
} from "../../types/customer.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
type HistoryTab = "summary" | "sales" | "returns" | "rewards";

const paymentStatusColor = (status: string) => {
  if (status.toLowerCase() === "paid") return "green";
  if (status.toLowerCase() === "partial") return "gold";
  return "red";
};

const CustomerDetail = () => {
  const { id } = useParams();
  const customerId = Number(id);
  const validCustomerId = Number.isInteger(customerId) && customerId > 0;
  const [activeTab, setActiveTab] = useState<HistoryTab>("summary");
  const [salesPage, setSalesPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [rewardsPage, setRewardsPage] = useState(1);
  const pageSize = 20;

  const summaryQuery = useQuery<CustomerSummary>({
    queryKey: [queryKeys.customer, customerId, "summary"],
    queryFn: () => get(endpoints.getCustomerSummary(customerId)),
    enabled: validCustomerId,
    staleTime: queryStaleTimeMap[queryKeys.customer],
  });

  const salesQuery = useQuery<CustomerHistoryResponse<CustomerSaleHistory>>({
    queryKey: [queryKeys.customer, customerId, "sales", salesPage],
    queryFn: () =>
      get(endpoints.getCustomerSales(customerId), {
        page: salesPage,
        limit: pageSize,
      }),
    enabled: validCustomerId && activeTab === "sales",
    staleTime: queryStaleTimeMap[queryKeys.customer],
  });

  const returnsQuery = useQuery<CustomerHistoryResponse<CustomerReturnHistory>>(
    {
      queryKey: [queryKeys.customer, customerId, "returns", returnsPage],
      queryFn: () =>
        get(endpoints.getCustomerReturns(customerId), {
          page: returnsPage,
          limit: pageSize,
        }),
      enabled: validCustomerId && activeTab === "returns",
      staleTime: queryStaleTimeMap[queryKeys.customer],
    },
  );

  const rewardsQuery = useQuery<CustomerHistoryResponse<CustomerRewardHistory>>(
    {
      queryKey: [queryKeys.customer, customerId, "rewards", rewardsPage],
      queryFn: () =>
        get(endpoints.getCustomerRewards(customerId), {
          page: rewardsPage,
          limit: pageSize,
        }),
      enabled: validCustomerId && activeTab === "rewards",
      staleTime: queryStaleTimeMap[queryKeys.customer],
    },
  );

  if (!validCustomerId) {
    return <Alert type="error" showIcon message="Invalid customer ID" />;
  }

  if (summaryQuery.isError) {
    return (
      <Card>
        <Alert
          type="error"
          showIcon
          message="Customer could not be loaded"
          description="The customer may not exist or you may not have access to it."
          action={
            <Link to="/customers">
              <Button size="small">Back to customers</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const summary = summaryQuery.data;
  const customer = summary?.customer;

  const salesColumns = [
    {
      title: "Invoice",
      dataIndex: "sale_number",
      key: "sale_number",
      render: (saleNumber: string, record: CustomerSaleHistory) => (
        <Link to={`/sales/view/${record.id}`}>{saleNumber}</Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      render: (value: string) => dayjs(value).format("DD MMM YYYY, h:mm A"),
    },
    {
      title: "Branch",
      key: "branch",
      render: (record: CustomerSaleHistory) => record.branch.name,
    },
    {
      title: "Total",
      dataIndex: "total_amount",
      key: "total_amount",
      align: "right" as const,
      render: (value: number) => <Money value={value} />,
    },
    {
      title: "Due",
      key: "outstanding_amount",
      align: "right" as const,
      render: (record: CustomerSaleHistory) => (
        <Money
          value={
            record.outstanding_amount ??
            Math.max(record.total_amount - record.received_amount, 0)
          }
        />
      ),
    },
    {
      title: "Payment",
      dataIndex: "payment_status",
      key: "payment_status",
      render: (status: string) => (
        <Tag color={paymentStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
    },
  ];

  const returnColumns = [
    {
      title: "Return",
      dataIndex: "return_number",
      key: "return_number",
      render: (returnNumber: string, record: CustomerReturnHistory) => (
        <Link to={`/returns/view/${record.id}`}>{returnNumber}</Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "return_date",
      key: "return_date",
      render: (value: string) => dayjs(value).format("DD MMM YYYY, h:mm A"),
    },
    {
      title: "Original invoice",
      key: "original_sale",
      render: (record: CustomerReturnHistory) => (
        <Link to={`/sales/view/${record.original_sale.id}`}>
          {record.original_sale.sale_number}
        </Link>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (record: CustomerReturnHistory) => record.branch.name,
    },
    {
      title: "Refund",
      dataIndex: "total_refund",
      key: "total_refund",
      align: "right" as const,
      render: (value: number) => <Money value={value} />,
    },
    {
      title: "Exchange",
      dataIndex: "total_exchange",
      key: "total_exchange",
      align: "right" as const,
      render: (value: number) => <Money value={value} />,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      render: (value?: string | null) => value || "—",
    },
  ];

  const rewardColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string) => dayjs(value).format("DD MMM YYYY, h:mm A"),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (value: string) => <Tag>{value.replace(/_/g, " ")}</Tag>,
    },
    {
      title: "Points",
      dataIndex: "points",
      key: "points",
      align: "right" as const,
      render: (value: number) => (
        <Text type={value < 0 ? "danger" : "success"} strong>
          {value > 0 ? "+" : ""}
          {value}
        </Text>
      ),
    },
    {
      title: "Balance",
      dataIndex: "balance_after",
      key: "balance_after",
      align: "right" as const,
    },
    {
      title: "Invoice",
      key: "sale",
      render: (record: CustomerRewardHistory) =>
        record.sale ? (
          <Link to={`/sales/view/${record.sale.id}`}>
            {record.sale.sale_number}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      title: "Details",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (value?: string | null) => value || "—",
    },
  ];

  const summaryContent = summary ? (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small">
            <Statistic
              title="Total sales"
              value={summary.sales.count}
              prefix={<ShoppingCartOutlined />}
            />
            <Text type="secondary">
              Gross: <Money value={summary.sales.gross_amount} />
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small">
            <Statistic
              title="Outstanding due"
              value={summary.sales.outstanding_amount}
              precision={2}
              prefix={takaPrefix}
              valueStyle={{
                color: summary.sales.outstanding_amount ? "#cf1322" : undefined,
              }}
            />
            <Text type="secondary">
              Paid: <Money value={summary.sales.paid_amount} />
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small">
            <Statistic
              title="Returns"
              value={summary.returns.count}
              prefix={<SwapOutlined />}
            />
            <Text type="secondary">
              Refunded: <Money value={summary.returns.refunded_amount} />
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small">
            <Statistic
              title="Reward balance"
              value={summary.rewards.total_points}
              prefix={<GiftOutlined />}
              suffix="pts"
            />
            <Text type="secondary">
              Earned lifetime: {summary.rewards.lifetime_earned}
            </Text>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Customer details">
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
          <Descriptions.Item label="Name">{customer?.name}</Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag
              color={customer?.customer_type === "business" ? "blue" : "green"}
            >
              {customer?.customer_type}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Phone">
            {customer?.phone || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {customer?.email || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Birthday">
            {customer?.birthday
              ? dayjs(customer.birthday).format("DD MMM YYYY")
              : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Customer since">
            {customer?.created_at
              ? dayjs(customer.created_at).format("DD MMM YYYY")
              : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Address" span={3}>
            {customer?.address || "—"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title="Recent sales"
        extra={
          summary.sales.count > 0 ? (
            <Button type="link" onClick={() => setActiveTab("sales")}>
              View all
            </Button>
          ) : null
        }
      >
        {summary.recent_sales.length ? (
          <Table<CustomerSaleHistory>
            rowKey="id"
            size="small"
            columns={salesColumns.filter(
              (column) => column.key !== "outstanding_amount",
            )}
            dataSource={summary.recent_sales}
            pagination={false}
            scroll={{ x: 700 }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No sales yet"
          />
        )}
      </Card>
    </Space>
  ) : null;

  return (
    <>
      {setPageTitle(customer ? `${customer.name} - Customer` : "Customer")}
      <PageTitle
        title={customer?.name || "Customer history"}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Customers", href: "/customers" },
          { title: "History" },
        ]}
        rightSection={
          <Link to="/customers">
            <Button icon={<ArrowLeftOutlined />}>Back to customers</Button>
          </Link>
        }
      />

      <Card loading={summaryQuery.isLoading}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as HistoryTab)}
          items={[
            { key: "summary", label: "Summary", children: summaryContent },
            {
              key: "sales",
              label: `Sales${summary ? ` (${summary.sales.count})` : ""}`,
              children: (
                <Table<CustomerSaleHistory>
                  rowKey="id"
                  columns={salesColumns}
                  dataSource={salesQuery.data?.data || []}
                  loading={salesQuery.isFetching}
                  scroll={{ x: 850 }}
                  pagination={{
                    current: salesPage,
                    pageSize,
                    total: salesQuery.data?.meta.total || 0,
                    showSizeChanger: false,
                    onChange: setSalesPage,
                  }}
                />
              ),
            },
            {
              key: "returns",
              label: `Returns${summary ? ` (${summary.returns.count})` : ""}`,
              children: (
                <Table<CustomerReturnHistory>
                  rowKey="id"
                  columns={returnColumns}
                  dataSource={returnsQuery.data?.data || []}
                  loading={returnsQuery.isFetching}
                  scroll={{ x: 900 }}
                  pagination={{
                    current: returnsPage,
                    pageSize,
                    total: returnsQuery.data?.meta.total || 0,
                    showSizeChanger: false,
                    onChange: setReturnsPage,
                  }}
                />
              ),
            },
            {
              key: "rewards",
              label: "Rewards",
              children: (
                <Table<CustomerRewardHistory>
                  rowKey="id"
                  columns={rewardColumns}
                  dataSource={rewardsQuery.data?.data || []}
                  loading={rewardsQuery.isFetching}
                  scroll={{ x: 800 }}
                  pagination={{
                    current: rewardsPage,
                    pageSize,
                    total: rewardsQuery.data?.meta.total || 0,
                    showSizeChanger: false,
                    onChange: setRewardsPage,
                  }}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
};

export default CustomerDetail;
