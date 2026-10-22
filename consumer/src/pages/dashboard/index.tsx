import { Money, takaPrefix } from "../../components/Currency";
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
import {
  Alert,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Spin,
  Statistic,
  Tag,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const hasBusinessInsightsPermission =
    user?.permissions?.includes(Permissions.business_insights) ?? false;

  const [paymentPeriod, setPaymentPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  const [returnPaymentPeriod, setReturnPaymentPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  const [topProductsPeriod, setTopProductsPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");

  // Track which card is loading (for showing loading spinner inside the card)
  const [loadingCard, setLoadingCard] = useState<
    "payment" | "return" | "top-products" | null
  >(null);

  // Refs to store scroll position to prevent scroll-to-top
  const scrollPositionRef = useRef<number>(0);

  const handlePaymentPeriodChange = (value: "daily" | "weekly" | "monthly") => {
    // Save current scroll position before state change
    scrollPositionRef.current = window.scrollY;
    setLoadingCard("payment");
    setPaymentPeriod(value);
  };

  const handleReturnPaymentPeriodChange = (
    value: "daily" | "weekly" | "monthly",
  ) => {
    // Save current scroll position before state change
    scrollPositionRef.current = window.scrollY;
    setLoadingCard("return");
    setReturnPaymentPeriod(value);
  };

  const handleTopProductsPeriodChange = (
    value: "daily" | "weekly" | "monthly",
  ) => {
    // Save current scroll position before state change
    scrollPositionRef.current = window.scrollY;
    setLoadingCard("top-products");
    setTopProductsPeriod(value);
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      queryKeys.dashboardAnalytics,
      paymentPeriod,
      returnPaymentPeriod,
      topProductsPeriod,
    ],
    queryFn: () =>
      salesApi.getDashboardAnalytics({
        payment_period: paymentPeriod,
        return_payment_period: returnPaymentPeriod,
        top_products_period: topProductsPeriod,
      }),
    staleTime: queryStaleTimeMap[queryKeys.dashboardAnalytics],
    enabled: hasBusinessInsightsPermission,
  });

  // Clear loading state when data loads and restore scroll position
  useEffect(() => {
    if (!isLoading && loadingCard) {
      setLoadingCard(null);
      // Restore scroll position after data loads
      if (scrollPositionRef.current > 0) {
        window.scrollTo(0, scrollPositionRef.current);
        scrollPositionRef.current = 0;
      }
    }
  }, [isLoading, loadingCard]);

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

  const getPaymentMethodDisplay = (method: string) => {
    switch (method?.toUpperCase()) {
      case "CASH":
        return "Cash";
      case "CARD":
        return "Card";
      case "MFS":
        return "MFS (bKash/Nagad/Rocket)";
      case "CREDIT":
        return "Reward Points / Credit";
      case "EXCHANGE":
        return "Product Exchange";
      case "DELIVERY_PARTNER":
        return "Collected by Delivery Partner";
      case "CHEQUE":
        return "Cheque";
      case "BANK_TRANSFER":
        return "Bank Transfer";
      case "MOBILE_MONEY":
        return "Mobile Money";
      default:
        return method ? method.replace(/_/g, " ") : "Unknown";
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case "CASH":
        return "green";
      case "CARD":
        return "blue";
      case "MFS":
      case "MOBILE_MONEY":
        return "cyan";
      case "CREDIT":
        return "orange";
      case "EXCHANGE":
        return "purple";
      case "CHEQUE":
      case "BANK_TRANSFER":
        return "geekblue";
      default:
        return "default";
    }
  };

  const PaymentMethodsData = useMemo(() => {
    if (!data?.payment_method_breakdown) return [];
    return data.payment_method_breakdown.map((item) => ({
      rawName: item.payment_method,
      name: getPaymentMethodDisplay(item.payment_method),
      color: getPaymentMethodColor(item.payment_method),
      amount: item.total_amount || 0,
    }));
  }, [data?.payment_method_breakdown]);

  const ReturnPaymentMethodsData = useMemo(() => {
    if (!data?.return_payment_breakdown) return [];
    return data.return_payment_breakdown.map((item) => ({
      rawName: item.payment_method,
      name: getPaymentMethodDisplay(item.payment_method),
      color: getPaymentMethodColor(item.payment_method),
      amount: item.total_amount || 0,
    }));
  }, [data?.return_payment_breakdown]);

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
                    Express Sale
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                    Sale with our POS interface
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

      {hasBusinessInsightsPermission && isError && (
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

      {hasBusinessInsightsPermission && (
        <>
          {/* KPI Summary Cards Row */}
          {/* Sales and Return metrics */}
          <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col xs={24} sm={12} md={12} lg={4} style={{ display: "flex" }}>
              <Card
                style={{ height: "100%", width: "100%" }}
                styles={{
                  body: {
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
              >
                <Statistic
                  title="Today's Sale Amount"
                  value={data?.summary?.today_total_sale || 0}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={{ color: "#1890ff" }}
                />
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                    color: isDarkMode ? "#94a3b8" : "#8c8c8c",
                  }}
                >
                  <span>
                    Collected:{" "}
                    <span style={{ color: "#52c41a", fontWeight: 600 }}>
                      <Money
                        value={
                          data?.summary?.today_collected ??
                          data?.summary?.today_total_sale ??
                          0
                        }
                      />
                    </span>
                  </span>
                  {(data?.summary?.today_due ?? 0) > 0 && (
                    <span>
                      Due:{" "}
                      <span style={{ color: "#cf1322", fontWeight: 600 }}>
                        <Money value={data?.summary?.today_due || 0} />
                      </span>
                    </span>
                  )}
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={12} lg={4} style={{ display: "flex" }}>
              <Card
                style={{ height: "100%", width: "100%" }}
                styles={{
                  body: {
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
              >
                <Statistic
                  title="Today's Sale Count"
                  value={data?.summary?.today_transactions || 0}
                  valueStyle={{ color: "#52c41a" }}
                  prefix={<CheckCircleOutlined />}
                />
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: isDarkMode ? "#94a3b8" : "#8c8c8c",
                  }}
                >
                  Completed invoices
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={12} lg={4} style={{ display: "flex" }}>
              <Card
                style={{ height: "100%", width: "100%" }}
                styles={{
                  body: {
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
              >
                <Statistic
                  title="Today's Returns"
                  value={data?.summary?.today_returns_total || 0}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={{ color: "#cf1322" }}
                  suffix={
                    <span style={{ fontSize: "12px", color: "#8c8c8c" }}>
                      ({data?.summary?.today_returns_count || 0})
                    </span>
                  }
                />
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                    color: isDarkMode ? "#94a3b8" : "#8c8c8c",
                  }}
                >
                  <span>
                    Refund:{" "}
                    <span style={{ color: "#cf1322", fontWeight: 600 }}>
                      <Money value={data?.summary?.today_refunds_total || 0} />
                    </span>
                  </span>
                  <span>
                    Exchange:{" "}
                    <span style={{ color: "#1677ff", fontWeight: 600 }}>
                      <Money
                        value={data?.summary?.today_exchanges_total || 0}
                      />
                    </span>
                  </span>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={12} lg={4} style={{ display: "flex" }}>
              <Card
                style={{ height: "100%", width: "100%" }}
                styles={{
                  body: {
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
              >
                <Statistic
                  title="Today's Net Sale"
                  value={data?.summary?.today_net_sale || 0}
                  prefix={takaPrefix}
                  precision={2}
                  valueStyle={{ color: "#389e0d" }}
                />
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: isDarkMode ? "#94a3b8" : "#8c8c8c",
                  }}
                >
                  Gross Sale - Refunds
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={12} lg={4} style={{ display: "flex" }}>
              <Card
                hoverable
                style={{
                  height: "100%",
                  width: "100%",
                  borderBottom: `3px solid #EF4444`,
                }}
                styles={{
                  body: {
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
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
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: isDarkMode ? "#94a3b8" : "#8c8c8c",
                  }}
                >
                  Critical threshold
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={12} lg={4} style={{ display: "flex" }}>
              <Card
                hoverable
                style={{
                  height: "100%",
                  width: "100%",
                  borderBottom: `3px solid #F59E0B`,
                }}
                styles={{
                  body: {
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
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
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    color: isDarkMode ? "#94a3b8" : "#8c8c8c",
                  }}
                >
                  Expiring in 30 days
                </div>
              </Card>
            </Col>
          </Row>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Spin />
            </div>
          ) : (
            <Row
              gutter={[16, 16]}
              style={{ marginBottom: "24px", display: "flex" }}
            >
              {/* Payments Breakdown */}

              <Col xs={24} sm={12}>
                <Card
                  title={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: isDarkMode ? "#f9fafb" : "#111827",
                        }}
                      >
                        Payment Breakdown
                      </span>
                      <Select
                        value={paymentPeriod}
                        onChange={handlePaymentPeriodChange}
                        size="small"
                        style={{ width: 100 }}
                        popupMatchSelectWidth={false}
                        autoFocus={false}
                        options={[
                          { value: "daily", label: "Daily" },
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                        ]}
                      />
                    </div>
                  }
                  style={{
                    height: "100%",
                    border: isDarkMode
                      ? "1px solid #303030"
                      : "1px solid #e5e7eb",
                  }}
                  styles={{
                    body: { padding: "16px", height: "300px" },
                  }}
                >
                  {loadingCard === "payment" ? (
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Spin size="small" />
                    </div>
                  ) : PaymentMethodsData.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        height: "100%",
                      }}
                    >
                      {PaymentMethodsData.map((method, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom:
                              index < PaymentMethodsData.length - 1
                                ? `1px solid ${isDarkMode ? "#303030" : "#e5e7eb"}`
                                : "none",
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
                              title={method.name}
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
                                {method.name}
                              </span>
                            </div>
                          </div>
                          <Tag
                            color={method.color || "blue"}
                            style={{
                              margin: 0,
                              fontWeight: 700,
                              fontSize: "12px",
                              borderRadius: "10px",
                              padding: "0 8px",
                              flexShrink: 0,
                            }}
                          >
                            <Money value={method.amount} />
                          </Tag>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span
                            style={{
                              fontSize: "12px",
                              color: isDarkMode ? "#a0a0a0" : "#6b7280",
                            }}
                          >
                            No payment method data
                          </span>
                        }
                      />
                    </div>
                  )}
                </Card>
              </Col>

              {/* Return Payments Breakdown */}
              <Col xs={24} sm={12}>
                <Card
                  title={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: isDarkMode ? "#f9fafb" : "#111827",
                        }}
                      >
                        Return Payment Breakdown
                      </span>
                      <Select
                        value={returnPaymentPeriod}
                        onChange={handleReturnPaymentPeriodChange}
                        size="small"
                        style={{ width: 100 }}
                        popupMatchSelectWidth={false}
                        autoFocus={false}
                        options={[
                          { value: "daily", label: "Daily" },
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                        ]}
                      />
                    </div>
                  }
                  style={{
                    height: "100%",
                    border: isDarkMode
                      ? "1px solid #303030"
                      : "1px solid #e5e7eb",
                  }}
                  styles={{
                    body: { padding: "16px", height: "300px" },
                  }}
                >
                  {loadingCard === "return" ? (
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Spin size="small" />
                    </div>
                  ) : ReturnPaymentMethodsData.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        height: "100%",
                      }}
                    >
                      {ReturnPaymentMethodsData.map((method, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom:
                              index < ReturnPaymentMethodsData.length - 1
                                ? `1px solid ${isDarkMode ? "#303030" : "#e5e7eb"}`
                                : "none",
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
                              title={method.name}
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
                                {method.name}
                              </span>
                            </div>
                          </div>
                          <Tag
                            color={method.color || "orange"}
                            style={{
                              margin: 0,
                              fontWeight: 700,
                              fontSize: "12px",
                              borderRadius: "10px",
                              padding: "0 8px",
                              flexShrink: 0,
                            }}
                          >
                            <Money value={method.amount} />
                          </Tag>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span
                            style={{
                              fontSize: "12px",
                              color: isDarkMode ? "#a0a0a0" : "#6b7280",
                            }}
                          >
                            No return payment data
                          </span>
                        }
                      />
                    </div>
                  )}
                </Card>
              </Col>

              {/* Top 5 Products List */}
              <Col xs={24} sm={12}>
                <Card
                  title={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: isDarkMode ? "#f9fafb" : "#111827",
                        }}
                      >
                        Top 5 Products
                      </span>
                      <Select
                        value={topProductsPeriod}
                        onChange={handleTopProductsPeriodChange}
                        size="small"
                        style={{ width: 100 }}
                        popupMatchSelectWidth={false}
                        autoFocus={false}
                        options={[
                          { value: "daily", label: "Daily" },
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                        ]}
                      />
                    </div>
                  }
                  style={{
                    height: "100%",
                    border: isDarkMode
                      ? "1px solid #303030"
                      : "1px solid #e5e7eb",
                  }}
                  styles={{
                    body: { padding: "16px", height: "300px" },
                  }}
                >
                  {loadingCard === "top-products" ? (
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Spin size="small" />
                    </div>
                  ) : topProductsData.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        height: "100%",
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
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
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
                    </div>
                  )}
                </Card>
              </Col>

              {/* Weekly Sales Trend */}
              <Col xs={24} sm={12}>
                <Card
                  title={
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: isDarkMode ? "#f9fafb" : "#111827",
                      }}
                    >
                      Weekly Sales Trend
                    </span>
                  }
                  style={{
                    height: "100%",
                    border: isDarkMode
                      ? "1px solid #303030"
                      : "1px solid #e5e7eb",
                  }}
                  styles={{
                    body: { padding: "16px", height: "300px" },
                  }}
                >
                  {weeklyTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
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
                            name === "Amount" ||
                            name === "Net" ||
                            name === "Returns"
                              ? `BDT ${value?.toLocaleString()}`
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
                          dataKey="net_amount"
                          stroke="#389E0D"
                          name="Net"
                          strokeWidth={2}
                          strokeDasharray="4 2"
                          dot={{ r: 3, strokeWidth: 0, fill: "#389E0D" }}
                          activeDot={{ r: 4, fill: "#389E0D" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="returns_amount"
                          stroke="#CF1322"
                          name="Returns"
                          strokeWidth={2}
                          dot={{ r: 3, strokeWidth: 0, fill: "#CF1322" }}
                          activeDot={{ r: 4, fill: "#CF1322" }}
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
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
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
                    </div>
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
