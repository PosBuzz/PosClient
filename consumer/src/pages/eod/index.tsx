import { Money, takaPrefix } from "../../components/Currency";
import { AuditOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Segmented,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import PdfPreviewModal, {
  usePdfPreview,
} from "../../components/PdfPreviewModal";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import useDarkMode from "../../hooks/useDarkMode";
import { useAuthStore } from "../../stores/authStore";
import {
  PaymentMethodBreakdown,
  ProductSalesStats,
} from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text } = Typography;

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF7C7C",
];

const EODReport = () => {
  const isDarkMode = useDarkMode();
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<string>(
    dayjs().format("YYYY-MM-DD"),
  );
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>(
    undefined,
  );
  const [period, setPeriod] = useState<"day" | "month" | "all">("day");
  const { preview, previewProps } = usePdfPreview();

  // Get user's branches
  const userBranches = user?.branches || [];

  const { data: eodData, isLoading } = useQuery({
    queryKey: [queryKeys.eod, period, selectedDate, selectedBranch],
    queryFn: () =>
      salesApi.getEODReport({
        date: selectedDate,
        branch_id: selectedBranch,
        period,
      }),
    enabled: !!selectedDate,
    staleTime: queryStaleTimeMap[queryKeys.eod],
  });

  const getPaymentMethodDisplay = (method: string) => {
    const displays: { [key: string]: string } = {
      CASH: "Cash",
      CARD: "Card",
      BANK_TRANSFER: "Bank Transfer",
      CHEQUE: "Cheque",
      MOBILE_MONEY: "Mobile Money",
      MFS: "MFS (bKash/Nagad)",
      CREDIT: "Reward Points / Store Credit",
      EXCHANGE: "Product Exchange",
    };
    return displays[method] || method;
  };

  const getPaymentMethodColor = (method: string) => {
    const colors: { [key: string]: string } = {
      CASH: "green",
      CARD: "blue",
      BANK_TRANSFER: "purple",
      CHEQUE: "orange",
      MOBILE_MONEY: "cyan",
      MFS: "magenta",
      CREDIT: "gold",
      EXCHANGE: "geekblue",
    };
    return colors[method] || "default";
  };

  // Payment status columns
  const paymentStatusColumns = [
    {
      title: "Payment Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const s = status?.toLowerCase();
        const color =
          s === "paid" ? "green" : s === "partial" ? "orange" : "red";
        const label =
          s === "paid"
            ? "Fully Paid"
            : s === "partial"
              ? "Partially Paid"
              : "Full Due / Unpaid";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Sales Count",
      dataIndex: "count",
      key: "count",
      sorter: (a: any, b: any) => a.count - b.count,
    },
    {
      title: "Invoiced Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      render: (amount: number) => <Money value={amount} />,
      sorter: (a: any, b: any) => a.total_amount - b.total_amount,
    },
  ];

  // Prepare chart data
  const paymentMethodChartData =
    eodData?.payment_method_breakdown.map((item) => ({
      name: getPaymentMethodDisplay(item.payment_method),
      amount: item.total_amount,
      transactions: item.transaction_count,
    })) || [];

  const hourlyChartData =
    eodData?.hourly_sales
      .filter((item) => item.sales_count > 0)
      .map((item) => ({
        hour: `${item.hour}:00`,
        sales: item.sales_count,
        amount: item.total_amount,
      })) || [];

  // Table columns for payment methods
  const paymentMethodColumns = [
    {
      title: "Payment Method",
      dataIndex: "payment_method",
      key: "payment_method",
      render: (method: string) => (
        <Tag color={getPaymentMethodColor(method)}>
          {getPaymentMethodDisplay(method)}
        </Tag>
      ),
    },
    {
      title: "Total Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      render: (amount: number) => <Money value={amount} />,
      sorter: (a: PaymentMethodBreakdown, b: PaymentMethodBreakdown) =>
        a.total_amount - b.total_amount,
    },
    {
      title: "Transactions",
      dataIndex: "transaction_count",
      key: "transaction_count",
      sorter: (a: PaymentMethodBreakdown, b: PaymentMethodBreakdown) =>
        a.transaction_count - b.transaction_count,
    },
  ];

  // Table columns for product sales
  const productSalesColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: ProductSalesStats) => (
        <div>
          <Text strong>{record.product_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.variant_name}
          </Text>
          {record.sku && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                SKU: {record.sku}
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: "Qty Sold",
      dataIndex: "quantity_sold",
      key: "quantity_sold",
      sorter: (a: ProductSalesStats, b: ProductSalesStats) =>
        a.quantity_sold - b.quantity_sold,
    },
    {
      title: "Total Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      render: (amount: number) => <Money value={amount} />,
      sorter: (a: ProductSalesStats, b: ProductSalesStats) =>
        a.total_amount - b.total_amount,
    },
    {
      title: "Qty Returned",
      dataIndex: "quantity_returned",
      key: "quantity_returned",
      render: (qty: number) =>
        qty ? (
          <Text type="danger">{qty}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
      sorter: (a: ProductSalesStats, b: ProductSalesStats) =>
        a.quantity_returned - b.quantity_returned,
    },
    {
      title: "Net Amount",
      dataIndex: "net_amount",
      key: "net_amount",
      render: (amount: number) => <Money value={amount} />,
      sorter: (a: ProductSalesStats, b: ProductSalesStats) =>
        a.net_amount - b.net_amount,
    },
    {
      title: "Avg Unit Price",
      dataIndex: "average_unit_price",
      key: "average_unit_price",
      render: (price: number) => <Money value={price} />,
      sorter: (a: ProductSalesStats, b: ProductSalesStats) =>
        a.average_unit_price - b.average_unit_price,
    },
  ];

  return (
    <div>
      {setPageTitle("Business Report")}
      <PageTitle
        title="Business Report"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Business Report" },
        ]}
        rightSection={
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={() =>
              preview(
                () =>
                  salesApi.getBusinessReportPdf({
                    date: selectedDate,
                    branch_id: selectedBranch,
                    period,
                  }),
                {
                  title: "Business Report",
                  fileName: `business-report-${selectedDate}.pdf`,
                },
              )
            }
          >
            Preview PDF
          </Button>
        }
      />

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="bottom">
          <Col span={6}>
            <label>Report period:</label>
            <br />
            <Segmented
              style={{ marginTop: 4 }}
              value={period}
              onChange={(value) => setPeriod(value as "day" | "month" | "all")}
              options={[
                { label: "Daily", value: "day" },
                { label: "Monthly", value: "month" },
                { label: "Till Date", value: "all" },
              ]}
            />
          </Col>
          <Col span={6}>
            <label>
              {period === "day"
                ? "Date:"
                : period === "month"
                  ? "Month:"
                  : "Through date:"}
            </label>
            <DatePicker
              style={{ width: "100%", marginTop: 4 }}
              value={dayjs(selectedDate)}
              onChange={(date) => {
                if (date) {
                  setSelectedDate(date.format("YYYY-MM-DD"));
                }
              }}
              format="YYYY-MM-DD"
              allowClear={false}
              picker={period === "month" ? "month" : "date"}
            />
          </Col>
          <Col span={6}>
            <label>Branch:</label>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="All Branches"
              value={selectedBranch}
              onChange={(value) => setSelectedBranch(value)}
              allowClear
            >
              {userBranches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {isLoading ? (
        <Card>
          <div style={{ textAlign: "center", padding: "50px" }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Loading business report...</p>
          </div>
        </Card>
      ) : eodData ? (
        <>
          {/* Sales & Collection Overview */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Gross Sales"
                  value={eodData.summary.total_amount}
                  prefix={takaPrefix}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {eodData.summary.total_sales} transactions
                  {eodData.summary.total_discount ? (
                    <>
                      {" "}
                      · Disc: <Money value={eodData.summary.total_discount} />
                    </>
                  ) : null}
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Real Money Collected"
                  value={
                    eodData.summary.real_money_collected ??
                    eodData.summary.cash_sales +
                      (eodData.summary.digital_sales || 0)
                  }
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={{ color: "#3f8600" }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Physical Cash & Digital Banking
                  {eodData.summary.due_collected ? (
                    <>
                      {" "}
                      · Due paid:{" "}
                      <Money value={eodData.summary.due_collected} />
                    </>
                  ) : null}
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Due / Receivables"
                  value={eodData.summary.total_due || 0}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={
                    eodData.summary.total_due ? { color: "#cf1322" } : undefined
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {eodData.summary.due_sales_count || 0} invoice(s) with due
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Net Sales"
                  value={eodData.summary.net_sale_amount}
                  prefix={takaPrefix}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Gross sales minus refunds
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Settlement Channels */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Cash Sales"
                  value={eodData.summary.cash_sales}
                  prefix={takaPrefix}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Net Cash in Drawer:{" "}
                  <Money value={eodData.summary.net_cash_sales} />
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Digital Sales (Card/MFS)"
                  value={eodData.summary.digital_sales || 0}
                  prefix={takaPrefix}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Card, bKash, Nagad, Bank
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Reward Points Redeemed"
                  value={eodData.summary.reward_point_sales || 0}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={
                    eodData.summary.reward_point_sales
                      ? { color: "#d48806" }
                      : undefined
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Store credit / customer loyalty
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Product Exchanges"
                  value={
                    eodData.summary.unique_exchanges ??
                    eodData.summary.exchange_sales ??
                    eodData.summary.total_exchange_return ??
                    0
                  }
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={
                    eodData.summary.unique_exchanges ||
                    eodData.summary.exchange_sales ||
                    eodData.summary.total_exchange_return
                      ? { color: "#1677ff" }
                      : undefined
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Deduplicated exchange value
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Cash Drawer & Operational Costs */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Cash Refunds"
                  value={eodData.summary.cash_refunds}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={
                    eodData.summary.cash_refunds
                      ? { color: "#cf1322" }
                      : undefined
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cash paid out from drawer
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Net Cash in Drawer"
                  value={eodData.summary.net_cash_sales}
                  prefix={takaPrefix}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cash sales minus cash refunds
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Operational Costs"
                  value={eodData.summary.operational_costs}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={{ color: "#cf1322" }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Business daily expenses
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Net Operating Result"
                  value={eodData.summary.net_operating_result}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={{
                    color:
                      eodData.summary.net_operating_result >= 0
                        ? "#3f8600"
                        : "#cf1322",
                  }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  After refunds & operational costs
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Operational Volume & Metadata */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Refunds"
                  value={eodData.summary.total_refund}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={
                    eodData.summary.total_refund
                      ? { color: "#cf1322" }
                      : undefined
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {eodData.summary.total_returns} return(s) ·{" "}
                  {eodData.summary.total_items_returned} item(s)
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Average Transaction"
                  value={eodData.summary.average_transaction_value}
                  prefix={takaPrefix}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Average ticket size
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Items Sold"
                  value={eodData.summary.total_items_sold}
                  suffix="items"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {eodData.summary.unique_products_sold} unique products
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Report Date"
                  value={dayjs(eodData.date).format("MMM DD, YYYY")}
                />
                {eodData.branch_name && (
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: "block" }}
                  >
                    Branch: {eodData.branch_name}
                  </Text>
                )}
              </Card>
            </Col>
          </Row>

          {/* Payment Method Breakdown */}
          <Card title="Payment Method Breakdown" style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col span={14}>
                <Table
                  columns={paymentMethodColumns}
                  dataSource={eodData.payment_method_breakdown}
                  rowKey="payment_method"
                  pagination={false}
                  size="small"
                />
              </Col>
              <Col span={10}>
                {paymentMethodChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentMethodChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {paymentMethodChartData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          `BDT ${Number(value).toFixed(2)}`,
                          "Amount",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Col>
            </Row>
          </Card>

          {/* Sales by Payment Status */}
          {eodData.payment_status_breakdown &&
            eodData.payment_status_breakdown.length > 0 && (
              <Card
                title="Sales by Payment Status"
                style={{ marginBottom: 24 }}
              >
                <Table
                  columns={paymentStatusColumns}
                  dataSource={eodData.payment_status_breakdown}
                  rowKey="status"
                  pagination={false}
                  size="small"
                />
              </Card>
            )}

          {/* Refund Method Breakdown */}
          {eodData.return_payment_breakdown.length > 0 && (
            <Card title="Refund Method Breakdown" style={{ marginBottom: 24 }}>
              <Table
                columns={paymentMethodColumns}
                dataSource={eodData.return_payment_breakdown}
                rowKey="payment_method"
                pagination={false}
                size="small"
              />
            </Card>
          )}

          {/* Hourly Sales Chart */}
          {period === "day" && hourlyChartData.length > 0 && (
            <Card
              title="Hourly Sales Distribution"
              style={{ marginBottom: 24 }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "amount"
                        ? `BDT ${Number(value).toFixed(2)}`
                        : value,
                      name === "amount" ? "Amount" : "Sales Count",
                    ]}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="sales"
                    fill="#8884d8"
                    name="Sales Count"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="amount"
                    fill="#82ca9d"
                    name="Amount"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Product Sales Statistics */}
          <Card title="Product Sales Statistics">
            <Table
              columns={productSalesColumns}
              dataSource={eodData.product_sales}
              rowKey="variant_id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} products`,
              }}
              scroll={{ x: 800 }}
            />
          </Card>
          <Card title="Operational Costs" style={{ marginTop: 24 }}>
            <Table
              dataSource={eodData.operational_costs}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: "Date",
                  dataIndex: "incurred_on",
                  render: (value: string) => dayjs(value).format("DD MMM YYYY"),
                },
                { title: "Cost name", dataIndex: "name" },
                {
                  title: "Branch",
                  dataIndex: "branch_name",
                  render: (value?: string) => value || "All business",
                },
                {
                  title: "Amount",
                  dataIndex: "amount",
                  align: "right" as const,
                  render: (value: number) => <Money value={value} />,
                },
              ]}
            />
          </Card>

          {/* Accounting Definitions & Report Closure */}
          <Card
            style={{
              marginTop: 24,
              border: isDarkMode ? "1px solid #303030" : "1px solid #e2e8f0",
              background: isDarkMode ? "#141414" : "#f8fafc",
              borderRadius: "8px",
            }}
            styles={{
              body: { padding: "20px 24px" },
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: `1px solid ${isDarkMode ? "#303030" : "#e2e8f0"}`,
              }}
            >
              <AuditOutlined style={{ color: "#1677ff", fontSize: "16px" }} />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  color: isDarkMode ? "#f1f5f9" : "#0f172a",
                  letterSpacing: "0.3px",
                }}
              >
                ACCOUNTING DEFINITIONS & REPORT CLOSURE
              </span>
            </div>

            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div>
                    <Text
                      strong
                      style={{ color: isDarkMode ? "#93c5fd" : "#1d4ed8" }}
                    >
                      • Gross Sales:{" "}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: isDarkMode ? "#cbd5e1" : "#475569",
                      }}
                    >
                      Invoiced subtotal less line & promotional discounts, plus
                      tax & shipping.
                    </Text>
                  </div>
                  <div>
                    <Text
                      strong
                      style={{ color: isDarkMode ? "#86efac" : "#15803d" }}
                    >
                      • Real Money Collected:{" "}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: isDarkMode ? "#cbd5e1" : "#475569",
                      }}
                    >
                      Liquid currency received via Cash and verified Digital
                      accounts (Cards/MFS).
                    </Text>
                  </div>
                  <div>
                    <Text
                      strong
                      style={{ color: isDarkMode ? "#5eead4" : "#0f766e" }}
                    >
                      • Net Cash in Drawer:{" "}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: isDarkMode ? "#cbd5e1" : "#475569",
                      }}
                    >
                      Total physical cash received (sales + due collections)
                      less cash refunds paid.
                    </Text>
                  </div>
                </div>
              </Col>

              <Col xs={24} md={12}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div>
                    <Text
                      strong
                      style={{ color: isDarkMode ? "#fca5a5" : "#b91c1c" }}
                    >
                      • Due / Receivables:{" "}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: isDarkMode ? "#cbd5e1" : "#475569",
                      }}
                    >
                      Remaining unpaid balance on sales invoices finalized
                      during this period.
                    </Text>
                  </div>
                  <div>
                    <Text
                      strong
                      style={{ color: isDarkMode ? "#c084fc" : "#7e22ce" }}
                    >
                      • Product Exchanges:{" "}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: isDarkMode ? "#cbd5e1" : "#475569",
                      }}
                    >
                      Deduplicated barter value of exchanged goods; counted once
                      across linked records.
                    </Text>
                  </div>
                  <div>
                    <Text
                      strong
                      style={{ color: isDarkMode ? "#fdba74" : "#c2410c" }}
                    >
                      • Net Operating Result:{" "}
                    </Text>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: isDarkMode ? "#cbd5e1" : "#475569",
                      }}
                    >
                      Gross Sales minus Returns/Refunds and Operational
                      Expenses.
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>

            <div
              style={{
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: `1px dashed ${isDarkMode ? "#303030" : "#cbd5e1"}`,
                textAlign: "center",
              }}
            >
              <Text
                type="secondary"
                style={{
                  fontSize: "12px",
                  fontStyle: "italic",
                }}
              >
                Official computer-generated financial report. Prepared in
                accordance with standard retail cash & accrual accounting
                principles.
              </Text>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div style={{ textAlign: "center", padding: "50px" }}>
            <Text type="secondary">
              No data available for the selected date and branch.
            </Text>
          </div>
        </Card>
      )}

      <PdfPreviewModal {...previewProps} />
    </div>
  );
};

export default EODReport;
