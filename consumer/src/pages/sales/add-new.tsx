import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Table,
  Typography,
  Space,
  Radio,
} from "antd";
import {
  DeleteOutlined,
  SearchOutlined,
  SwapOutlined,
  CalculatorOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";
import CustomerModal from "./CustomerModal";
import {
  SaleItem,
  SaleFormData,
  ProductVariantForSale,
  PaymentMethod,
  PaymentStatus,
  PriceType,
  DiscountType,
  Branch,
} from "../../types/sale.types";
import { Customer, CustomerType } from "../../types/customer.types";

const { Option } = Select;
const { Text } = Typography;

// Demo data
const dummyBranches: Branch[] = [
  {
    id: 1,
    name: "Main Branch",
    address: "123 Main St",
    is_main: true,
    is_warehouse: false,
  },
  {
    id: 2,
    name: "Downtown Branch",
    address: "456 Downtown Ave",
    is_main: false,
    is_warehouse: false,
  },
  {
    id: 3,
    name: "Warehouse",
    address: "789 Industrial Rd",
    is_main: false,
    is_warehouse: true,
  },
];

const dummyCustomers: Customer[] = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1234567890",
    address: "123 Main St, New York, NY 10001",
    customer_type: CustomerType.INDIVIDUAL,
    consumer_id: 1,
    created_at: "2025-06-20T10:00:00Z",
    updated_at: "2025-06-25T14:30:00Z",
  },
  {
    id: 2,
    name: "Tech Solutions Inc.",
    email: "contact@techsolutions.com",
    phone: "+1234567891",
    address: "456 Business Ave, San Francisco, CA 94102",
    customer_type: CustomerType.BUSINESS,
    consumer_id: 1,
    created_at: "2025-06-18T15:20:00Z",
    updated_at: "2025-06-24T11:45:00Z",
  },
  {
    id: 3,
    name: "Jane Smith",
    email: "jane.smith@email.com",
    phone: "+1234567892",
    address: "789 Oak Street, Chicago, IL 60601",
    customer_type: CustomerType.INDIVIDUAL,
    consumer_id: 1,
    created_at: "2025-06-22T09:15:00Z",
    updated_at: "2025-06-25T16:20:00Z",
  },
];

const dummyVariants: ProductVariantForSale[] = [
  {
    id: 1,
    name: "iPhone 14 - 128GB Black",
    sku: "IP14-128-BLK",
    barcode: "1234567890123",
    regular_price: 150.0,
    wholesale_price: 130.0,
    image: "https://via.placeholder.com/50",
    product_name: "iPhone 14",
    available_stock: 10,
    unit_name: "piece",
    tax_percentage: 15,
    batches: [
      {
        id: 1,
        batch_number: "BATCH001",
        quantity: 5,
        cost_price: 120,
        expiry_date: "2025-12-31",
      },
      {
        id: 2,
        batch_number: "BATCH002",
        quantity: 5,
        cost_price: 125,
        expiry_date: "2026-06-30",
      },
    ],
  },
  {
    id: 2,
    name: "Samsung Galaxy S24 - 256GB White",
    sku: "SGS24-256-WHT",
    barcode: "1234567890124",
    regular_price: 75.0,
    wholesale_price: 65.0,
    image: "https://via.placeholder.com/50",
    product_name: "Samsung Galaxy S24",
    available_stock: 8,
    unit_name: "piece",
    tax_percentage: 15,
    batches: [
      {
        id: 3,
        batch_number: "BATCH003",
        quantity: 8,
        cost_price: 60,
        expiry_date: "2025-12-31",
      },
    ],
  },
  {
    id: 3,
    name: "MacBook Air M2 - 512GB Silver",
    sku: "MBA-M2-512-SLV",
    barcode: "1234567890125",
    regular_price: 200.0,
    wholesale_price: 180.0,
    image: "https://via.placeholder.com/50",
    product_name: "MacBook Air M2",
    available_stock: 5,
    unit_name: "piece",
    tax_percentage: 15,
    batches: [
      {
        id: 4,
        batch_number: "BATCH004",
        quantity: 3,
        cost_price: 170,
        expiry_date: "2025-12-31",
      },
      {
        id: 5,
        batch_number: "BATCH005",
        quantity: 2,
        cost_price: 175,
        expiry_date: "2026-06-30",
      },
    ],
  },
];

const NewSale = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Watch form values for real-time calculations
  const discountAmount = Form.useWatch('discount_amount', form) || 0;
  const shippingCost = Form.useWatch('shipping_cost', form) || 0;
  const receivedAmount = Form.useWatch('received_amount', form) || 0;

  // State
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [filteredVariants, setFilteredVariants] =
    useState<ProductVariantForSale[]>(dummyVariants);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [discountType, setDiscountType] = useState<DiscountType>(
    DiscountType.FLAT
  );

  useEffect(() => {
    setPageTitle("New Sale");
    // Set default values
    form.setFieldsValue({
      branch_id: dummyBranches[0]?.id,
      customer_id: null,
      price_type: PriceType.REGULAR,
      discount_type: DiscountType.FLAT,
      discount_amount: 0,
      shipping_cost: 0,
      payment_method: PaymentMethod.CASH,
      payment_status: PaymentStatus.PAID,
      received_amount: 0,
    });
  }, [form]);

  // Filter products based on search
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

  const addToSale = (variant: ProductVariantForSale, batchId?: number) => {
    const existingItem = selectedItems.find(
      (item) => item.variant_id === variant.id && item.batch_id === batchId
    );
    const price =
      priceType === PriceType.WHOLESALE
        ? variant.wholesale_price || variant.regular_price
        : variant.regular_price;
    const selectedBatch =
      variant.batches.find((b) => b.id === batchId) || variant.batches[0];

    if (!selectedBatch) {
      message.error("No batch available for this product");
      return;
    }

    if (existingItem) {
      if (existingItem.quantity >= selectedBatch.quantity) {
        message.warning("Cannot add more items than available in this batch");
        return;
      }

      setSelectedItems((items) =>
        items.map((item) =>
          item.variant_id === variant.id && item.batch_id === batchId
            ? {
                ...item,
                quantity: item.quantity + 1,
                unit_price: price,
                tax_amount:
                  ((item.quantity + 1) * price * variant.tax_percentage) / 100,
                line_total: (item.quantity + 1) * price,
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
        unit_price: price,
        discount_amount: 0,
        tax_amount: (price * variant.tax_percentage) / 100,
        line_total: price,
        product_name: variant.product_name,
        regular_price: variant.regular_price,
        wholesale_price: variant.wholesale_price,
        image: variant.image,
        available_stock: selectedBatch.quantity,
        unit_name: variant.unit_name,
        tax_percentage: variant.tax_percentage,
        batch_id: selectedBatch.id,
        batch_number: selectedBatch.batch_number,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const updateItemQuantity = (
    variantId: number,
    batchId: number,
    quantity: number
  ) => {
    if (quantity <= 0) {
      removeItem(variantId, batchId);
      return;
    }

    setSelectedItems((items) =>
      items.map((item) =>
        item.variant_id === variantId && item.batch_id === batchId
          ? {
              ...item,
              quantity,
              tax_amount:
                (quantity * item.unit_price * (item.tax_percentage || 0)) / 100,
              line_total: quantity * item.unit_price,
            }
          : item
      )
    );
  };

  const removeItem = (variantId: number, batchId: number) => {
    setSelectedItems((items) =>
      items.filter(
        (item) => !(item.variant_id === variantId && item.batch_id === batchId)
      )
    );
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce(
      (sum, item) => sum + item.line_total,
      0
    );
    const totalTax = selectedItems.reduce(
      (sum, item) => sum + (item.tax_amount || 0),
      0
    );

    const finalDiscount =
      discountType === DiscountType.PERCENTAGE
        ? (subtotal * discountAmount) / 100
        : discountAmount;

    const total = subtotal - finalDiscount + totalTax + shippingCost;
    const changeAmount = receivedAmount - total;

    return {
      subtotal,
      totalTax,
      finalDiscount,
      shippingCost,
      total,
      receivedAmount,
      changeAmount,
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
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name || values.customer_name,
      customer_phone: selectedCustomer?.phone || values.customer_phone,
      customer_email: selectedCustomer?.email || values.customer_email,
      items: selectedItems,
      price_type: priceType,
      discount_type: discountType,
      discount_amount: totals.finalDiscount,
      shipping_cost: totals.shippingCost,
    };

    try {
      message.success(
        "Sale created successfully! (Backend integration pending)"
      );
      console.log("Sale data:", saleData);
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
              style={{
                width: 40,
                height: 40,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{record.product_name}</div>
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
      title: "Batch",
      key: "batch",
      render: (record: SaleItem) => (
        <div>
          <Text strong>{record.batch_number}</Text>
          <div style={{ fontSize: 11, color: "#666" }}>
            Qty: {record.available_stock}
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
        <div>
          <InputNumber
            min={1}
            max={record.available_stock}
            value={record.quantity}
            onChange={(value) =>
              updateItemQuantity(
                record.variant_id,
                record.batch_id!,
                value || 1
              )
            }
            style={{ width: 80, marginBottom: 4 }}
          />
          <div style={{ fontSize: 11, color: "#666" }}>{record.unit_name}</div>
        </div>
      ),
    },
    {
      title: "Tax",
      key: "tax",
      render: (record: SaleItem) => `$${(record.tax_amount || 0).toFixed(2)}`,
    },
    {
      title: "Total",
      key: "line_total",
      render: (record: SaleItem) => `$${record.line_total.toFixed(2)}`,
    },
    {
      title: "Action",
      key: "action",
      render: (record: SaleItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.variant_id, record.batch_id!)}
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
              style={{
                width: 40,
                height: 40,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{record.product_name}</div>
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
      title: "Batches",
      key: "batches",
      render: (record: ProductVariantForSale) => (
        <div>
          {record.batches.map((batch) => (
            <div key={batch.id} style={{ marginBottom: 4 }}>
              <Button
                size="small"
                type="primary"
                ghost
                onClick={() => addToSale(record, batch.id)}
                style={{ marginRight: 4 }}
              >
                {batch.batch_number} ({batch.quantity})
              </Button>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Price",
      key: "price",
      render: (record: ProductVariantForSale) => (
        <div>
          <div>
            $
            {priceType === PriceType.WHOLESALE
              ? record.wholesale_price || record.regular_price
              : record.regular_price}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {priceType === PriceType.WHOLESALE ? "Wholesale" : "Regular"}
          </Text>
        </div>
      ),
    },
    {
      title: "Total Stock",
      dataIndex: "available_stock",
      key: "available_stock",
      render: (stock: number, record: ProductVariantForSale) => (
        <div>
          <div>
            {stock} {record.unit_name}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.batches.length} batch(es)
          </Text>
        </div>
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

      <CustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreateCustomer={(customer) => {
          // In real app, this would call API to create customer
          const newCustomer: Customer = {
            ...customer,
            id: Date.now(),
            consumer_id: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setSelectedCustomer(newCustomer);
          form.setFieldsValue({ customer_id: newCustomer.id });
          message.success('Customer created successfully');
        }}
      />

      <Form form={form} onFinish={onFinish} layout="vertical">
        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                label="Branch"
                name="branch_id"
                // rules={[{ required: true }]} 
              >
                <Select placeholder="Select branch">
                  {dummyBranches.map((branch) => (
                    <Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Customer" name="customer_id">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Select
                    placeholder="Select customer"
                    showSearch
                    allowClear
                    optionFilterProp="children"
                    value={selectedCustomer?.id}
                    onChange={(value) => {
                      const customer = dummyCustomers.find((c) => c.id === value);
                      setSelectedCustomer(customer || null);
                      form.setFieldsValue({ customer_id: value });
                    }}
                    style={{ flex: 1 }}
                    defaultValue={null}
                  >
                    <Option value={null}>Walking Customer</Option>
                    {dummyCustomers.map((customer) => (
                      <Option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone})
                      </Option>
                    ))}
                  </Select>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setCustomerModalOpen(true)}
                    title="Add new customer"
                  />
                </div>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Price Type">
                <Button
                  icon={<SwapOutlined />}
                  onClick={() =>
                    setPriceType(
                      priceType === PriceType.REGULAR
                        ? PriceType.WHOLESALE
                        : PriceType.REGULAR
                    )
                  }
                  type={
                    priceType === PriceType.WHOLESALE ? "primary" : "default"
                  }
                  style={{ width: "100%" }}
                >
                  {priceType === PriceType.WHOLESALE ? "Wholesale" : "Regular"}
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Product Selection</h3>
          <Input
            placeholder="Search products by name, SKU, or barcode..."
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
            scroll={{ y: 250 }}
            pagination={{ pageSize: 8, size: "small" }}
          />
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Sale Items</h3>
          <Table
            columns={saleItemColumns}
            dataSource={selectedItems}
            rowKey={(record) => `${record.variant_id}-${record.batch_id}`}
            size="small"
            pagination={false}
            locale={{ emptyText: "No items added yet" }}
          />
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label="Discount Type">
                    <Radio.Group
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      size="small"
                    >
                      <Radio value={DiscountType.FLAT}>Fixed</Radio>
                      <Radio value={DiscountType.PERCENTAGE}>Percentage</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Discount" name="discount_amount">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="small"
                      placeholder="0"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Shipping" name="shipping_cost">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="small"
                      placeholder="0"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            <Col span={8}>
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label="Payment Method" name="payment_method">
                    <Select size="small">
                      <Option value={PaymentMethod.CASH}>Cash</Option>
                      <Option value={PaymentMethod.CARD}>Card</Option>
                      <Option value={PaymentMethod.CHEQUE}>Cheque</Option>
                      <Option value={PaymentMethod.BANK_TRANSFER}>
                        Bank Transfer
                      </Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Payment Status" name="payment_status">
                    <Select size="small">
                      <Option value={PaymentStatus.PAID}>Paid</Option>
                      <Option value={PaymentStatus.PARTIAL}>Partial</Option>
                      <Option value={PaymentStatus.DUE}>Due</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Received Amount" name="received_amount">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="small"
                      placeholder="0.00"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            <Col span={8}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Subtotal:</Text>
                  <Text style={{ fontSize: 12 }} strong>
                    ${totals.subtotal.toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Tax:</Text>
                  <Text style={{ fontSize: 12 }}>
                    ${totals.totalTax.toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Discount:</Text>
                  <Text style={{ fontSize: 12 }}>
                    -${totals.finalDiscount.toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Shipping:</Text>
                  <Text style={{ fontSize: 12 }}>
                    ${totals.shippingCost.toFixed(2)}
                  </Text>
                </div>
                <Divider style={{ margin: "8px 0" }} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text strong>Total:</Text>
                  <Text strong style={{ fontSize: 16 }}>
                    ${totals.total.toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Change:</Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: totals.changeAmount >= 0 ? "#52c41a" : "#ff4d4f",
                    }}
                  >
                    ${totals.changeAmount.toFixed(2)}
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ borderRadius: 8 }}>
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item label="Notes" name="notes" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={4}
                  placeholder="Optional notes about this sale"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  height: "100%",
                }}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button onClick={() => navigate("/sales")} size="large" block>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<CalculatorOutlined />}
                    size="large"
                    disabled={selectedItems.length === 0}
                    block
                  >
                    Create Sale
                  </Button>
                </Space>
              </div>
            </Col>
          </Row>
        </div>
      </Form>
    </div>
  );
};

export default NewSale;
