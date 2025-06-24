 import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  DatePicker,
  Statistic,
} from "antd";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saleApi } from "../../api/sale-api";
import PageTitle from "../../components/PageTitle";
import { Permissions } from "../../constants/permissions";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import type {
  Sale,
  SaleListFilters,
  PaymentMethod,
  PaymentStatus,
} from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text } = Typography;

// Dummy data for development
const dummySales: Sale[] = [
  {
    id: 1,
    sale_number: "SAL-2025-001",
    customer_name: "John Doe",
    customer_phone: "+1234567890",
    customer_email: "john@example.com",
    branch_id: 1,
    branch_name: "Main Branch",
    user_id: 1,
    user_name: "Admin User",
    sale_date: "2025-06-25T10:30:00Z",
    subtotal: 150.00,
    discount_amount: 15.00,
    tax_amount: 13.50,
    total_amount: 148.50,
    payment_method: "cash" as PaymentMethod,
    payment_status: "paid" as PaymentStatus,
    notes: "Customer paid in cash",
    items: [
      {
        id: 1,
        variant_id: 1,
        variant_name: "iPhone 14 - 128GB Black",
        variant_sku: "IP14-128-BLK",
        quantity: 1,
        unit_price: 150.00,
        discount_amount: 15.00,
        tax_amount: 13.50,
        line_total: 148.50,
        product_name: "iPhone 14",
        regular_price: 150.00,
        wholesale_price: 130.00,
        image: "https://via.placeholder.com/100",
        available_stock: 10,
      },
    ],
    created_at: "2025-06-25T10:30:00Z",
    updated_at: "2025-06-25T10:30:00Z",
  },
  {
    id: 2,
    sale_number: "SAL-2025-002",
    customer_name: "Jane Smith",
    customer_phone: "+1234567891",
    branch_id: 1,
    branch_name: "Main Branch",
    user_id: 1,
    user_name: "Admin User",
    sale_date: "2025-06-25T14:15:00Z",
    subtotal: 75.00,
    discount_amount: 0.00,
    tax_amount: 11.25,
    total_amount: 86.25,
    payment_method: "card" as PaymentMethod,
    payment_status: "paid" as PaymentStatus,
    items: [
      {
        id: 2,
        variant_id: 2,
        variant_name: "Samsung Galaxy S24 - 256GB White",
        variant_sku: "SGS24-256-WHT",
        quantity: 1,
        unit_price: 75.00,
        discount_amount: 0.00,
        tax_amount: 11.25,
        line_total: 86.25,
        product_name: "Samsung Galaxy S24",
        regular_price: 75.00,
        wholesale_price: 65.00,
        image: "https://via.placeholder.com/100",
        available_stock: 8,
      },
    ],
    created_at: "2025-06-25T14:15:00Z",
    updated_at: "2025-06-25T14:15:00Z",
  },
  {
    id: 3,
    sale_number: "SAL-2025-003",
    customer_name: "Bob Johnson",
    customer_phone: "+1234567892",
    branch_id: 2,
    branch_name: "Branch 2",
    user_id: 2,
    user_name: "Sales User",
    sale_date: "2025-06-24T16:45:00Z",
    subtotal: 200.00,
    discount_amount: 20.00,
    tax_amount: 18.00,
    total_amount: 198.00,
    payment_method: "bank_transfer" as PaymentMethod,
    payment_status: "pending" as PaymentStatus,
    notes: "Awaiting bank transfer confirmation",
    items: [
      {
        id: 3,
        variant_id: 3,
        variant_name: "MacBook Air M2 - 512GB Silver",
        variant_sku: "MBA-M2-512-SLV",
        quantity: 1,
        unit_price: 200.00,
        discount_amount: 20.00,
        tax_amount: 18.00,
        line_total: 198.00,
        product_name: "MacBook Air M2",
        regular_price: 200.00,
        wholesale_price: 180.00,
        image: "https://via.placeholder.com/100",
        available_stock: 5,
      },
    ],
    created_at: "2025-06-24T16:45:00Z",
    updated_at: "2025-06-24T16:45:00Z",
  },
];

const SalesTable = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const showMessage = (content: string, type: "success" | "error" | "info" = "info") => {
    messageApi?.[type](content);
  };

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission);
  };

  const [filters, setFilters] = useState<SaleListFilters>({
    page: 1,
    limit: 20,
    search: "",
  });

  // For development, use dummy data
  const salesQuery = {
    data: {
      data: dummySales,
      meta: {
        total: dummySales.length,
        page: 1,
        limit: 20,
        total_pages: 1,
      },
      summary: {
        total_sales: dummySales.length,
        total_amount: dummySales.reduce((sum, sale) => sum + sale.total_amount, 0),
        average_sale: dummySales.reduce((sum, sale) => sum + sale.total_amount, 0) / dummySales.length,
      },
    },
    isLoading: false,
    error: null,
  };

  const deleteMutation = useMutation({
    mutationFn: saleApi.deleteSale,
    onSuccess: () => {
      showMessage("Sale deleted successfully", "success");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error: any) => {
      showMessage(error.response?.data?.message || "Failed to delete sale", "error");
    },
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    }, 300),
    []
  );

  const handleSearch = (value: string) => {
    debouncedSearch(value);
  };

  const handlePrint = async (saleId: number) => {
    try {
      // For development, just show a message
      showMessage("Receipt generation will be implemented with backend", "info");
    } catch (error) {
      showMessage("Failed to generate receipt", "error");
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    const colors = {
      paid: "success",
      pending: "warning",
      partial: "processing",
      cancelled: "error",
    };
    return colors[status] || "default";
  };

  const getPaymentMethodDisplay = (method: PaymentMethod) => {
    const displays = {
      cash: "Cash",
      card: "Card",
      bank_transfer: "Bank Transfer",
      mobile_money: "Mobile Money",
      credit: "Credit",
    };
    return displays[method] || method;
  };

  const columns = [
    {
      title: "Sale #",
      dataIndex: "sale_number",
      key: "sale_number",
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
      dataIndex: "branch_name",
      key: "branch_name",
    },
    {
      title: "Sale Date",
      dataIndex: "sale_date",
      key: "sale_date",
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
      render: (amount: number) => `$${amount.toFixed(2)}`,
    },
    {
      title: "Payment",
      key: "payment",
      render: (record: Sale) => (
        <div>
          <Tag color={getPaymentStatusColor(record.payment_status)}>
            {record.payment_status.toUpperCase()}
          </Tag>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {getPaymentMethodDisplay(record.payment_method)}
          </div>
        </div>
      ),
    },
    {
      title: "Sold By",
      dataIndex: "user_name",
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
          {hasPermission(Permissions.edit_sale) && (
            <Tooltip title="Edit Sale">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => navigate(`/sales/edit/${record.id}`)}
              />
            </Tooltip>
          )}
          {hasPermission(Permissions.delete_sale) && (
            <Popconfirm
              title="Are you sure you want to delete this sale?"
              onConfirm={() => deleteMutation.mutate(record.id!)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete Sale">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
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
        title="Sales"        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales" },
        ]}        rightSection={
          hasPermission(Permissions.add_sale) ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/sales/add")}
            >
              New Sale
            </Button>
          ) : undefined
        }
      />

      {/* Sales Summary Cards */}
      {salesQuery.data?.summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Sales"
                value={salesQuery.data.summary.total_sales}
                suffix="transactions"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Amount"
                value={salesQuery.data.summary.total_amount}
                prefix="$"
                precision={2}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Average Sale"
                value={salesQuery.data.summary.average_sale}
                prefix="$"
                precision={2}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="Search sales..."
              prefix={<SearchOutlined />}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="Payment Status"
              style={{ width: "100%" }}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, payment_status: value, page: 1 }))
              }
              allowClear
            >
              <Option value="paid">Paid</Option>
              <Option value="pending">Pending</Option>
              <Option value="partial">Partial</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="Payment Method"
              style={{ width: "100%" }}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, payment_method: value, page: 1 }))
              }
              allowClear
            >
              <Option value="cash">Cash</Option>
              <Option value="card">Card</Option>
              <Option value="bank_transfer">Bank Transfer</Option>
              <Option value="mobile_money">Mobile Money</Option>
              <Option value="credit">Credit</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button icon={<FilterOutlined />} style={{ width: "100%" }}>
              More Filters
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={salesQuery.data?.data || []}
          loading={salesQuery.isLoading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: salesQuery.data?.meta.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} sales`,
            onChange: (page, pageSize) =>
              setFilters((prev) => ({ ...prev, page, limit: pageSize })),
          }}
        />
      </Card>
    </div>
  );
};

export default SalesTable;
