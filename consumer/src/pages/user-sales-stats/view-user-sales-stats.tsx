import { ArrowLeftOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";
import type { Sale } from "../../types/sale.types";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const ViewUserSalesStats = () => {
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();

  // Read passed state from navigation
  const state = (location.state ?? {}) as {
    startDate?: string;
    endDate?: string;
    userName?: string;
  };

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    state.startDate ? dayjs(state.startDate) : dayjs().startOf("month"),
    state.endDate ? dayjs(state.endDate) : dayjs(),
  ]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
  });
  const userName = state.userName ?? `User #${userId}`;

  const { data, isLoading } = useQuery({
    queryKey: [queryKeys.userSalesStats, "detail", userId, dateRange, pagination.page],
    queryFn: () =>
      salesApi.getUserSalesDetail(Number(userId), {
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
        page: pagination.page,
        limit: pagination.limit,
      }),
    enabled: !!userId,
  });

  const sales: Sale[] = data?.data ?? [];
  const totalAmount = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const averageAmount = sales.length > 0 ? totalAmount / sales.length : 0;

  const disabledDate = (current: dayjs.Dayjs) =>
    current && current.isAfter(dayjs().endOf("day"));

  const columns = [
    {
      title: "Sale #",
      dataIndex: "sale_number",
      key: "sale_number",
      render: (v: string, r: Sale) => (
        <Link to={`/sales/view/${r.id}`}>
          <Text style={{ color: "#1677ff" }}>{v}</Text>
        </Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      render: (v: string) => dayjs(v).format("DD MMM YYYY, HH:mm"),
    },
    {
      title: "Customer",
      key: "customer",
      render: (_: any, r: Sale) =>
        r.customer?.name ??
        r.customer_name ?? <Text type="secondary">Walk-in</Text>,
    },
    {
      title: "Total",
      dataIndex: "total_amount",
      key: "total_amount",
      align: "right" as const,
      render: (v: number) => <Text strong>${Number(v).toFixed(2)}</Text>,
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

  return (
    <>
      {setPageTitle(`Sales – ${userName}`)}
      <PageTitle
        title={`Sales by ${userName}`}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "User Sales Stats", href: "/user-sales-stats" },
          { title: userName },
        ]}
        rightSection={
          <Link to="/user-sales-stats">
            <Button icon={<ArrowLeftOutlined />}>Back</Button>
          </Link>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card>
            <Space wrap align="center">
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
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Total Sales Amount"
              value={totalAmount}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Average Sales Amount"
              value={averageAmount}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic title="Total Transactions" value={sales.length} />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={`${userName}'s Sales`}>
            <Table
              dataSource={sales}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              scroll={{ x: "max-content" }}
              pagination={{
                current: pagination.page,
                pageSize: pagination.limit,
                total: data?.meta?.total,
                showSizeChanger: true,
                onChange: (page, pageSize) =>
                  setPagination({ page, limit: pageSize }),
              }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default ViewUserSalesStats;
