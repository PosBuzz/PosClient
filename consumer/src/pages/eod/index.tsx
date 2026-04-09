import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  DatePicker,
  Row,
  Select,
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
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
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
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<string>(
    dayjs().format("YYYY-MM-DD"),
  );
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>(
    undefined,
  );

  // Get user's branches
  const userBranches = user?.branches || [];

  const { data: eodData, isLoading } = useQuery({
    queryKey: [queryKeys.eod, selectedDate, selectedBranch],
    queryFn: () =>
      salesApi.getEODReport({
        date: selectedDate,
        branch_id: selectedBranch,
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
      MFS: "MFS",
      CREDIT: "Credit",
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
      CREDIT: "red",
    };
    return colors[method] || "default";
  };

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
      render: (amount: number) => `$${amount.toFixed(2)}`,
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
      render: (amount: number) => `$${amount.toFixed(2)}`,
      sorter: (a: ProductSalesStats, b: ProductSalesStats) =>
        a.total_amount - b.total_amount,
    },
    {
      title: "Avg Unit Price",
      dataIndex: "average_unit_price",
      key: "average_unit_price",
      render: (price: number) => `$${price.toFixed(2)}`,
      sorter: (a: ProductSalesStats, b: ProductSalesStats) =>
        a.average_unit_price - b.average_unit_price,
    },
  ];

  return (
    <div>
      {setPageTitle("End of Day Report")}
      <PageTitle
        title="End of Day Report"
        breadcrumbs={[{ title: "Home", href: "/" }, { title: "EOD Report" }]}
      />

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <label>Date:</label>
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
            <p style={{ marginTop: 16 }}>Loading EOD report...</p>
          </div>
        </Card>
      ) : eodData ? (
        <>
          {/* Summary Statistics */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Sales"
                  value={eodData.summary.total_sales}
                  suffix="transactions"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Amount"
                  value={eodData.summary.total_amount}
                  prefix="$"
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Cash Sales"
                  value={eodData.summary.cash_sales}
                  prefix="$"
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Non-Cash Sales"
                  value={eodData.summary.non_cash_sales}
                  prefix="$"
                  precision={2}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Average Transaction"
                  value={eodData.summary.average_transaction_value}
                  prefix="$"
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Items Sold"
                  value={eodData.summary.total_items_sold}
                  suffix="items"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Unique Products"
                  value={eodData.summary.unique_products_sold}
                  suffix="products"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Date"
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
                        {paymentMethodChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          `$${Number(value).toFixed(2)}`,
                          "Amount",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Col>
            </Row>
          </Card>

          {/* Hourly Sales Chart */}
          {hourlyChartData.length > 0 && (
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
                        ? `$${Number(value).toFixed(2)}`
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
    </div>
  );
};

export default EODReport;
