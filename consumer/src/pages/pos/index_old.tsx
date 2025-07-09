import { useQuery, useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { salesApi } from "../../api/sales-api";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { Customer } from "../../types/customer.types";
import {
  DiscountType,
  PaymentMethod,
  PaymentStatus,
  PriceType,
  ProductVariantForSale,
  SaleFormData,
  SaleItem,
  SaleType,
} from "../../types/sale.types";
import { cacheInvalidation } from "../../utils/cacheInvalidation";
import CustomerModal from "../add-sales/CustomerModal";
import "./pos.css";

const POSPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();

  // State
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredVariants, setFilteredVariants] = useState<ProductVariantForSale[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [discountType, setDiscountType] = useState<DiscountType>(DiscountType.FLAT);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [loading, setLoading] = useState(false);

  const userBranches = user?.branches || [];

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchValue(value);
    }, 300),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Load customers
  const customersQuery = useQuery({
    queryKey: [queryKeys.customers],
    queryFn: async () => {
      const data = await get(endpoints.getCustomers);
      return data.data || data;
    },
    staleTime: queryStaleTimeMap[queryKeys.customers],
  });

  // Load products for sale when searching
  const productsForSaleQuery = useQuery({
    queryKey: [queryKeys.productsForSale, selectedBranch, debouncedSearchValue],
    queryFn: () => salesApi.getProductsForSale(selectedBranch!, debouncedSearchValue),
    enabled: !!selectedBranch && !!debouncedSearchValue,
    staleTime: queryStaleTimeMap[queryKeys.productsForSale],
  });

  useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch]);

  // Set default branch
  useEffect(() => {
    if (userBranches.length > 0 && !selectedBranch) {
      const defaultBranch = userBranches[0];
      setSelectedBranch(defaultBranch.id);
    }
  }, [userBranches, selectedBranch]);

  useEffect(() => {
    if (customersQuery.data) {
      setCustomers(customersQuery.data);
    }
  }, [customersQuery.data]);

  useEffect(() => {
    if (productsForSaleQuery.data) {
      setFilteredVariants(productsForSaleQuery.data);
    }
  }, [productsForSaleQuery.data]);

  const addToCart = (variant: ProductVariantForSale, batchId?: number) => {
    const existingItem = selectedItems.find(
      (item) => item.variant_id === variant.id && item.batch_id === batchId
    );
    const price =
      priceType === PriceType.WHOLESALE
        ? Number(variant.wholesale_price) || Number(variant.regular_price)
        : Number(variant.regular_price);
    const selectedBatch = variant.batches.find((b) => b.id === batchId) || variant.batches[0];

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
                tax_amount: ((item.quantity + 1) * price * (Number(variant.tax_percentage) || 0)) / 100,
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
        tax_amount: (price * (Number(variant.tax_percentage) || 0)) / 100,
        line_total: price,
        product_name: variant.product_name,
        regular_price: Number(variant.regular_price),
        wholesale_price: Number(variant.wholesale_price) || undefined,
        image: variant.image,
        available_stock: selectedBatch.quantity,
        unit_name: variant.unit_name,
        tax_percentage: Number(variant.tax_percentage) || 0,
        batch_id: selectedBatch.id,
        batch_number: selectedBatch.batch_number,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
    
    // Clear search after adding
    setSearchValue("");
    setDebouncedSearchValue("");
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
              tax_amount: (quantity * Number(item.unit_price) * (Number(item.tax_percentage) || 0)) / 100,
              line_total: quantity * Number(item.unit_price),
            }
          : item
      )
    );
  };

  const removeItem = (variantId: number, batchId: number) => {
    setSelectedItems((items) =>
      items.filter((item) => !(item.variant_id === variantId && item.batch_id === batchId))
    );
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);
    const totalTax = selectedItems.reduce((sum, item) => sum + (Number(item.tax_amount) || 0), 0);

    const finalDiscount =
      discountType === DiscountType.PERCENTAGE
        ? (subtotal * discountAmount) / 100
        : discountAmount;

    const total = subtotal - finalDiscount + totalTax + shippingCost;
    const changeAmount = receivedAmount - total;

    return {
      subtotal: Number(subtotal),
      totalTax: Number(totalTax),
      finalDiscount: Number(finalDiscount),
      shippingCost: Number(shippingCost),
      total: Number(total),
      receivedAmount: Number(receivedAmount),
      changeAmount: Number(changeAmount),
    };
  };

  const completeSale = async () => {
    if (selectedItems.length === 0) {
      message.error("Please add at least one item to the cart");
      return;
    }

    const totals = calculateTotals();

    const saleData: SaleFormData = {
      branch_id: selectedBranch!,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name,
      customer_phone: selectedCustomer?.phone,
      customer_email: selectedCustomer?.email,
      items: selectedItems,
      price_type: priceType,
      discount_type: discountType,
      discount_amount: totals.finalDiscount,
      shipping_cost: totals.shippingCost,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      received_amount: receivedAmount,
      sale_type: SaleType.SALE,
    };

    try {
      setLoading(true);
      await salesApi.createSale(saleData);

      cacheInvalidation.invalidateAfterSalesOperation(queryClient);

      message.success("Sale completed successfully!");
      
      // Reset everything
      setSelectedItems([]);
      setSelectedCustomer(null);
      setDiscountAmount(0);
      setShippingCost(0);
      setReceivedAmount(0);
      
    } catch (error: any) {
      console.error("Error creating sale:", error);
      message.error(error.response?.data?.message || "Failed to complete sale");
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div style={{ 
      height: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            type="text"
            size="large"
            style={{ color: '#4338ca' }}
          />
          <Title level={3} style={{ margin: 0, color: '#4338ca', fontWeight: 'bold' }}>
            🛒 PosBuzz POS
          </Title>
          {selectedBranch && (
            <Select
              value={selectedBranch}
              onChange={setSelectedBranch}
              style={{ minWidth: 180 }}
              size="large"
            >
              {userBranches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  📍 {branch.name}
                </Option>
              ))}
            </Select>
          )}
        </div>
        
        <Space size="large">
          <Button
            icon={<UserOutlined />}
            type={priceType === PriceType.WHOLESALE ? "primary" : "default"}
            onClick={() => setPriceType(priceType === PriceType.WHOLESALE ? PriceType.REGULAR : PriceType.WHOLESALE)}
            size="large"
            style={{
              backgroundColor: priceType === PriceType.WHOLESALE ? '#4338ca' : 'white',
              borderColor: '#4338ca',
              color: priceType === PriceType.WHOLESALE ? 'white' : '#4338ca'
            }}
          >
            {priceType === PriceType.WHOLESALE ? "Wholesale" : "Regular"} Pricing
          </Button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar 
              icon={<UserOutlined />}
              style={{ backgroundColor: '#4338ca' }}
            />
            <Text strong style={{ color: '#4338ca' }}>{user?.name}</Text>
            <Button 
              icon={<LogoutOutlined />} 
              onClick={() => {
                logout();
                navigate('/login');
              }}
              type="text"
              danger
            />
          </div>
        </Space>
      </div>

      {/* Main Content - Two Column Layout */}
      <div style={{ flex: 1, display: 'flex', padding: 16, gap: 16, overflow: 'hidden' }}>
        
        {/* Left Column - Cart & Checkout (Main Focus) */}
        <div style={{ width: 500 }}>
          <Card
            style={{ 
              height: '100%',
              borderRadius: 16,
              border: 'none',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
            bodyStyle={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              padding: 24
            }}
          >
            {/* Cart Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 20,
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #4338ca, #5b21b6)',
              borderRadius: 12,
              color: 'white'
            }}>
              <Title level={3} style={{ margin: 0, color: 'white' }}>
                🛒 Shopping Cart
              </Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                  {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} items
                </Text>
                <Button
                  size="small"
                  onClick={() => setSelectedItems([])}
                  disabled={selectedItems.length === 0}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    borderColor: 'white', 
                    color: 'white' 
                  }}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Cart Items */}
            <div style={{ flex: 1, overflow: 'auto', marginBottom: 20 }}>
              {selectedItems.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  color: '#6b7280'
                }}>
                  <ShoppingCartOutlined style={{ fontSize: 72, marginBottom: 20, color: '#d1d5db' }} />
                  <Title level={4} type="secondary">Your cart is empty</Title>
                  <Text type="secondary">Search and add products to get started</Text>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedItems.map((item) => (
                    <Card
                      key={`${item.variant_id}-${item.batch_id}`}
                      style={{ 
                        backgroundColor: 'rgba(248, 250, 252, 0.8)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: 12
                      }}
                      bodyStyle={{ padding: 16 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.variant_name}
                            style={{ 
                              width: 60, 
                              height: 60, 
                              objectFit: 'cover', 
                              borderRadius: 8,
                              border: '2px solid rgba(59, 130, 246, 0.2)'
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong style={{ fontSize: 16, display: 'block', color: '#1f2937' }}>
                            {item.product_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 14, display: 'block' }}>
                            {item.variant_name} • Batch: {item.batch_number}
                          </Text>
                          <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 16 }}>
                            ${Number(item.unit_price).toFixed(2)} each
                          </Text>
                        </div>
                        <Button
                          size="small"
                          icon={<DeleteOutlined />}
                          danger
                          onClick={() => removeItem(item.variant_id, item.batch_id!)}
                          style={{ 
                            width: 32, 
                            height: 32,
                            borderRadius: 8
                          }}
                        />
                      </div>
                      
                      {/* Quantity Controls */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.7)',
                        borderRadius: 8,
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Text strong style={{ color: '#374151' }}>Quantity:</Text>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Button
                              size="small"
                              icon={<MinusOutlined />}
                              onClick={() => updateItemQuantity(item.variant_id, item.batch_id!, item.quantity - 1)}
                              style={{ 
                                width: 32, 
                                height: 32,
                                borderRadius: 6,
                                backgroundColor: '#ef4444',
                                borderColor: '#ef4444',
                                color: 'white'
                              }}
                            />
                            <InputNumber
                              min={1}
                              max={item.available_stock}
                              value={item.quantity}
                              onChange={(value) => updateItemQuantity(item.variant_id, item.batch_id!, value || 1)}
                              style={{ 
                                width: 80,
                                textAlign: 'center'
                              }}
                              size="small"
                            />
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => updateItemQuantity(item.variant_id, item.batch_id!, item.quantity + 1)}
                              disabled={item.quantity >= item.available_stock}
                              style={{ 
                                width: 32, 
                                height: 32,
                                borderRadius: 6,
                                backgroundColor: '#10b981',
                                borderColor: '#10b981',
                                color: 'white'
                              }}
                            />
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            (Max: {item.available_stock})
                          </Text>
                        </div>
                        <Text strong style={{ 
                          color: '#4338ca', 
                          fontSize: 18,
                          background: 'rgba(67, 56, 202, 0.1)',
                          padding: '4px 12px',
                          borderRadius: 6
                        }}>
                          ${Number(item.line_total).toFixed(2)}
                        </Text>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Transaction Summary */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(67, 56, 202, 0.1), rgba(91, 33, 182, 0.1))',
              padding: 20,
              borderRadius: 12,
              marginBottom: 20,
              border: '1px solid rgba(67, 56, 202, 0.2)'
            }}>
              <Title level={4} style={{ margin: '0 0 16px 0', color: '#4338ca' }}>
                Transaction Details
              </Title>
              
              {/* Customer Selection */}
              <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: '#6b7280', display: 'block', marginBottom: 8 }}>Customer:</Text>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Select
                    placeholder="Select customer (optional)"
                    showSearch
                    allowClear
                    value={selectedCustomer?.id}
                    onChange={(value) => {
                      const customer = customers.find((c) => c.id === value);
                      setSelectedCustomer(customer || null);
                    }}
                    style={{ flex: 1 }}
                    size="small"
                  >
                    {customers.map((customer) => (
                      <Option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone})
                      </Option>
                    ))}
                  </Select>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setCustomerModalOpen(true)}
                    size="small"
                    style={{ 
                      backgroundColor: '#4338ca',
                      borderColor: '#4338ca',
                      color: 'white'
                    }}
                  />
                </div>
                {selectedCustomer && (
                  <Text style={{ fontSize: 12, color: '#059669', marginTop: 4, display: 'block' }}>
                    ✓ {selectedCustomer.name} - {selectedCustomer.phone}
                  </Text>
                )}
              </div>
              
              {/* Pricing Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Subtotal:</Text>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>
                    ${totals.subtotal.toFixed(2)}
                  </div>
                </div>
                <div>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Tax:</Text>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>
                    ${totals.totalTax.toFixed(2)}
                  </div>
                </div>
                <div>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Discount:</Text>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>
                    -${totals.finalDiscount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Shipping:</Text>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>
                    ${totals.shippingCost.toFixed(2)}
                  </div>
                </div>
              </div>
              
              <Divider style={{ margin: '16px 0', borderColor: 'rgba(67, 56, 202, 0.3)' }} />
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px 16px',
                background: 'rgba(67, 56, 202, 0.1)',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <Text strong style={{ fontSize: 20, color: '#4338ca' }}>Total Amount:</Text>
                <Text strong style={{ 
                  fontSize: 24, 
                  color: '#4338ca',
                  background: 'white',
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '2px solid #4338ca'
                }}>
                  ${totals.total.toFixed(2)}
                </Text>
              </div>

              {/* Quick Payment & Discount Controls */}
              <Row gutter={12} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Discount Type:</Text>
                    <Radio.Group 
                      value={discountType} 
                      onChange={(e) => setDiscountType(e.target.value)}
                      size="small"
                      style={{ width: '100%' }}
                    >
                      <Radio value={DiscountType.FLAT} style={{ fontSize: 12 }}>$</Radio>
                      <Radio value={DiscountType.PERCENTAGE} style={{ fontSize: 12 }}>%</Radio>
                    </Radio.Group>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Discount:</Text>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={discountAmount}
                      onChange={(value) => setDiscountAmount(value || 0)}
                      size="small"
                      placeholder="0"
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Payment:</Text>
                    <Select 
                      value={paymentMethod} 
                      onChange={setPaymentMethod}
                      style={{ width: '100%' }}
                      size="small"
                    >
                      <Option value={PaymentMethod.CASH}>💵 Cash</Option>
                      <Option value={PaymentMethod.CARD}>💳 Card</Option>
                      <Option value={PaymentMethod.CHEQUE}>📄 Cheque</Option>
                      <Option value={PaymentMethod.BANK_TRANSFER}>🏦 Transfer</Option>
                    </Select>
                  </div>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={12}>
                  <div>
                    <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Received Amount:</Text>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={receivedAmount}
                      onChange={(value) => setReceivedAmount(value || 0)}
                      size="small"
                      addonBefore="$"
                      placeholder="0.00"
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Change:</Text>
                    <div style={{ 
                      padding: '4px 11px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      backgroundColor: totals.changeAmount >= 0 ? '#f0f9ff' : '#fef2f2',
                      color: totals.changeAmount >= 0 ? '#059669' : '#dc2626',
                      fontWeight: 'bold',
                      fontSize: 14,
                      minHeight: 24
                    }}>
                      ${totals.changeAmount.toFixed(2)}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Complete Sale Button */}
            <Button
              type="primary"
              size="large"
              onClick={completeSale}
              loading={loading}
              disabled={selectedItems.length === 0}
              style={{ 
                width: '100%', 
                height: 56,
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderColor: 'transparent',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
              }}
              icon={<CalculatorOutlined />}
            >
              Complete Sale
            </Button>
          </Card>
        </div>

        {/* Right Column - Product Search (Compact) */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <Card
            style={{ 
              height: '100%',
              borderRadius: 16,
              border: 'none',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
            bodyStyle={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              padding: 24
            }}
          >
            {/* Search Header */}
            <div style={{ marginBottom: 20 }}>
              <Title level={4} style={{ 
                margin: '0 0 16px 0', 
                color: '#4338ca',
                textAlign: 'center'
              }}>
                🔍 Product Search
              </Title>
              <Space.Compact style={{ width: '100%' }} size="large">
                <Input
                  placeholder="Search products, SKU, or barcode..."
                  prefix={<SearchOutlined />}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  size="large"
                  style={{ 
                    borderRadius: '12px 0 0 12px',
                    border: '2px solid rgba(67, 56, 202, 0.3)',
                    fontSize: 16
                  }}
                />
                <Button 
                  icon={<QrcodeOutlined />} 
                  size="large"
                  style={{ 
                    borderRadius: '0 12px 12px 0',
                    border: '2px solid rgba(67, 56, 202, 0.3)',
                    borderLeft: 'none',
                    backgroundColor: 'rgba(67, 56, 202, 0.1)',
                    color: '#4338ca'
                  }}
                  title="Barcode Scanner (Coming Soon)"
                  disabled
                />
              </Space.Compact>
            </div>

            {/* Product Results */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {!searchValue ? (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#6b7280',
                  textAlign: 'center'
                }}>
                  <SearchOutlined style={{ fontSize: 80, marginBottom: 20, color: '#d1d5db' }} />
                  <Title level={4} type="secondary">Search to find products</Title>
                  <Text type="secondary">Type product name, SKU, or scan barcode</Text>
                </div>
              ) : productsForSaleQuery.isLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Text>🔄 Searching products...</Text>
                </div>
              ) : filteredVariants.length === 0 ? (
                <Empty 
                  description="No products found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredVariants.map((variant) => (
                    <Card
                      key={variant.id}
                      hoverable
                      style={{ 
                        borderRadius: 12,
                        border: '1px solid rgba(67, 56, 202, 0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      bodyStyle={{ padding: 16 }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                        {variant.image && (
                          <img
                            src={variant.image}
                            alt={variant.name}
                            style={{
                              width: 50,
                              height: 50,
                              objectFit: 'cover',
                              borderRadius: 8,
                              flexShrink: 0,
                              border: '2px solid rgba(67, 56, 202, 0.2)'
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14, color: '#1f2937' }}>
                            {variant.product_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                            {variant.name}
                          </Text>
                          <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 16 }}>
                            ${priceType === PriceType.WHOLESALE
                              ? variant.wholesale_price || variant.regular_price
                              : variant.regular_price}
                          </Text>
                        </div>
                      </div>
                      
                      {/* Batch Selection */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {variant.batches.map((batch) => (
                          <Button
                            key={batch.id}
                            size="small"
                            onClick={() => addToCart(variant, batch.id)}
                            style={{ 
                              background: 'linear-gradient(135deg, #4338ca, #5b21b6)',
                              borderColor: 'transparent',
                              color: 'white',
                              borderRadius: 8,
                              fontWeight: 'bold',
                              fontSize: 12,
                              padding: '4px 12px',
                              height: 'auto'
                            }}
                          >
                            {batch.batch_number}
                            <br />
                            <span style={{ fontSize: 10, opacity: 0.8 }}>({batch.quantity} left)</span>
                          </Button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Customer Modal */}
      <CustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreateCustomer={async (customer) => {
          try {
            const newCustomer = await post(endpoints.createCustomer, customer);
            setSelectedCustomer(newCustomer);
            setCustomers([...customers, newCustomer]);
            queryClient.invalidateQueries({ queryKey: [queryKeys.customers] });
            message.success("Customer created successfully");
          } catch (error) {
            message.error("Failed to create customer");
          }
        }}
      />
    </div>
  );
};

export default POSPage;
