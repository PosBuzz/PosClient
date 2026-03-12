import { ArrowLeftOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
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
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { Option } = Select;

const ViewVariantSalesStats = () => {
  const { variantId } = useParams<{ variantId: string }>();
  const location = useLocation();

  const state = (location.state ?? {}) as {
    startDate?: string;
    endDate?: string;
    branchId?: number | null;
    variantName?: string;
    productName?: string;
  };

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    state.startDate ? dayjs(state.startDate) : dayjs().startOf("week"),
    state.endDate ? dayjs(state.endDate) : dayjs(),
  ]);
  const [branchId, setBranchId] = useState<number | null | undefined>(
    state.branchId ?? null,
  );
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [dateRange, branchId]);

  const displayName = state.productName
    ? `${state.productName} – ${state.variantName ?? ""}`
    : `Variant #${variantId}`;

  const { data: branchOptions = [] } = useQuery({
    queryKey: [queryKeys.branchOptions],
    queryFn: () => salesApi.getBranchOptions(),
    staleTime: queryStaleTimeMap[queryKeys.branchOptions],
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      queryKeys.variantSalesStats,
      variantId,
      dateRange,
      branchId,
      pagination.page,
      pagination.limit,
    ],
    queryFn: () =>
      salesApi.getVariantSalesDetail(Number(variantId), {
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
        branch_id: branchId,
        page: pagination.page,
        limit: pagination.limit,
      }),
    enabled: !!variantId,
    staleTime: queryStaleTimeMap[queryKeys.variantSalesStats],
  });

  const summary = data?.summary ?? {};
  const chartData = data?.chart_data ?? [];
  const items: any[] = data?.data ?? [];
  const meta = data?.meta ?? {};
  const variant = data?.variant ?? {};

  const disabledDate = (current: dayjs.Dayjs) =>
    current && current.isAfter(dayjs().endOf("day"));

  const normalizedChartData = useMemo(() => {
    const chartMap = new Map<string, { qty: number; total_amount: number }>();

    for (const row of chartData) {
      chartMap.set(row.date, {
        qty: Number(row.qty ?? 0),
        total_amount: Number(row.total_amount ?? 0),
      });
    }

    const start = dateRange[0].startOf("day");
    const end = dateRange[1].startOf("day");
    const days = end.diff(start, "day") + 1;

    return Array.from({ length: Math.max(days, 0) }, (_, index) => {
      const date = start.add(index, "day").format("YYYY-MM-DD");
      const values = chartMap.get(date);

      return {
        date,
        qty: values?.qty ?? 0,
        total_amount: values?.total_amount ?? 0,
      };
    });
  }, [chartData, dateRange]);

  const columns = [
    {
      title: "Sale #",
      dataIndex: "sale_number",
      key: "sale_number",
      render: (v: string, r: any) => (
        <Link to={`/sales/view/${r.sale_id}`}>
          <Text style={{ color: "#1677ff" }}>{v}</Text>
        </Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      render: (v: string) => dayjs(v).format("DD MMM YYYY, hh:mm A"),
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
      render: (v: string | null) =>
        v ? <Text>{v}</Text> : <Text type="secondary">Walk-in</Text>,
    },
    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
      responsive: ["md"] as any,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      align: "right" as const,
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: "Total Amount",
      dataIndex: "line_total",
      key: "line_total",
      align: "right" as const,
      render: (v: number) => (
        <Text type="success" strong>
          ${Number(v).toFixed(2)}
        </Text>
      ),
      sorter: (a: any, b: any) => a.line_total - b.line_total,
    },
    {
      title: "Status",
      dataIndex: "payment_status",
      key: "payment_status",
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          paid: "green",
          partial: "orange",
          due: "red",
          cancelled: "default",
        };
        return <Tag color={colorMap[v] ?? "default"}>{v?.toUpperCase()}</Tag>;
      },
    },
  ];

  const pageTitle = variant?.product_name
    ? `${variant.product_name} – ${variant.name}`
    : displayName;

  return (
    <>
      {setPageTitle(`Variant Stats – ${pageTitle}`)}
      <PageTitle
        title={pageTitle}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Products", href: "/products" },
          {
            title: "Variant Sales Stats",
            href: "/product-variant-sales-stats",
          },
          { title: pageTitle },
        ]}
        rightSection={
          <Link to="/product-variant-sales-stats">
            <Button icon={<ArrowLeftOutlined />}>Back</Button>
          </Link>
        }
      />

      <Row gutter={[16, 16]}>
        {/* Filters */}
        <Col xs={24}>
          <Card>
            <Space size="large" wrap align="center">
              <Text strong>Date Range:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) =>
                  dates &&
                  dates[0] &&
                  dates[1] &&
                  setDateRange([dates[0], dates[1]])
                }
                format="YYYY-MM-DD"
                disabledDate={disabledDate}
                allowClear={false}
              />
              <Text strong style={{ marginLeft: 16 }}>
                Branch:
              </Text>
              <Select
                style={{ minWidth: 180 }}
                placeholder="All Branches"
                value={branchId}
                onChange={(v) => setBranchId(v)}
                allowClear
              >
                {branchOptions.map((b) => (
                  <Option key={b.id} value={b.id}>
                    {b.name}
                  </Option>
                ))}
              </Select>
            </Space>
          </Card>
        </Col>

        {/* Summary Statistics */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="Total Sales" value={summary.total_sales ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="Total Qty Sold" value={summary.total_qty ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Avg Qty / Sale"
              value={summary.avg_qty ?? 0}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Amount"
              value={summary.total_amount ?? 0}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Avg Amount / Sale"
              value={summary.avg_amount ?? 0}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>

        {/* Daily Sales Amount Chart */}
        {normalizedChartData.length > 0 ? (
          <>
            <Col xs={24} lg={12}>
              <Card title="Daily Revenue Trend">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={normalizedChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => dayjs(v).format("DD MMM")}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => [
                        `$${Number(value).toFixed(2)}`,
                        "Amount",
                      ]}
                      labelFormatter={(label) =>
                        dayjs(label).format("DD MMM YYYY")
                      }
                    />
                    <Bar dataKey="total_amount" fill="#1677ff" name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Daily Quantity Sold">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={normalizedChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => dayjs(v).format("DD MMM")}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value: any) => [value, "Qty Sold"]}
                      labelFormatter={(label) =>
                        dayjs(label).format("DD MMM YYYY")
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="qty"
                      stroke="#52c41a"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Qty Sold"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </>
        ) : (
          !isLoading && (
            <Col xs={24}>
              <Card>
                <Empty description="No sales data available for selected range" />
              </Card>
            </Col>
          )
        )}

        {/* Sales Table */}
        <Col xs={24}>
          <Card title="Individual Sale Records">
            <Table
              dataSource={items}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              pagination={{
                current: pagination.page,
                pageSize: pagination.limit,
                total: meta.total ?? 0,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} records`,
                onChange: (page, pageSize) =>
                  setPagination({ page, limit: pageSize }),
              }}
              scroll={{ x: "max-content" }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default ViewVariantSalesStats;
