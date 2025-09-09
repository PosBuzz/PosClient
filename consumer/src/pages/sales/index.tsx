import {
  EyeOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
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
  Typography
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import saveAs from "file-saver";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import type {
  PaymentMethod,
  Sale,
  SaleListFilters,
} from "../../types/sale.types";
import {
  PaymentStatus,
} from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const SalesTable = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();

  const showMessage = (
    content: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    messageApi?.[type](content);
  };

  const [filters, setFilters] = useState<SaleListFilters>({
    page: 1,
    limit: 20,
    search: "",
  });

  // Use real API query with optimized caching
  const salesQuery = useQuery({
    queryKey: [queryKeys.sales, filters],
    queryFn: () => salesApi.getSales(filters),
    placeholderData: (previousData) => previousData,
    staleTime: queryStaleTimeMap[queryKeys.sales],
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    }, 300),
    []
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
      filters.payment_status ||
      filters.payment_method ||
      filters.date_from ||
      filters.date_to ||
      filters.branch_id
    );
  };

  const handlePrint = async (saleId: number) => {
    try {
      showMessage("Preparing receipt for printing...", "info");
      
      // Get sale data first
      const sale = await salesApi.getSale(saleId);
      
      if (!sale) {
        showMessage("Failed to load sale data", "error");
        return;
      }

      // Format payment methods
      const paymentMethods = sale.payments && sale.payments.length > 0 
        ? sale.payments.map((payment: any) => {
            const methods = {
              CASH: "Cash",
              CARD: "Card", 
              BANK_TRANSFER: "Bank Transfer",
              CHEQUE: "Cheque",
              MOBILE_MONEY: "Mobile Money",
              MFS: "MFS",
              DEPOSIT: "Deposit",
              CREDIT: "Credit",
            };
            return methods[payment.payment_method as keyof typeof methods] || payment.payment_method;
          }).join(", ")
        : "Cash";

      // Calculate correct total using database values
      const correctTotal = Number(sale?.total_amount) || 0;

      // Format receipt data according to the required structure
      const receiptData = {
        receiptNumber: sale.sale_number,
        date: dayjs(sale.sale_date).format("YYYY-MM-DD"),
        time: dayjs(sale.sale_date).format("HH:mm:ss"),
        cashier: sale.user_name || "Staff",
        customer: sale.customer_name || "Walk-in Customer",
        items: sale.items?.map((item: any) => ({
          name: `${item.variant?.product?.name || 'Product'} - ${item.variant?.name || ''}`.trim(),
          quantity: Number(item.quantity) || 0,
          price: Number(item.unit_price) || 0,
          total: Number(item.line_total) || 0
        })) || [],
        subtotal: Number(sale?.subtotal) || 0,
        discount: Number(sale?.discount_amount) || 0,
        shipping: Number(sale?.shipping_cost) || 0,
        tax: Number(sale?.tax_amount) || 0,
        total: correctTotal,
        amountPaid: Number(sale?.received_amount) || 0,
        change: Math.max(0, (Number(sale?.received_amount) || 0) - correctTotal),
        paymentMethod: paymentMethods
      };

      showMessage("Sending to printer...", "info");

      // Send direct request to localhost:8080/print
      const response = await fetch('http://localhost:8080/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receiptData)
      });

      if (response.ok) {
        await response.json(); // Parse response for completeness
        showMessage("Receipt printed successfully!", "success");
      } else {
        const errorText = await response.text();
        showMessage("Failed to print receipt: " + errorText, "error");
      }
    } catch (error: any) {
      console.error('Print error:', error);
      if (error.message.includes('fetch')) {
        showMessage("Printing agent is not running. Please start the printing agent on your computer and try again.", "error");
      } else {
        showMessage("Failed to print receipt. Please check your connection.", "error");
      }
    }
  };

  const handleDownloadPdf = async (saleId: number, saleNumber: string ) => {
    try {
      
      // Call the API to generate and download PDF (similar to admin billing approach)
      const pdfBlob = await salesApi.generateReceipt(saleId);
      
      // Get the filename - you could also get this from response headers if backend sets it
      const filename = `${saleNumber}.pdf`;

      // Use file-saver to download the PDF
      saveAs(pdfBlob, filename);
      
      showMessage("PDF receipt downloaded successfully!", "success");
    } catch (error: any) {
      console.error('PDF download error:', error);
      showMessage("Failed to download PDF receipt", "error");
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    const colors = {
      paid: "success",
      partial: "processing",
      due: "warning",
      cancelled: "error",
    };
    return colors[status] || "default";
  };

  // Use database payment status - backend now calculates correctly
  const getActualPaymentStatus = (sale: Sale) => {
    // Use the database payment_status directly since backend calculates it correctly now
    return sale.payment_status || PaymentStatus.DUE;
  };

  // Use database total amount - backend now calculates correctly
  const getCorrectTotal = (sale: Sale) => {
    // Use the database total_amount directly since backend calculates it correctly now
    return Number(sale?.total_amount) || 0;
  };

  const getPaymentMethodDisplay = (method: PaymentMethod) => {
    const displays = {
      CASH: "Cash",
      CARD: "Card",
      BANK_TRANSFER: "Bank Transfer",
      CHEQUE: "Cheque",
      MOBILE_MONEY: "Mobile Money",
      MFS: "MFS",
      DEPOSIT: "Deposit",
      CREDIT: "Credit",
    };
    return displays[method] || method;
  };

  const columns = [
    {
      title: "Sale #",
      dataIndex: "sale_number",
      key: "sale_number",
      sorter: true,
      render: (text: string, record: Sale) => (
        <Link to={`/sales/view/${record.id}`}>{text}</Link>
      ),
    },
    {
      title: "Customer",
      key: "customer",
      render: (record: Sale) => (
        <div>
          <div>{record.customer_name || "Walk-in Customer"}</div>
          {record.customer_phone && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.customer_phone}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (record: Sale) =>
        record.branch?.name || record.branch_name || "N/A",
    },
    {
      title: "Sale Date",
      dataIndex: "sale_date",
      key: "sale_date",
      sorter: true,
      render: (date: string) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Items",
      key: "items_count",
      render: (record: Sale) => record.items?.length || 0,
    },
    {
      title: "Total Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      sorter: true,
      render: (amount: number, record: Sale) => {
        // Use corrected total calculation instead of backend total
        const correctTotal = getCorrectTotal(record);
        return `$${correctTotal.toFixed(2)}`;
      },
    },
    {
      title: "Payment",
      key: "payment",
      render: (record: Sale) => {
        const actualStatus = getActualPaymentStatus(record);
        return (
          <div>
            <Tag color={getPaymentStatusColor(actualStatus)}>
              {actualStatus.toUpperCase()}
            </Tag>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {record.payments && record.payments.length > 0
                ? record.payments.length === 1
                  ? getPaymentMethodDisplay(record.payments[0].payment_method)
                  : `${record.payments.length} methods`
                : "N/A"}
            </div>
          </div>
        );
      },
    },
    {
      title: "Sold By",
      dataIndex: ["user", "name"],
      key: "user_name",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: Sale) => (
        <Space size="small">
          <Tooltip title="View Sale">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/sales/view/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Print Receipt">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint(record.id!)}
            />
          </Tooltip>
          <Tooltip title="Download PDF Receipt">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={() => handleDownloadPdf(record.id!, record.sale_number)}
            />
          </Tooltip>
          {/* <Tooltip title="Edit Sale">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/sales/edit/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this sale?"
            onConfirm={() => deleteMutation.mutate(record.id!)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Sale">
              <Button type="text" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm> */}
        </Space>
      ),
    },
  ];

  useEffect(() => {
    setPageTitle("Sales");
  }, []);

  return (
    <div>
      <PageTitle
        title="Sales"
        breadcrumbs={[{ title: "Home", href: "/" }, { title: "Sales" }]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/sales/new")}
          >
            New Sale
          </Button>
        }
      />

      {/* Sales Summary Cards */}
      {salesQuery.data?.summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Sales"
                value={salesQuery.data.summary.total_sales}
                suffix="transactions"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Amount"
                value={salesQuery.data.summary.total_amount}
                prefix="$"
                precision={2}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Average Sale"
                value={salesQuery.data.summary.average_sale}
                prefix="$"
                precision={2}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Period"
                value={
                  filters.date_from && filters.date_to
                    ? `${dayjs(filters.date_from).format("MMM DD")} - ${dayjs(
                        filters.date_to
                      ).format("MMM DD")}`
                    : "All Time"
                }
                style={{ fontSize: 12 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={5}>
            <Input
              placeholder="Search sales..."
              prefix={<SearchOutlined />}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={5}>
            <RangePicker
              style={{ width: "100%" }}
              value={
                filters.date_from && filters.date_to
                  ? [dayjs(filters.date_from), dayjs(filters.date_to)]
                  : null
              }
              onChange={(dates) => {
                setFilters((prev) => ({
                  ...prev,
                  date_from: dates?.[0]?.startOf("day").toISOString(),
                  date_to: dates?.[1]?.endOf("day").toISOString(),
                  page: 1,
                }));
              }}
              placeholder={["Start Date", "End Date"]}
              allowClear
              presets={[
                {
                  label: "Today",
                  value: [dayjs().startOf("day"), dayjs().endOf("day")],
                },
                {
                  label: "Yesterday",
                  value: [
                    dayjs().subtract(1, "day").startOf("day"),
                    dayjs().subtract(1, "day").endOf("day"),
                  ],
                },
                {
                  label: "This Week",
                  value: [dayjs().startOf("week"), dayjs().endOf("week")],
                },
                {
                  label: "Last Week",
                  value: [
                    dayjs().subtract(1, "week").startOf("week"),
                    dayjs().subtract(1, "week").endOf("week"),
                  ],
                },
                {
                  label: "This Month",
                  value: [dayjs().startOf("month"), dayjs().endOf("month")],
                },
                {
                  label: "Last Month",
                  value: [
                    dayjs().subtract(1, "month").startOf("month"),
                    dayjs().subtract(1, "month").endOf("month"),
                  ],
                },
                {
                  label: "Last 30 Days",
                  value: [dayjs().subtract(30, "day"), dayjs()],
                },
                {
                  label: "Last 90 Days",
                  value: [dayjs().subtract(90, "day"), dayjs()],
                },
              ]}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Payment Status"
              style={{ width: "100%" }}
              value={filters.payment_status}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  payment_status: value,
                  page: 1,
                }))
              }
              allowClear
            >
              <Option value="paid">Paid</Option>
              <Option value="partial">Partial</Option>
              <Option value="due">Due</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Payment Method"
              style={{ width: "100%" }}
              value={filters.payment_method}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  payment_method: value,
                  page: 1,
                }))
              }
              allowClear
            >
              <Option value="CASH">Cash</Option>
              <Option value="CARD">Card</Option>
              <Option value="BANK_TRANSFER">Bank Transfer</Option>
              <Option value="CHEQUE">Cheque</Option>
              <Option value="MOBILE_MONEY">Mobile Money</Option>
              <Option value="MFS">MFS</Option>
              <Option value="DEPOSIT">Deposit</Option>
              <Option value="CREDIT">Credit</Option>
            </Select>
          </Col>
          <Col span={3}>
            <Select
              placeholder="Branch"
              value={filters.branch_id}
              style={{ width: "100%" }}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  branch_id: value,
                  page: 1,
                }))
              }
              allowClear
            >
              {user?.branches?.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={2}>
            <Button
              onClick={() => {
                setFilters({
                  page: 1,
                  limit: 20,
                  search: "",
                });
              }}
              disabled={!hasActiveFilters()}
            >
              Clear
            </Button>
          </Col>
        </Row>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <Row style={{ marginBottom: 16 }}>
            <Col span={24}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                <Text strong>Active Filters: </Text>
                {filters.search && (
                  <Tag
                    closable
                    onClose={() => {
                      setFilters((prev) => ({ ...prev, search: "" }));
                    }}
                  >
                    Search: {filters.search}
                  </Tag>
                )}
                {filters.payment_status && (
                  <Tag
                    closable
                    onClose={() =>
                      setFilters((prev) => ({
                        ...prev,
                        payment_status: undefined,
                      }))
                    }
                  >
                    Status: {filters.payment_status}
                  </Tag>
                )}
                {filters.payment_method && (
                  <Tag
                    closable
                    onClose={() =>
                      setFilters((prev) => ({
                        ...prev,
                        payment_method: undefined,
                      }))
                    }
                  >
                    Method: {filters.payment_method}
                  </Tag>
                )}
                {filters.date_from && filters.date_to && (
                  <Tag
                    closable
                    onClose={() =>
                      setFilters((prev) => ({
                        ...prev,
                        date_from: undefined,
                        date_to: undefined,
                      }))
                    }
                  >
                    Date: {dayjs(filters.date_from).format("MMM DD")} -{" "}
                    {dayjs(filters.date_to).format("MMM DD, YYYY")}
                  </Tag>
                )}
                {filters.branch_id && (
                  <Tag
                    closable
                    onClose={() =>
                      setFilters((prev) => ({ ...prev, branch_id: undefined }))
                    }
                  >
                    Branch:{" "}
                    {
                      user?.branches.find(
                        (branch) => branch.id === filters.branch_id
                      )?.name
                    }
                  </Tag>
                )}
              </div>
            </Col>
          </Row>
        )}

        <Table
          columns={columns}
          dataSource={salesQuery.data?.data || []}
          loading={salesQuery.isLoading}
          rowKey="id"
          onChange={(pagination, _filters, sorter) => {
            // Handle pagination
            const newPage = pagination.current || 1;
            const newLimit = pagination.pageSize || 20;

            if (newPage !== filters.page || newLimit !== filters.limit) {
              setFilters((prev) => ({
                ...prev,
                page: newPage,
                limit: newLimit,
              }));
            }

            // Handle sorting
            if (sorter && !Array.isArray(sorter)) {
              const sortField = sorter.field as string;
              const sortOrder =
                sorter.order === "ascend"
                  ? "asc"
                  : sorter.order === "descend"
                  ? "desc"
                  : undefined;

              setFilters((prev) => ({
                ...prev,
                sort_by: sortOrder ? sortField : "created_at",
                sort_order: sortOrder || "desc",
                page: 1, // Reset to first page when sorting
              }));
            }
          }}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: salesQuery.data?.meta.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} sales`,
          }}
        />
      </Card>
    </div>
  );
};

export default SalesTable;
