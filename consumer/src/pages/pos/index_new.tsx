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
    <div className="pos-container">
      {/* Header */}
      <div className="pos-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            ← Back
          </button>
          <h1 className="pos-title">🛒 PosBuzz POS</h1>
          {selectedBranch && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(Number(e.target.value))}
              style={{
                minWidth: '200px',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {userBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  📍 {branch.name}
                </option>
              ))}
            </select>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setPriceType(priceType === PriceType.WHOLESALE ? PriceType.REGULAR : PriceType.WHOLESALE)}
            style={{
              padding: '8px 16px',
              background: priceType === PriceType.WHOLESALE ? '#2563eb' : '#f3f4f6',
              color: priceType === PriceType.WHOLESALE ? 'white' : '#1f2937',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            👤 {priceType === PriceType.WHOLESALE ? "Wholesale" : "Regular"} Pricing
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: '#2563eb',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px'
            }}>
              👤
            </div>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>{user?.name}</span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '16px'
              }}
            >
              🚪
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pos-main">
        {/* Left Panel - Product Search */}
        <div className="product-search-panel">
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Search products by name, SKU, or scan barcode..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <button className="scan-btn" disabled title="Scan Barcode (Coming Soon)">
              📷
            </button>
          </div>

          {/* Product Results */}
          <div className="products-grid">
            {!searchValue ? (
              <div className="no-search-state">
                <div className="no-search-icon">🔍</div>
                <div className="no-search-title">Start typing to search products</div>
                <div className="no-search-subtitle">Search by product name, SKU, or scan a barcode</div>
              </div>
            ) : productsForSaleQuery.isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div>Searching products...</div>
              </div>
            ) : filteredVariants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div>No products found</div>
              </div>
            ) : (
              filteredVariants.map((variant) => (
                <div key={variant.id} className="product-card">
                  <div className="product-info">
                    {variant.image && (
                      <img
                        src={variant.image}
                        alt={variant.name}
                        className="product-image"
                      />
                    )}
                    <div className="product-details">
                      <div className="product-name">{variant.product_name}</div>
                      <div className="product-variant">{variant.name}</div>
                      <div className="product-price">
                        ${priceType === PriceType.WHOLESALE
                          ? variant.wholesale_price || variant.regular_price
                          : variant.regular_price}
                      </div>
                    </div>
                    <div className="batch-buttons">
                      {variant.batches.map((batch) => (
                        <button
                          key={batch.id}
                          className="batch-btn"
                          onClick={() => addToCart(variant, batch.id)}
                        >
                          #{batch.batch_number} ({batch.quantity})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Cart & Checkout */}
        <div className="cart-panel">
          {/* Cart Header */}
          <div className="cart-header">
            <h3 className="cart-title">
              🛒 Cart ({selectedItems.reduce((sum, item) => sum + item.quantity, 0)} items)
            </h3>
            <button
              className="clear-btn"
              onClick={() => setSelectedItems([])}
              disabled={selectedItems.length === 0}
            >
              Clear
            </button>
          </div>

          {/* Cart Items */}
          <div className="cart-items">
            {selectedItems.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon">🛒</div>
                <div>Your cart is empty</div>
              </div>
            ) : (
              selectedItems.map((item) => (
                <div key={`${item.variant_id}-${item.batch_id}`} className="cart-item">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.variant_name}
                      className="cart-item-image"
                    />
                  )}
                  <div className="cart-item-details">
                    <div className="cart-item-name">{item.product_name}</div>
                    <div className="cart-item-price">
                      ${Number(item.unit_price).toFixed(2)} each
                    </div>
                  </div>
                  <div className="quantity-controls">
                    <button
                      className="qty-btn"
                      onClick={() => updateItemQuantity(item.variant_id, item.batch_id!, item.quantity - 1)}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      className="qty-input"
                      value={item.quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 1;
                        updateItemQuantity(item.variant_id, item.batch_id!, newQty);
                      }}
                      min="1"
                      max={item.available_stock}
                    />
                    <button
                      className="qty-btn"
                      onClick={() => updateItemQuantity(item.variant_id, item.batch_id!, item.quantity + 1)}
                      disabled={item.quantity >= item.available_stock}
                    >
                      +
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => removeItem(item.variant_id, item.batch_id!)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="cart-item-total">
                    <div className="item-total">
                      ${Number(item.line_total).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Transaction Details */}
          <div className="transaction-section">
            <h4 className="transaction-title">💳 Transaction Details</h4>
            
            {/* Customer Selection */}
            <div className="customer-selection">
              <select
                className="customer-select"
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find((c) => c.id === Number(e.target.value));
                  setSelectedCustomer(customer || null);
                }}
              >
                <option value="">Select Customer (Optional)</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.phone})
                  </option>
                ))}
              </select>
              <button
                className="add-customer-btn"
                onClick={() => setCustomerModalOpen(true)}
              >
                +
              </button>
            </div>

            {/* Discount Controls */}
            <div className="discount-controls">
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Discount Type
                </label>
                <div className="discount-type">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <input
                      type="radio"
                      className="discount-radio"
                      checked={discountType === DiscountType.FLAT}
                      onChange={() => setDiscountType(DiscountType.FLAT)}
                    />
                    Fixed
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <input
                      type="radio"
                      className="discount-radio"
                      checked={discountType === DiscountType.PERCENTAGE}
                      onChange={() => setDiscountType(DiscountType.PERCENTAGE)}
                    />
                    %
                  </label>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Discount Amount
                </label>
                <input
                  type="number"
                  className="discount-input"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  min="0"
                />
              </div>
            </div>

            {/* Payment Controls */}
            <div className="payment-controls">
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Payment Method
                </label>
                <select
                  className="payment-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value={PaymentMethod.CASH}>💵 Cash</option>
                  <option value={PaymentMethod.CARD}>💳 Card</option>
                  <option value={PaymentMethod.CHEQUE}>📄 Cheque</option>
                  <option value={PaymentMethod.BANK_TRANSFER}>🏦 Bank Transfer</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Received Amount
                </label>
                <input
                  type="number"
                  className="received-input"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(Number(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Totals Section */}
          <div className="totals-section">
            <div className="total-row">
              <span className="total-label">Subtotal:</span>
              <span className="total-value">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span className="total-label">Tax:</span>
              <span className="total-value">${totals.totalTax.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span className="total-label">Discount:</span>
              <span className="total-value">-${totals.finalDiscount.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span className="total-label">Shipping:</span>
              <span className="total-value">${totals.shippingCost.toFixed(2)}</span>
            </div>
            
            <div className="grand-total">
              <div className="total-row">
                <span className="total-label">Total:</span>
                <span className="total-value">${totals.total.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span className="total-label">Change:</span>
                <span className={`total-value change-amount ${totals.changeAmount < 0 ? 'negative' : ''}`}>
                  ${totals.changeAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Complete Sale Button */}
          <div className="complete-sale-section">
            <button
              className="complete-sale-btn"
              onClick={completeSale}
              disabled={selectedItems.length === 0 || loading}
            >
              {loading ? '⏳ Processing...' : '✅ Complete Sale'}
            </button>
          </div>
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
