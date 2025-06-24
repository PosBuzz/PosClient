import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Table,
  Typography,
  Space,
  Divider,
  message,
} from "antd";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";
import type {
  SaleFormData,
  SaleItem,
  ProductVariantForSale,
} from "../../types/sale.types";

const { Option } = Select;
const { Text, Title } = Typography;

// Dummy product variants data
const dummyVariants: ProductVariantForSale[] = [
  {
    id: 1,
    name: "iPhone 14 - 128GB Black",
    sku: "IP14-128-BLK",
    barcode: "1234567890123",
    regular_price: 150.00,
    wholesale_price: 130.00,
    image: "https://via.placeholder.com/50",
    product_name: "iPhone 14",
    available_stock: 10,
    unit_name: "piece",
  },
  {
    id: 2,
    name: "Samsung Galaxy S24 - 256GB White",
    sku: "SGS24-256-WHT",
    barcode: "1234567890124",
    regular_price: 75.00,
    wholesale_price: 65.00,
    image: "https://via.placeholder.com/50",
    product_name: "Samsung Galaxy S24",
    available_stock: 8,
    unit_name: "piece",
  },
  {
    id: 3,
    name: "MacBook Air M2 - 512GB Silver",
    sku: "MBA-M2-512-SLV",
    barcode: "1234567890125",
    regular_price: 200.00,
    wholesale_price: 180.00,
    image: "https://via.placeholder.com/50",
    product_name: "MacBook Air M2",
    available_stock: 5,
    unit_name: "piece",
  },
];

const NewSale = () => {  const [form] = Form.useForm();
  const navigate = useNavigate();
  
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [filteredVariants, setFilteredVariants] = useState<ProductVariantForSale[]>(dummyVariants);

  useEffect(() => {
    setPageTitle("New Sale");
  }, []);

  useEffect(() => {
    if (searchValue) {
      const filtered = dummyVariants.filter(
        (variant) =>
          variant.name.toLowerCase().includes(searchValue.toLowerCase()) ||
          variant.sku?.toLowerCase().includes(searchValue.toLowerCase()) ||
          variant.barcode?.toLowerCase().includes(searchValue.toLowerCase()) ||
          variant.product_name.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredVariants(filtered);
    } else {
      setFilteredVariants(dummyVariants);
    }
  }, [searchValue]);

  const addToSale = (variant: ProductVariantForSale) => {
    const existingItem = selectedItems.find(item => item.variant_id === variant.id);
    
    if (existingItem) {
      if (existingItem.quantity >= variant.available_stock) {
        message.warning("Cannot add more items than available stock");
        return;
      }
      
      setSelectedItems(items =>
        items.map(item =>
          item.variant_id === variant.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                line_total: (item.quantity + 1) * item.unit_price,
              }
            : item
        )
      );
    } else {
      const newItem: SaleItem = {
        variant_id: variant.id,
        variant_name: variant.name,
        variant_sku: variant.sku,
        quantity: 1,
        unit_price: variant.regular_price,
        discount_amount: 0,
        tax_amount: 0,
        line_total: variant.regular_price,
        product_name: variant.product_name,
        regular_price: variant.regular_price,
        wholesale_price: variant.wholesale_price,
        image: variant.image,
        available_stock: variant.available_stock,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const updateItemQuantity = (variantId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }

    setSelectedItems(items =>
      items.map(item =>
        item.variant_id === variantId
          ? {
              ...item,
              quantity,
              line_total: quantity * item.unit_price - (item.discount_amount || 0) + (item.tax_amount || 0),
            }
          : item
      )
    );
  };

  const removeItem = (variantId: number) => {
    setSelectedItems(items => items.filter(item => item.variant_id !== variantId));
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discountAmount = form.getFieldValue("discount_amount") || 0;
    const taxAmount = subtotal * 0.15; // 15% tax
    const total = subtotal - discountAmount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };
  };

  const onFinish = async (values: any) => {
    if (selectedItems.length === 0) {
      message.error("Please add at least one item to the sale");
      return;
    }

    const totals = calculateTotals();
    
    const saleData: SaleFormData = {
      ...values,
      items: selectedItems.map(item => ({
        ...item,
        tax_amount: (item.quantity * item.unit_price) * 0.15, // Calculate individual tax
      })),
      discount_amount: totals.discountAmount,
    };

    try {
      // For development, just show success message
      message.success("Sale created successfully! (Backend integration pending)");
      console.log("Sale data:", saleData);
      
      // Navigate back to sales list
      navigate("/sales");
    } catch (error) {
      message.error("Failed to create sale");
    }
  };

  const totals = calculateTotals();

  const saleItemColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: SaleItem) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {record.image && (
            <img
              src={record.image}
              alt={record.variant_name}
              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
            />
          )}
          <div>
            <div>{record.product_name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.variant_name}
            </Text>
            {record.variant_sku && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  SKU: {record.variant_sku}
                </Text>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => `$${price.toFixed(2)}`,
    },
    {
      title: "Quantity",
      key: "quantity",
      render: (record: SaleItem) => (
        <InputNumber
          min={1}
          max={record.available_stock}
          value={record.quantity}
          onChange={(value) => updateItemQuantity(record.variant_id, value || 1)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: "Available",
      dataIndex: "available_stock",
      key: "available_stock",
    },
    {
      title: "Line Total",
      key: "line_total",
      render: (record: SaleItem) => `$${(record.quantity * record.unit_price).toFixed(2)}`,
    },
    {
      title: "Action",
      key: "action",
      render: (record: SaleItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.variant_id)}
        />
      ),
    },
  ];

  const variantColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: ProductVariantForSale) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {record.image && (
            <img
              src={record.image}
              alt={record.name}
              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
            />
          )}
          <div>
            <div>{record.product_name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.name}
            </Text>
            {record.sku && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  SKU: {record.sku}
                </Text>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Price",
      dataIndex: "regular_price",
      key: "regular_price",
      render: (price: number) => `$${price.toFixed(2)}`,
    },
    {
      title: "Stock",
      dataIndex: "available_stock",
      key: "available_stock",
    },
    {
      title: "Action",
      key: "action",
      render: (record: ProductVariantForSale) => (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => addToSale(record)}
          disabled={record.available_stock <= 0}
        >
          Add
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="New Sale"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: "New Sale" },
        ]}
      />

      <Form form={form} onFinish={onFinish} layout="vertical">
        <Row gutter={24}>
          {/* Left Side - Product Selection */}
          <Col span={14}>
            <Card title="Select Products" style={{ height: "calc(100vh - 200px)" }}>
              <Input
                placeholder="Search products..."
                prefix={<SearchOutlined />}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                style={{ marginBottom: 16 }}
                allowClear
              />
              
              <Table
                columns={variantColumns}
                dataSource={filteredVariants}
                rowKey="id"
                size="small"
                scroll={{ y: "calc(100vh - 350px)" }}
                pagination={{ pageSize: 50, size: "small" }}
              />
            </Card>
          </Col>

          {/* Right Side - Sale Details */}
          <Col span={10}>
            <Card title="Sale Details" style={{ height: "calc(100vh - 200px)" }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Customer Name" name="customer_name">
                    <Input placeholder="Optional" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Customer Phone" name="customer_phone">
                    <Input placeholder="Optional" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Branch"
                    name="branch_id"
                    rules={[{ required: true, message: "Please select a branch" }]}
                  >
                    <Select placeholder="Select branch">
                      <Option value={1}>Main Branch</Option>
                      <Option value={2}>Branch 2</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Payment Method"
                    name="payment_method"
                    rules={[{ required: true, message: "Please select payment method" }]}
                  >
                    <Select placeholder="Select method">
                      <Option value="cash">Cash</Option>
                      <Option value="card">Card</Option>
                      <Option value="bank_transfer">Bank Transfer</Option>
                      <Option value="mobile_money">Mobile Money</Option>
                      <Option value="credit">Credit</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Sale Items</Divider>

              <div style={{ maxHeight: "250px", overflowY: "auto", marginBottom: 16 }}>
                <Table
                  columns={saleItemColumns}
                  dataSource={selectedItems}
                  rowKey="variant_id"
                  size="small"
                  pagination={false}
                />
              </div>

              <Divider>Totals</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Discount Amount" name="discount_amount">
                    <InputNumber
                      style={{ width: "100%" }}
                      min={0}
                      max={totals.subtotal}
                      precision={2}
                      prefix="$"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Payment Status"
                    name="payment_status"
                    rules={[{ required: true, message: "Please select payment status" }]}
                  >
                    <Select placeholder="Select status">
                      <Option value="paid">Paid</Option>
                      <Option value="pending">Pending</Option>
                      <Option value="partial">Partial</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8 }}>
                <Row justify="space-between">
                  <Text>Subtotal:</Text>
                  <Text>${totals.subtotal.toFixed(2)}</Text>
                </Row>
                <Row justify="space-between">
                  <Text>Discount:</Text>
                  <Text>-${totals.discountAmount.toFixed(2)}</Text>
                </Row>
                <Row justify="space-between">
                  <Text>Tax (15%):</Text>
                  <Text>${totals.taxAmount.toFixed(2)}</Text>
                </Row>
                <Divider style={{ margin: "8px 0" }} />
                <Row justify="space-between">
                  <Title level={4} style={{ margin: 0 }}>Total:</Title>
                  <Title level={4} style={{ margin: 0 }}>${totals.total.toFixed(2)}</Title>
                </Row>
              </div>

              <Form.Item label="Notes" name="notes" style={{ marginTop: 16 }}>
                <Input.TextArea rows={3} placeholder="Optional notes" />
              </Form.Item>

              <div style={{ marginTop: 24 }}>
                <Space>
                  <Button onClick={() => navigate("/sales")}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    disabled={selectedItems.length === 0}
                  >
                    Create Sale
                  </Button>
                </Space>
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default NewSale;
