import { Money, takaPrefix } from "../../components/Currency";
import {
  EyeOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { returnsApi } from "../../api/returns-api";
import PageTitle from "../../components/PageTitle";
import PdfPreviewModal, {
  usePdfPreview,
} from "../../components/PdfPreviewModal";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import type { Return, ReturnListFilters } from "../../types/return.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const ReturnsTable = () => {
  const { user } = useAuthStore();
  const { preview, previewProps } = usePdfPreview();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<ReturnListFilters>({
    page: 1,
    limit: 20,
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
    }, 300),
    [],
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = (value: string) => {
    debouncedSearch(value);
  };

  // Use real API query with optimized caching
  const returnsQuery = useQuery({
    queryKey: [queryKeys.returns, filters],
    queryFn: () => returnsApi.getReturns(filters),
    placeholderData: (previousData) => previousData,
    staleTime: queryStaleTimeMap[queryKeys.returns] || 300000, // 5 minutes default
  });

  const hasActiveFilters = () => {
    return (
      filters.search ||
      filters.date_from ||
      filters.date_to ||
      filters.branch_id ||
      filters.original_sale_id
    );
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
    });
  };

  const handlePreviewPdf = (id: number, returnNumber: string) =>
    preview(() => returnsApi.downloadReturnPdf(id), {
      title: `Return ${returnNumber}`,
      fileName: `return-${returnNumber}.pdf`,
    });

  const columns = [
    {
      title: "Return #",
      dataIndex: "return_number",
      key: "return_number",
      render: (text: string, record: Return) => (
        <Link to={`/returns/view/${record.id}`}>{text}</Link>
      ),
    },
    {
      title: "Original Sale",
      key: "original_sale",
      render: (record: Return) => (
        <div>
          <Link to={`/sales/view/${record.original_sale_id}`}>
            {record.original_sale?.sale_number ||
              `Sale #${record.original_sale_id}`}
          </Link>
          {record.original_sale?.customer_name && (
            <div>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {record.original_sale.customer_name}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (record: Return) =>
        record.branch?.name || record.branch_name || "N/A",
    },
    {
      title: "Exchange Sale",
      key: "exchange_sale",
      render: (record: Return) => record.exchange_sale?.sale_number || "-",
    },
    {
      title: "Return Date",
      dataIndex: "return_date",
      key: "return_date",
      render: (date: string) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Items Count",
      key: "items_count",
      render: (record: Return) => record.items?.length || 0,
    },
    {
      title: "Total Refund",
      dataIndex: "total_refund",
      key: "total_refund",
      render: (amount: number) => <Money value={amount} />,
    },
    {
      title: "Total Exchange",
      dataIndex: "total_exchange",
      key: "total_exchange",
      render: (amount: number) => <Money value={amount} />,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason: string) => reason || "-",
      ellipsis: true,
    },
    {
      title: "Processed By",
      key: "user",
      render: (record: Return) =>
        record.user?.name || record.user_name || "N/A",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: Return) => (
        <Space>
          <Tooltip title="Preview PDF Receipt">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={() =>
                handlePreviewPdf(record.id!, record.return_number!)
              }
            />
          </Tooltip>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/returns/view/${record.id}`)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      {setPageTitle("Returns Management")}
      <PageTitle
        title="Returns Management"
        breadcrumbs={[{ title: "Dashboard", href: "/" }, { title: "Returns" }]}
      />

      {/* Summary Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total Returns"
              value={
                returnsQuery.data?.summary?.total_returns ??
                returnsQuery.data?.total ??
                0
              }
              loading={returnsQuery.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total Refunded"
              value={
                returnsQuery.data?.summary?.total_refund ??
                returnsQuery.data?.data?.reduce(
                  (sum, ret) => sum + Number(ret.total_refund || 0),
                  0,
                ) ??
                0
              }
              precision={2}
              prefix={takaPrefix}
              valueStyle={
                (returnsQuery.data?.summary?.total_refund || 0) > 0
                  ? { color: "#cf1322" }
                  : undefined
              }
              loading={returnsQuery.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total Exchanged"
              value={
                returnsQuery.data?.summary?.total_exchange ??
                returnsQuery.data?.data?.reduce(
                  (sum, ret) => sum + Number(ret.total_exchange || 0),
                  0,
                ) ??
                0
              }
              precision={2}
              prefix={takaPrefix}
              valueStyle={
                (returnsQuery.data?.summary?.total_exchange || 0) > 0
                  ? { color: "#1677ff" }
                  : undefined
              }
              loading={returnsQuery.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="This Month"
              value={
                returnsQuery.data?.summary?.this_month_count ??
                returnsQuery.data?.data?.filter((ret) =>
                  dayjs(ret.return_date).isAfter(dayjs().startOf("month")),
                ).length ??
                0
              }
              loading={returnsQuery.isLoading}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Search by return # or sale #..."
              prefix={<SearchOutlined />}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <Select
              placeholder="Select branch"
              style={{ width: "100%" }}
              value={filters.branch_id}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, branch_id: value, page: 1 }))
              }
              allowClear
            >
              {user?.branches?.map((branch: any) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <RangePicker
              style={{ width: "100%" }}
              value={
                filters.date_from && filters.date_to
                  ? [dayjs(filters.date_from), dayjs(filters.date_to)]
                  : null
              }
              onChange={(dates) => {
                if (dates) {
                  setFilters((prev) => ({
                    ...prev,
                    date_from: dates[0]?.format("YYYY-MM-DD"),
                    date_to: dates[1]?.format("YYYY-MM-DD"),
                    page: 1,
                  }));
                } else {
                  setFilters((prev) => ({
                    ...prev,
                    date_from: undefined,
                    date_to: undefined,
                    page: 1,
                  }));
                }
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/returns/new")}
              style={{ width: "100%" }}
            >
              Create Return
            </Button>
          </Col>
          {hasActiveFilters() && (
            <Col xs={24} sm={12} md={8} lg={4}>
              <Button onClick={clearFilters} style={{ width: "100%" }}>
                Clear Filters
              </Button>
            </Col>
          )}
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={returnsQuery.data?.data || []}
          loading={returnsQuery.isLoading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: returnsQuery.data?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} returns`,
            onChange: (page, limit) =>
              setFilters((prev) => ({ ...prev, page, limit })),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <PdfPreviewModal {...previewProps} />
    </div>
  );
};

export default ReturnsTable;
