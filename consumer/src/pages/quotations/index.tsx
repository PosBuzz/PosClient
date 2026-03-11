import {
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
  CopyOutlined,
  FilePdfOutlined,
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
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import type { Sale, SaleListFilters } from "../../types/sale.types";
import saveAs from "file-saver";
import { setPageTitle } from "../../utils/setPageTitle";
import { useMessageStore } from "../../stores/messageStore";

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const QuotationsTable = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();

  const [filters, setFilters] = useState<SaleListFilters>({
    page: 1,
    limit: 20,
    search: "",
  });

  // Use real API query with optimized caching
  const quotationsQuery = useQuery({
    queryKey: [queryKeys.quotations, filters],
    queryFn: () => salesApi.getQuotations(filters),
    placeholderData: (previousData) => previousData,
    staleTime: queryStaleTimeMap[queryKeys.quotations],
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    }, 300),
    [],
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = (value: string) => {
    debouncedSearch(value);
  };

  const hasActiveFilters = () => {
    return (
      filters.search ||
      filters.date_from ||
      filters.date_to ||
      filters.branch_id ||
      filters.source
    );
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      search: "",
    });
  };

  const handleDownloadPdf = async (id: number, saleNumber: string) => {
    try {
      // Call the API to generate and download PDF (similar to admin billing approach)
      const pdfBlob = await salesApi.downloadQuotationPdf(id);

      // Get the filename - you could also get this from response headers if backend sets it
      const filename = `${saleNumber}.pdf`;

      // Use file-saver to download the PDF
      saveAs(pdfBlob, filename);

      messageApi?.success("PDF receipt downloaded successfully!");
    } catch (error: any) {
      console.error("PDF download error:", error);
      messageApi?.error("Failed to download PDF receipt");
    }
  };


  const columns = [
    {
      title: "Quotation #",
      dataIndex: "sale_number",
      key: "sale_number",
      render: (text: string, record: Sale) => (
        <Link to={`/quotations/view/${record.id}`}>
          <Text strong>{text}</Text>
        </Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      render: (date: string) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Customer",
      key: "customer",
      render: (record: Sale) =>
        record.customer_name || record.customer?.name || "Walk-in",
    },
    {
      title: "Branch",
      dataIndex: ["branch", "name"],
      key: "branch",
    },
    {
      title: "Price Type",
      dataIndex: "price_type",
      key: "price_type",
      render: (price_type: string) => (
        <Tag color={price_type === "wholesale" ? "blue" : "default"}>
          {price_type === "wholesale" ? "Wholesale" : "Regular"}
        </Tag>
      ),
    },
    {
      title: "Total Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      render: (amount: number) => `$${Number(amount || 0).toFixed(2)}`,
    },
    {
      title: "Status",
      key: "status",
      render: (record: Sale) => {
        if (record.converted_to_sale_id) {
          return <Tag color="success">Converted</Tag>;
        }
        return <Tag color="default">Pending</Tag>;
      },
    },
    {
      title: "Created By",
      dataIndex: ["user", "name"],
      key: "user",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: Sale) => (
        <Space>
          <Tooltip title="View Quotation">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/quotations/view/${record.id}`)}
            />
          </Tooltip>
          <Tooltip
            title={
              record.converted_to_sale_id
                ? "Already Converted"
                : "Convert to Sale"
            }
          >
            <Button
              type="text"
              icon={<SwapOutlined />}
              disabled={!!record.converted_to_sale_id}
              onClick={() => navigate(`/sales/new?quotation_id=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Copy Quotation">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => navigate(`/add-quotation?copy_from=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Download PDF Receipt">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={() => handleDownloadPdf(record.id!, record.sale_number)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const data = quotationsQuery.data?.data || [];
  const meta = quotationsQuery.data?.meta;
  const summary = quotationsQuery.data?.summary;

  return (
    <div>
      {setPageTitle("Quotations")}
      <PageTitle
        title="Quotations"
        breadcrumbs={[{ title: "Home", href: "/" }, { title: "Quotations" }]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/add-quotation")}
          >
            New Quotation
          </Button>
        }
      />

      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Quotations"
                value={summary.total_sales || 0}
                valueStyle={{ color: "#3f8600" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Value"
                value={Number(summary.total_amount || 0).toFixed(2)}
                prefix="$"
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Average Value"
                value={Number(summary.average_sale || 0).toFixed(2)}
                prefix="$"
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={4}>
            <Input
              placeholder="Search by quotation number, customer..."
              prefix={<SearchOutlined />}
              onChange={(e) => handleSearch(e.target.value)}
              defaultValue={filters.search}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Filter by branch"
              style={{ width: "100%" }}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, branch_id: value, page: 1 }))
              }
              value={filters.branch_id}
              allowClear
            >
              {user?.branches?.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Filter by status"
              style={{ width: "100%" }}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, source: value, page: 1 }))
              }
              value={filters.source}
              allowClear
            >
              <Option value="pending">Pending</Option>
              <Option value="converted">Converted</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <RangePicker
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
              onChange={(dates) => {
                if (dates) {
                  setFilters((prev) => ({
                    ...prev,
                    date_from: dates[0]?.format("YYYY-MM-DD"),
                    date_to: dates[1]?.format("YYYY-MM-DD"),
                    page: 1,
                  }));
                } else {
                  setFilters((prev) => {
                    const newFilters = { ...prev };
                    delete newFilters.date_from;
                    delete newFilters.date_to;
                    return { ...newFilters, page: 1 };
                  });
                }
              }}
            />
          </Col>
        </Row>

        {hasActiveFilters() && (
          <div style={{ marginBottom: 16 }}>
            <Button size="small" onClick={clearFilters}>
              Clear All Filters
            </Button>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={quotationsQuery.isLoading}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: meta?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} quotations`,
            onChange: (page, pageSize) => {
              setFilters((prev) => ({ ...prev, page, limit: pageSize }));
            },
          }}
        />
      </Card>
    </div>
  );
};

export default QuotationsTable;
