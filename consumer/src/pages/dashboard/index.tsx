import {
  CalculatorOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
} from "antd";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PieLabelRenderProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { setPageTitle } from "../../utils/setPageTitle";
import { useAuthStore } from "../../stores/authStore";
import { Permissions } from "../../constants/permissions";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { salesApi } from "../../api/sales-api";

const RADIAN = Math.PI / 180;
const PIE_COLORS = [
  "#2563EB", // Blue
  "#06B6D4", // Cyan
  "#22C55E", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#F97316", // Orange
  "#14B8A6", // Teal
];
const renderInsideLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  // Recharts sometimes passes undefined during initial render
  if (
    cx == null ||
    cy == null ||
    innerRadius == null ||
    outerRadius == null ||
    percent == null
  ) {
    return null;
  }

  // Calculate radius precisely halfway between inner and outer radius
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;

  // Calculate X and Y using trigonometry
  const ncx = Number(cx);
  const x = ncx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const ncy = Number(cy);
  const y = ncy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white" // White text to contrast with the pie color
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="11px" // Slightly smaller font so it fits inside the slice
      fontWeight="600"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [queryKeys.dashboardAnalytics],
    queryFn: () => salesApi.getDashboardAnalytics(),
    staleTime: queryStaleTimeMap[queryKeys.dashboardAnalytics],
  });

  const paymentChartData = useMemo(() => {
    if (!data?.payment_method_breakdown) return [];
    return data.payment_method_breakdown.map((item) => ({
      name: item.payment_method || "Unknown",
      amount: item.total_amount || 0,
    }));
  }, [data?.payment_method_breakdown]);

  const topProductsData = useMemo(() => {
    if (!data?.top_products) return [];
    return data.top_products.slice(0, 5).map((item) => {
      const prodName = item.product_name || "Product";
      const varName = item.variant_name;

      return {
        fullName: varName ? `${prodName} - ${varName}` : prodName,
        productName: prodName,
        variantName: varName,
        quantity: item.total_quantity || 0,
      };
    });
  }, [data?.top_products]);


  const inventoryData = useMemo(() => {
    if (!data) return [];
    return [
      {
        category: "Low Stock",
        count: data.low_stock?.total_critical_items || 0,
        color: "#EF4444",
        icon: <WarningOutlined />,
      },
      {
        category: "Expiring Soon",
        count: data.expiring_items?.total_expiring_items || 0,
        color: "#F59E0B",
        icon: <ClockCircleOutlined />,
      },
    ];
  }, [data]);

  const weeklyTrendData = data?.weekly_sales_trend || [];

  return (
    <>
      {setPageTitle("PosBuzz | Home")}

      <div style={{ padding: "24px 0" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          Welcome to PosBuzz
        </h1>

        <Row gutter={[24, 24]} justify="center">
          {user?.permissions?.includes(Permissions.sales) && (
            <>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{
                    textAlign: "center",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    border: "none",
                    borderRadius: "16px",
                    color: "white",
                  }}
                  bodyStyle={{ padding: "32px 24px" }}
                  onClick={() => navigate("/pos")}
                >
                  <CalculatorOutlined
                    style={{ fontSize: "3rem", marginBottom: "16px" }}
                  />
                  <h3 style={{ color: "white", marginBottom: "8px" }}>
                    Point of Sale
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                    Start selling with our modern POS interface
                  </p>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{
                    textAlign: "center",
                    background:
                      "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                    border: "none",
                    borderRadius: "16px",
                    color: "white",
                  }}
                  bodyStyle={{ padding: "32px 24px" }}
                  onClick={() => navigate("/sales")}
                >
                  <ShoppingCartOutlined
                    style={{ fontSize: "3rem", marginBottom: "16px" }}
                  />
                  <h3 style={{ color: "white", marginBottom: "8px" }}>
                    Sales Management
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                    View and manage all your sales
                  </p>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{
                    textAlign: "center",
                    background:
                      "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                    border: "none",
                    borderRadius: "16px",
                    color: "white",
                  }}
                  bodyStyle={{ padding: "32px 24px" }}
                  onClick={() => navigate("/sales/new")}
                >
                  <PlusOutlined
                    style={{ fontSize: "3rem", marginBottom: "16px" }}
                  />
                  <h3 style={{ color: "white", marginBottom: "8px" }}>
                    New Sale
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                    Create a detailed sale transaction
                  </p>
                </Card>
              </Col>
            </>
          )}
          {user?.permissions?.includes(Permissions.inventory_batches) && (
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                style={{
                  textAlign: "center",
                  background:
                    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  border: "none",
                  borderRadius: "16px",
                  color: "white",
                }}
                bodyStyle={{ padding: "32px 24px" }}
                onClick={() => navigate("/inventory/batches")}
              >
                <DashboardOutlined
                  style={{ fontSize: "3rem", marginBottom: "16px" }}
                />
                <h3 style={{ color: "white", marginBottom: "8px" }}>
                  Inventory
                </h3>
                <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                  Manage products and inventory
                </p>
              </Card>
            </Col>
          )}
        </Row>

        {user?.permissions?.includes(Permissions.sales) && (
          <div style={{ textAlign: "center", marginTop: "3rem" }}>
            <Space size="large">
              <Button
                type="primary"
                size="large"
                icon={<CalculatorOutlined />}
                onClick={() => navigate("/pos")}
                style={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: "8px",
                  height: "48px",
                  fontSize: "16px",
                  fontWeight: "600",
                  padding: "0 32px",
                }}
              >
                Launch POS Terminal
              </Button>
            </Space>
          </div>
        )}
      </div>

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: "16px", marginBottom: "16px" }}
          message={
            error instanceof Error
              ? error.message
              : "Failed to load dashboard data"
          }
        />
      )}

      {/* KPI Summary Cards & Inventory Health Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Weekly Total Sale"
              value={data?.summary?.weekly_total_sale || 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Weekly Transactions"
              value={data?.summary?.weekly_transactions || 0}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Today's Total Sale"
              value={data?.summary?.today_total_sale || 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Today's Transactions"
              value={data?.summary?.today_transactions || 0}
              valueStyle={{ color: "#eb2f96" }}
            />
          </Card>
        </Col>

        {/* Inventory Health converted to KPI style */}
        <Col xs={24} sm={12} md={6}>
          <Card
            styles={{ body: { padding: "0 24px 24px" } }}
            style={{ borderBottom: `3px solid #EF4444` }}
          >
            <Statistic
              title={
                <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <WarningOutlined
                    style={{ color: "#EF4444", fontSize: "14px" }}
                  />
                  Inventory Alerts
                </span>
              }
              value={inventoryData.reduce((sum, item) => sum + item.count, 0)}
              suffix="Items"
              valueStyle={{ color: "#EF4444" }}
            />
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              {inventoryData.map((item, idx) => (
                <span key={idx} style={{ fontSize: "12px", color: "#6b7280" }}>
                  {item.category}:{" "}
                  <span style={{ fontWeight: 600, color: item.color }}>
                    {item.count}
                  </span>
                </span>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Spin />
        </div>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
          {/* Weekly Sales Trend lg={8} */}
          <Col xs={24} sm={12}>
            <Card
              // size="small"
              title={
                <span style={{ fontSize: "13px", fontWeight: 600 }}>
                  Weekly Sales Trend
                </span>
              }
              styles={{ body: { padding: "12px 8px 4px" } }}
            >
              {weeklyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={weeklyTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                      dy={6}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      dx={-4}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: "12px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      }}
                      itemStyle={{ padding: "2px 0" }}
                      labelStyle={{ fontWeight: 600, marginBottom: "2px" }}
                      formatter={(value, name) => [
                        name === "Amount"
                          ? `$${value?.toLocaleString()}`
                          : value,
                        name,
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                      iconSize={8}
                      iconType="circle"
                    />
                    <Line
                      type="monotone"
                      dataKey="total_amount"
                      stroke="#2563EB"
                      name="Amount"
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales_count"
                      stroke="#06B6D4"
                      name="Sales"
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: "12px" }}>No trend data</span>
                  }
                />
              )}
            </Card>
          </Col>

          {/* Payment Methods Pie lg={8} */}
          <Col xs={24} sm={12}>
            <Card
              size="small"
              title={
                <span style={{ fontSize: "13px", fontWeight: 600 }}>
                  Payment Methods
                </span>
              }
              styles={{ body: { padding: "12px 8px 4px" } }}
            >
              {paymentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      // outerRadius={58}
                      // innerRadius={28}
                      // paddingAngle={2}
                      // label={({ name, percent = 0 }) =>
                      //   `${name} ${(percent * 100).toFixed(0)}%`
                      // }
                      // labelLine={{ stroke: "#9ca3af", strokeWidth: 1 }}
                      labelLine={false}
                      label={renderInsideLabel}
                    >
                      {paymentChartData.map((_, idx) => (
                        <Cell
                          key={`payment-cell-${idx}`}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                          strokeWidth={1}
                          stroke="#fff"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        fontSize: "12px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      }}
                      formatter={(value) => [
                        `$${value?.toLocaleString()}`,
                        "Amount",
                      ]}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "11px",
                        paddingTop: "4px",
                      }}
                      iconSize={8}
                      iconType="circle"
                      layout="horizontal"
                      verticalAlign="bottom"
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: "12px" }}>No payment data</span>
                  }
                />
              )}
            </Card>
          </Col>

          {/* Top 5 Products List */}
          <Col xs={24} sm={12} lg={8}>
            <Card
              size="small"
              title={
                <span style={{ fontSize: "13px", fontWeight: 600 }}>
                  Top 5 Products
                </span>
              }
              styles={{ body: { padding: "8px 12px 12px" } }}
            >
              {topProductsData.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: "180px",
                  }}
                >
                  {topProductsData.map((product, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "12px",
                            color: "#9ca3af",
                            flexShrink: 0,
                          }}
                        >
                          {index + 1}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                          }}
                          title={product.fullName}
                        >
                          <span
                            style={{
                              fontWeight: 500,
                              fontSize: "12px",
                              color: "#1f2937",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: "1.3",
                            }}
                          >
                            {product.productName}
                          </span>
                          {product.variantName && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                lineHeight: "1.3",
                              }}
                            >
                              {product.variantName}
                            </span>
                          )}
                        </div>
                      </div>
                      <Tag
                        color="blue"
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          fontSize: "11px",
                          borderRadius: "10px",
                          padding: "0 8px",
                          flexShrink: 0,
                        }}
                      >
                        {product.quantity} sold
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: "12px" }}>No product data</span>
                  }
                />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </>
  );
}

export default Dashboard;
