import {
  Card,
  Col,
  DatePicker,
  Progress,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";
import { salesApi } from "../../api/sales-api";
import { DailyTargetRow } from "../../types/sale.types";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";

const { Text } = Typography;
const { Option } = Select;

const DailyTargetReport = () => {
  const { user } = useAuthStore();
  const userBranches = user?.branches || [];

  const [selectedDate, setSelectedDate] = useState<string>(
    dayjs().format("YYYY-MM-DD"),
  );
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>(
    undefined,
  );

  const { data, isLoading } = useQuery({
    queryKey: [queryKeys.dailyTarget, selectedDate, selectedBranch],
    queryFn: () =>
      salesApi.getDailyTargetReport({
        date: selectedDate,
        branch_id: selectedBranch,
      }),
    enabled: !!selectedDate,
    staleTime: queryStaleTimeMap[queryKeys.dailyTarget],
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setPageTitle("Daily Sales Target");
  }, []);

  const getStatusTag = (pct: number) => {
    if (pct >= 100) return <Tag color="green">On Target</Tag>;
    if (pct >= 70) return <Tag color="orange">Near Target</Tag>;
    return <Tag color="red">Below Target</Tag>;
  };

  const columns = [
    {
      title: "Product",
      key: "product",
      render: (record: DailyTargetRow) => (
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
      title: "Daily Target",
      dataIndex: "daily_target",
      key: "daily_target",
      sorter: (a: DailyTargetRow, b: DailyTargetRow) =>
        a.daily_target - b.daily_target,
    },
    {
      title: "Actual Sold",
      dataIndex: "actual_sold",
      key: "actual_sold",
      sorter: (a: DailyTargetRow, b: DailyTargetRow) =>
        a.actual_sold - b.actual_sold,
    },
    {
      title: "Gap",
      dataIndex: "gap",
      key: "gap",
      render: (gap: number) => (
        <Text type={gap >= 0 ? "success" : "danger"}>
          {gap >= 0 ? `+${gap}` : gap}
        </Text>
      ),
      sorter: (a: DailyTargetRow, b: DailyTargetRow) => a.gap - b.gap,
    },
    {
      title: "Achievement",
      key: "achievement",
      render: (record: DailyTargetRow) => (
        <div style={{ minWidth: 160 }}>
          <Progress
            percent={Math.min(record.achievement_pct, 100)}
            size="small"
            status={
              record.achievement_pct >= 100
                ? "success"
                : record.achievement_pct >= 70
                  ? "normal"
                  : "exception"
            }
            format={() => `${record.achievement_pct}%`}
          />
        </div>
      ),
      sorter: (a: DailyTargetRow, b: DailyTargetRow) =>
        a.achievement_pct - b.achievement_pct,
    },
    {
      title: "Status",
      key: "status",
      render: (record: DailyTargetRow) => getStatusTag(record.achievement_pct),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Daily Sales Target"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Daily Sales Target" },
        ]}
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
                if (date) setSelectedDate(date.format("YYYY-MM-DD"));
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

      {/* Summary Cards */}
      {data && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Target (units)"
                value={data.summary.total_target}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Sold (units)"
                value={data.summary.total_sold}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Overall Achievement"
                value={data.summary.overall_achievement_pct}
                suffix="%"
                valueStyle={{
                  color:
                    data.summary.overall_achievement_pct >= 100
                      ? "#3f8600"
                      : data.summary.overall_achievement_pct >= 70
                        ? "#d48806"
                        : "#cf1322",
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Pivot Table */}
      <Card>
        <Table
          dataSource={data?.rows || []}
          columns={columns}
          rowKey="variant_id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: "No products with daily targets found." }}
        />
      </Card>
    </div>
  );
};

export default DailyTargetReport;
