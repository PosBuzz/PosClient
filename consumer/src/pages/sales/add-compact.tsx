import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Space,
  Radio,
  Card,
} from "antd";
import {
  DeleteOutlined,
  SearchOutlined,
  SwapOutlined,
  CalculatorOutlined,
  ShoppingCartOutlined,
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

// Demo data
const dummyBranches: Branch[] = [
  { id: 1, name: "Main Branch", address: "123 Main St", is_main: true, is_warehouse: false },
  { id: 2, name: "Downtown Branch", address: "456 Downtown Ave", is_main: false, is_warehouse: false },
  { id: 3, name: "Warehouse", address: "789 Industrial Rd", is_main: false, is_warehouse: true },
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
      { id: 1, batch_number: "BATCH001", quantity: 5, cost_price: 120, expiry_date: "2025-12-31" },
      { id: 2, batch_number: "BATCH002", quantity: 5, cost_price: 125, expiry_date: "2026-06-30" },
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
      { id: 3, batch_number: "BATCH003", quantity: 8, cost_price: 60, expiry_date: "2025-12-31" },
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
      { id: 4, batch_number: "BATCH004", quantity: 3, cost_price: 170, expiry_date: "2025-12-31" },
      { id: 5, batch_number: "BATCH005", quantity: 2, cost_price: 175, expiry_date: "2026-06-30" },
    ],
  },
];

const CompactSale = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Watch form values for real-time calculations
  const discountAmount = Form.useWatch('discount_amount', form) || 0;
  const shippingCost = Form.useWatch('shipping_cost', form) || 0;
  const receivedAmount = Form.useWatch('received_amount', form) || 0;

  // State
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [filteredVariants, setFilteredVariants] = useState<ProductVariantForSale[]>(dummyVariants);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [discountType, setDiscountType] = useState<DiscountType>(DiscountType.FLAT);

  useEffect(() => {
    setPageTitle("New Sale - POS");
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
    const existingItem = selectedItems.find((item) => item.variant_id === variant.id && item.batch_id === batchId);
    const price = priceType === PriceType.WHOLESALE ? variant.wholesale_price || variant.regular_price : variant.regular_price;
    const selectedBatch = variant.batches.find(b => b.id === batchId) || variant.batches[0];
    
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
                tax_amount: ((item.quantity + 1) * price * variant.tax_percentage) / 100,
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

  const updateItemQuantity = (variantId: number, batchId: number, quantity: number) => {
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
              tax_amount: (quantity * item.unit_price * (item.tax_percentage || 0)) / 100,
              line_total: quantity * item.unit_price,
            }
          : item
      )
    );
  };

  const removeItem = (variantId: number, batchId: number) => {
    setSelectedItems((items) => items.filter((item) => !(item.variant_id === variantId && item.batch_id === batchId)));
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce((sum, item) => sum + item.line_total, 0);
    const totalTax = selectedItems.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
    
    const finalDiscount = discountType === DiscountType.PERCENTAGE 
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
      message.success("Sale created successfully! (Backend integration pending)");
      console.log("Sale data:", saleData);
      navigate("/sales");
    } catch (error) {
      message.error("Failed to create sale");
    }
  };

  const totals = calculateTotals();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageTitle
        title="POS - New Sale"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: "POS" },
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
          message.success('Customer created successfully');
        }}
      />

      <Form form={form} onFinish={onFinish} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Row gutter={16} style={{ flex: 1 }}>
          {/* Left Panel - Product Selection */}
          <Col span={16}>
            <Card 
              title="Product Selection" 
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Row gutter={8} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Input
                    placeholder="Search products by name, SKU, or barcode..."
                    prefix={<SearchOutlined />}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col span={5}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Select
                      placeholder="Select customer"
                      showSearch
                      allowClear
                      value={selectedCustomer?.id}
                      onChange={(value) => {
                        const customer = dummyCustomers.find(c => c.id === value);
                        setSelectedCustomer(customer || null);
                      }}
                      style={{ flex: 1 }}
                      defaultValue={null}
                    >
                      <Option value={null}>Walking Customer</Option>
                      {dummyCustomers.map(customer => (
                        <Option key={customer.id} value={customer.id}>
                          {customer.name} ({customer.phone})
                        </Option>
                      ))}
                    </Select>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => setCustomerModalOpen(true)}
                      title="Add new customer"
                      size="small"
                    />
                  </div>
                </Col>
                <Col span={5}>
                  <Button
                    icon={<SwapOutlined />}
                    onClick={() => setPriceType(priceType === PriceType.REGULAR ? PriceType.WHOLESALE : PriceType.REGULAR)}
                    type={priceType === PriceType.WHOLESALE ? 'primary' : 'default'}
                    style={{ width: '100%' }}
                  >
                    {priceType === PriceType.WHOLESALE ? 'Wholesale' : 'Regular'}
                  </Button>
                </Col>
              </Row>

              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, overflowY: 'auto' }}>
                {filteredVariants.map((variant) => (
                  <Card
                    key={variant.id}
                    size="small"
                    hoverable
                    style={{ cursor: 'pointer' }}
                    bodyStyle={{ padding: 8 }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      {variant.image && (
                        <img
                          src={variant.image}
                          alt={variant.name}
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }}
                        />
                      )}
                      <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 4 }}>
                        {variant.product_name}
                      </div>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                        {variant.name}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1890ff', marginBottom: 8 }}>
                        ${priceType === PriceType.WHOLESALE ? (variant.wholesale_price || variant.regular_price) : variant.regular_price}
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {variant.batches.map((batch) => (
                          <Button
                            key={batch.id}
                            size="small"
                            type="primary"
                            ghost
                            onClick={() => addToSale(variant, batch.id)}
                            disabled={batch.quantity <= 0}
                            style={{ fontSize: 10, padding: '2px 6px', height: 'auto' }}
                          >
                            {batch.batch_number} ({batch.quantity})
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </Col>

          {/* Right Panel - Cart & Checkout */}
          <Col span={8}>
            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingCartOutlined />
                  Cart ({selectedItems.length})
                </div>
              }
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12 }}
            >
              {/* Cart Items */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
                {selectedItems.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                    No items in cart
                  </div>
                ) : (
                  selectedItems.map((item) => (
                    <div key={`${item.variant_id}-${item.batch_id}`} style={{ 
                      border: '1px solid #f0f0f0', 
                      borderRadius: 4, 
                      padding: 8, 
                      marginBottom: 8,
                      fontSize: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeItem(item.variant_id, item.batch_id!)}
                        />
                      </div>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                        {item.variant_name} • {item.batch_number}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <InputNumber
                            min={1}
                            max={item.available_stock}
                            value={item.quantity}
                            onChange={(value) => updateItemQuantity(item.variant_id, item.batch_id!, value || 1)}
                            size="small"
                            style={{ width: 60 }}
                          />
                          <span style={{ fontSize: 10, color: '#666' }}>× ${item.unit_price}</span>
                        </div>
                        <div style={{ fontWeight: 'bold' }}>${item.line_total.toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span>Subtotal:</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span>Tax:</span>
                  <span>${totals.totalTax.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span>Discount:</span>
                  <span>-${totals.finalDiscount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 16, fontWeight: 'bold' }}>
                  <span>Total:</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Quick Settings */}
              <div style={{ marginBottom: 16 }}>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 10, marginBottom: 4 }}>Discount:</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Radio.Group 
                        value={discountType} 
                        onChange={(e) => setDiscountType(e.target.value)}
                        size="small"
                      >
                        <Radio value={DiscountType.FLAT}>$</Radio>
                        <Radio value={DiscountType.PERCENTAGE}>%</Radio>
                      </Radio.Group>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="discount_amount" style={{ marginBottom: 0 }}>
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        size="small"
                        placeholder="0"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Payment */}
              <div style={{ marginBottom: 16 }}>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 10, marginBottom: 4 }}>Payment:</div>
                    <Form.Item name="payment_method" style={{ marginBottom: 0 }}>
                      <Select size="small">
                        <Option value={PaymentMethod.CASH}>Cash</Option>
                        <Option value={PaymentMethod.CARD}>Card</Option>
                        <Option value={PaymentMethod.CHEQUE}>Cheque</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 10, marginBottom: 4 }}>Received:</div>
                    <Form.Item name="received_amount" style={{ marginBottom: 0 }}>
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        size="small"
                        placeholder="0.00"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                {totals.changeAmount !== 0 && (
                  <div style={{ 
                    marginTop: 8, 
                    textAlign: 'center', 
                    fontWeight: 'bold',
                    color: totals.changeAmount >= 0 ? '#52c41a' : '#ff4d4f'
                  }}>
                    Change: ${totals.changeAmount.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Hidden Fields */}
              <Form.Item name="branch_id" style={{ display: 'none' }}>
                <Select />
              </Form.Item>
              <Form.Item name="payment_status" style={{ display: 'none' }}>
                <Select />
              </Form.Item>
              <Form.Item name="shipping_cost" style={{ display: 'none' }}>
                <InputNumber />
              </Form.Item>

              {/* Action Buttons */}
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  icon={<CalculatorOutlined />}
                  size="large"
                  disabled={selectedItems.length === 0}
                  block
                >
                  Complete Sale
                </Button>
                <Button onClick={() => navigate("/sales")} block>
                  Cancel
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default CompactSale;
