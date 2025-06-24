import {
  PrinterOutlined,
  EditOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Divider,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageTitle from "../../components/PageTitle";
import { Permissions } from "../../constants/permissions";
import { useAuthStore } from "../../stores/authStore";
import { setPageTitle } from "../../utils/setPageTitle";
import type { Sale, SaleItem, PaymentMethod, PaymentStatus } from "../../types/sale.types";

const { Title, Text } = Typography;

// Dummy sale data
const dummySale: Sale = {
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
      image: "https://via.placeholder.com/60",
      available_stock: 10,
    },
  ],
  created_at: "2025-06-25T10:30:00Z",
  updated_at: "2025-06-25T10:30:00Z",
};

const ViewSale = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission);
  };

  useEffect(() => {
    // For development, use dummy data
    setTimeout(() => {
      setSale(dummySale);
      setLoading(false);
      setPageTitle(`Sale ${dummySale.sale_number}`);
    }, 500);
  }, [id]);

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

  const handlePrint = () => {
    // For development, just show a message
    console.log("Print receipt for sale:", sale?.id);
  };

  const columns = [
    {
      title: "Product",
      key: "product",
      render: (record: SaleItem) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {record.image && (
            <img
              src={record.image}
              alt={record.variant_name}
              style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{record.product_name}</div>
            <Text type="secondary">{record.variant_name}</Text>
            {record.variant_sku && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  SKU: {record.variant_sku}
                </Text>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Unit Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => `$${price.toFixed(2)}`,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Discount",
      dataIndex: "discount_amount",
      key: "discount_amount",
      render: (amount: number) => amount ? `-$${amount.toFixed(2)}` : "-",
    },
    {
      title: "Tax",
      dataIndex: "tax_amount",
      key: "tax_amount",
      render: (amount: number) => amount ? `$${amount.toFixed(2)}` : "-",
    },
    {
      title: "Line Total",
      dataIndex: "line_total",
      key: "line_total",
      render: (total: number) => `$${total.toFixed(2)}`,
    },
  ];

  if (loading) {
    return (
      <div>
        <PageTitle
          title="Loading..."
          breadcrumbs={[
            { title: "Home", href: "/" },
            { title: "Sales", href: "/sales" },
            { title: "View Sale" },
          ]}
        />
        <Card loading={true} />
      </div>
    );
  }

  if (!sale) {
    return (
      <div>
        <PageTitle
          title="Sale Not Found"
          breadcrumbs={[
            { title: "Home", href: "/" },
            { title: "Sales", href: "/sales" },
            { title: "View Sale" },
          ]}
        />
        <Card>
          <div style={{ textAlign: "center", padding: 40 }}>
            <Title level={4}>Sale not found</Title>
            <Button type="primary" onClick={() => navigate("/sales")}>
              Back to Sales
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title={`Sale ${sale.sale_number}`}
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: "View Sale" },
        ]}
        rightSection={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/sales")}
            >
              Back to Sales
            </Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={handlePrint}
            >
              Print Receipt
            </Button>
            {hasPermission(Permissions.edit_sale) && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/sales/edit/${sale.id}`)}
              >
                Edit Sale
              </Button>
            )}
          </Space>
        }
      />

      <Row gutter={24}>
        <Col span={16}>
          {/* Sale Items */}
          <Card title="Sale Items" style={{ marginBottom: 24 }}>
            <Table
              columns={columns}
              dataSource={sale.items}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </Col>

        <Col span={8}>
          {/* Sale Information */}
          <Card title="Sale Information" style={{ marginBottom: 24 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Sale Number">
                {sale.sale_number}
              </Descriptions.Item>
              <Descriptions.Item label="Sale Date">
                {dayjs(sale.sale_date).format("MMM DD, YYYY HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {sale.branch_name}
              </Descriptions.Item>
              <Descriptions.Item label="Sold By">
                {sale.user_name}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Method">
                {getPaymentMethodDisplay(sale.payment_method)}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag color={getPaymentStatusColor(sale.payment_status)}>
                  {sale.payment_status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Customer Information */}
          {(sale.customer_name || sale.customer_phone || sale.customer_email) && (
            <Card title="Customer Information" style={{ marginBottom: 24 }}>
              <Descriptions column={1} size="small">
                {sale.customer_name && (
                  <Descriptions.Item label="Name">
                    {sale.customer_name}
                  </Descriptions.Item>
                )}
                {sale.customer_phone && (
                  <Descriptions.Item label="Phone">
                    {sale.customer_phone}
                  </Descriptions.Item>
                )}
                {sale.customer_email && (
                  <Descriptions.Item label="Email">
                    {sale.customer_email}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}

          {/* Sale Summary */}
          <Card title="Sale Summary">
            <div style={{ padding: "0 8px" }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <Text>Subtotal:</Text>
                <Text>${sale.subtotal.toFixed(2)}</Text>
              </Row>
              
              {sale.discount_amount > 0 && (
                <Row justify="space-between" style={{ marginBottom: 8 }}>
                  <Text>Discount:</Text>
                  <Text style={{ color: "#ff4d4f" }}>-${sale.discount_amount.toFixed(2)}</Text>
                </Row>
              )}
              
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <Text>Tax:</Text>
                <Text>${sale.tax_amount.toFixed(2)}</Text>
              </Row>
              
              <Divider style={{ margin: "12px 0" }} />
              
              <Row justify="space-between">
                <Title level={4} style={{ margin: 0 }}>
                  Total:
                </Title>
                <Title level={4} style={{ margin: 0, color: "#1890ff" }}>
                  ${sale.total_amount.toFixed(2)}
                </Title>
              </Row>
            </div>

            {sale.notes && (
              <>
                <Divider style={{ margin: "16px 0" }} />
                <div>
                  <Text strong>Notes:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text>{sale.notes}</Text>
                  </div>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ViewSale;
