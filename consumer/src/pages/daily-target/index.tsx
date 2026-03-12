import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { DailyTargetRow } from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { Option } = Select;

const DailyTargetReport = () => {
  const { user } = useAuthStore();
  // Get user's branches from auth store
  const userBranches = user?.branches || [];

  const [selectedDate, setSelectedDate] = useState<string>(
    dayjs().format("YYYY-MM-DD"),
  );

  const [selectedBranch, setSelectedBranch] = useState<number | undefined>(
    undefined,
  );

  // 2. New State for Search Text
  const [searchText, setSearchText] = useState<string>("");

  // State for the filter dropdown ('all', 'achieved', 'not_achieved')
  const [targetStatusFilter, setTargetStatusFilter] = useState<string>();

  const [pagination, setPagination] = useState({ page: 1, limit: 20 });

  const { data, isLoading } = useQuery({
    queryKey: [
      queryKeys.dailyTarget,
      selectedDate,
      selectedBranch,
      pagination.page,
      pagination.limit,
    ],
    queryFn: () =>
      salesApi.getDailyTargetReport({
        date: selectedDate,
        branch_id: selectedBranch,
        page: pagination.page,
        limit: pagination.limit,
      }),
    enabled: !!selectedDate,
    staleTime: queryStaleTimeMap[queryKeys.dailyTarget],
    refetchOnWindowFocus: false,
  });

  // Set default branch from user's branches
  useEffect(() => {
    if (userBranches.length > 0 && !selectedBranch) {
      // Just select the first branch from user's assigned branches
      const defaultBranch = userBranches[0];
      setSelectedBranch(defaultBranch.id);
    }
  }, [userBranches, selectedBranch]);

  // filter
  const filteredRows = (data?.rows || []).filter((row) => {
    // if (targetStatusFilter === "all") return true;

    // If percentage is 100 or more, it's achieved
    const isAchieved = row.achievement_pct >= 100;
    let statusMatch = true;

    if (targetStatusFilter === "achieved") {
      statusMatch = isAchieved;
    } else if (targetStatusFilter === "not_achieved") {
      statusMatch = !isAchieved;
    }

    // B. Filter by Search Text
    let searchMatch = true;
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();

      const matchProduct = row.product_name.toLowerCase().includes(lowerSearch);

      const matchVariant = row.variant_name.toLowerCase().includes(lowerSearch);

      const matchSku = (row.sku || "").toLowerCase().includes(lowerSearch);

      searchMatch = matchProduct || matchVariant || matchSku;
    }

    return statusMatch && searchMatch;
  });

  const columns = [
    {
      title: "Product",
      key: "product",
      render: (record: DailyTargetRow) => (
        <div>
          <Text strong>{record.product_name}</Text>

          <Text type="secondary" style={{ marginLeft: 4 }}>
            - {record.variant_name}
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
    },
    {
      title: "Actual Sold",
      dataIndex: "actual_sold",
      key: "actual_sold",
    },
    {
      title: "Gap",
      dataIndex: "gap",
      key: "gap",
      render: (gap: number) => <Text>{gap}</Text>,
    },
    {
      title: "Status",
      key: "status",
      render: (record: DailyTargetRow) => {
        const isFilled = record.gap <= 0;
        return (
          <Tag color={isFilled ? "success" : "error"}>
            {isFilled ? "Filled" : "Failed"}
          </Tag>
        );
      },
    },
  ];

  return (
    <div>
      {setPageTitle("Daily Sales Target")}
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
            <label>Search:</label>
            <Input
              style={{ width: "100%", marginTop: 4 }}
              placeholder="Search name, variant, SKU..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              allowClear
            />
          </Col>
          <Col span={6}>
            <label>Date:</label>
            <DatePicker
              style={{ width: "100%", marginTop: 4 }}
              value={dayjs(selectedDate)}
              disabledDate={(current) =>
                current && current > dayjs().endOf("day")
              }
              onChange={(date) => {
                if (date) {
                  setSelectedDate(date.format("YYYY-MM-DD"));
                  setPagination((prev) => ({ ...prev, page: 1 }));
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
              value={selectedBranch}
              onChange={(value) => {
                setSelectedBranch(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              {userBranches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <label>Target Status:</label>
            <Select
              placeholder="Filter Status"
              style={{ width: "100%", marginTop: 4 }}
              value={targetStatusFilter}
              onChange={(value) => {
                setTargetStatusFilter(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              allowClear={true}
            >
              <Option value="achieved">Achieved</Option>
              <Option value="not_achieved">Not Achieved</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Pivot Table */}
      <Card>
        <Table
          dataSource={filteredRows}
          columns={columns}
          rowKey="variant_id"
          loading={isLoading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: data?.meta?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
            onChange: (page, pageSize) =>
              setPagination({ page, limit: pageSize }),
          }}
        />
      </Card>
    </div>
  );
};

export default DailyTargetReport;
