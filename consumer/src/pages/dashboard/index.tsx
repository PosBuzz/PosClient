import {
  CalculatorOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Empty, Row, Spin, Statistic, Tag } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { salesApi } from "../../api/sales-api";
import { Permissions } from "../../constants/permissions";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import useDarkMode from "../../hooks/useDarkMode";
import { useAuthStore } from "../../stores/authStore";
import { setPageTitle } from "../../utils/setPageTitle";

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isDarkMode = useDarkMode();
  const hasSalesPermission =
    user?.permissions?.includes(Permissions.sales) ?? false;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [queryKeys.dashboardAnalytics],
    queryFn: () => salesApi.getDashboardAnalytics(),
    staleTime: queryStaleTimeMap[queryKeys.dashboardAnalytics],
    enabled: hasSalesPermission,
  });

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
      </div>

      {hasSalesPermission && isError && (
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

      {hasSalesPermission && (
        <>
          {/* KPI Summary Cards Row */}
          {/* Sales and Return metrics */}
          <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Today's Sale Amount"
                  value={data?.summary?.today_total_sale || 0}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Sales Today"
                  value={data?.summary?.today_transactions || 0}
                  valueStyle={{ color: "#52c41a" }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card style={{ borderBottom: `3px solid #F97316` }}>
                <Statistic
                  title="Today's Returns"
                  value={data?.summary?.today_return_count || 0}
                  prefix={<WarningOutlined style={{ color: "#F97316" }} />}
                  valueStyle={{ color: "#F97316" }}
                />
              </Card>
            </Col>
          </Row>

          {/* Low Stock and Expiring Soon - Side by side */}
          <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col xs={24} sm={12}>
              <Card
                hoverable
                style={{ borderBottom: `3px solid #EF4444` }}
                onClick={() => navigate("/inventory/low-stock")}
              >
                <Statistic
                  title={
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <WarningOutlined
                        style={{ color: "#EF4444", fontSize: "14px" }}
                      />
                      Low Stock
                    </span>
                  }
                  value={data?.low_stock?.total_critical_items || 0}
                  suffix="Items"
                  valueStyle={{ color: "#EF4444" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card
                hoverable
                style={{ borderBottom: `3px solid #F59E0B` }}
                onClick={() => navigate("/inventory/expiring")}
              >
                <Statistic
                  title={
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <ClockCircleOutlined
                        style={{ color: "#F59E0B", fontSize: "14px" }}
                      />
                      Expiring Soon
                    </span>
                  }
                  value={data?.expiring_items?.total_expiring_items || 0}
                  suffix="Items"
                  valueStyle={{ color: "#F59E0B" }}
                />
              </Card>
            </Col>
          </Row>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Spin />
            </div>
          ) : (
            <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
              {/* Weekly Sales Trend */}
              <Col xs={24} sm={12}>
                <Card
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
                          stroke={isDarkMode ? "#303030" : "#091413"}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{
                            fontSize: 10,
                            fill: isDarkMode ? "#a0a0a0" : "#6b7285",
                          }}
                          tickLine={false}
                          axisLine={{
                            stroke: isDarkMode ? "#303030" : "#e5e7eb",
                          }}
                          dy={6}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: isDarkMode ? "#a0a0a0" : "#6b7280",
                          }}
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
                            backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
                            color: isDarkMode ? "#ffffff" : "#000000",
                          }}
                          itemStyle={{
                            padding: "2px 0",
                            color: isDarkMode ? "#ffffff" : "#000000",
                          }}
                          labelStyle={{
                            fontWeight: 600,
                            marginBottom: "2px",
                            color: isDarkMode ? "#ffffff" : "#000000",
                          }}
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
                          dot={{ r: 3, strokeWidth: 0, fill: "#2563EB" }}
                          activeDot={{ r: 4, fill: "#2563EB" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="sales_count"
                          stroke="#06B6D4"
                          name="Sales"
                          strokeWidth={2}
                          dot={{ r: 3, strokeWidth: 0, fill: "#06B6D4" }}
                          activeDot={{ r: 4, fill: "#06B6D4" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span
                          style={{
                            fontSize: "12px",
                            color: isDarkMode ? "#a0a0a0" : "#6b7280",
                          }}
                        >
                          No trend data
                        </span>
                      }
                    />
                  )}
                </Card>
              </Col>

              {/* Top 5 Products List lg={8} */}
              <Col xs={24} sm={12}>
                <Card
                  size="small"
                  title={
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: isDarkMode ? "#f9fafb" : "#111827",
                      }}
                    >
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
                        height: "290px",
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
                                fontWeight: 600,
                                fontSize: "11px",
                                color: isDarkMode ? "#94a3b8" : "#9ca3af",
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
                                  fontWeight: 600,
                                  fontSize: "13px",
                                  color: isDarkMode ? "#f3f4f6" : "#111827",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  lineHeight: "1.35",
                                }}
                              >
                                {product.productName}
                              </span>
                              {product.variantName && (
                                <span
                                  style={{
                                    fontWeight: 500,
                                    fontSize: "12px",
                                    color: isDarkMode ? "#cbd5e1" : "#6b7280",
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
                              fontWeight: 700,
                              fontSize: "12px",
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
                        <span
                          style={{
                            fontSize: "12px",
                            color: isDarkMode ? "#a0a0a0" : "#6b7280",
                          }}
                        >
                          No product data
                        </span>
                      }
                    />
                  )}
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </>
  );
}

export default Dashboard;
