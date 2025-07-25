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
  SalePayment,
  SaleType,
} from "../../types/sale.types";
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
  const [filteredVariants, setFilteredVariants] = useState<
    ProductVariantForSale[]
  >([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [discountType, setDiscountType] = useState<DiscountType>(
    DiscountType.FLAT
  );
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState(0);
  const [currentPaymentReference, setCurrentPaymentReference] = useState("");
  const [paymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [notes, setNotes] = useState("");
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
    queryFn: () =>
      salesApi.getProductsForSale(selectedBranch!, debouncedSearchValue),
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
                  ((item.quantity + 1) *
                    price *
                    (Number(variant.tax_percentage) || 0)) /
                  100,
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

  const updateItemQuantity = (
    variantId: number,
    batchId: number,
    quantity: number
  ) => {
    if (quantity <= 0) {
      removeItem(variantId, batchId);
      return;
    }

    // Check batch quantity limit
    const currentItem = selectedItems.find(
      (item) => item.variant_id === variantId && item.batch_id === batchId
    );
    if (currentItem && quantity > currentItem.available_stock) {
      message.warning(
        `Cannot exceed available stock of ${currentItem.available_stock} units`
      );
      return;
    }

    setSelectedItems((items) =>
      items.map((item) =>
        item.variant_id === variantId && item.batch_id === batchId
          ? {
              ...item,
              quantity,
              tax_amount:
                (quantity *
                  Number(item.unit_price) *
                  (Number(item.tax_percentage) || 0)) /
                100,
              line_total: quantity * Number(item.unit_price),
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

  // Payment management functions
  const addPayment = () => {
    if (currentPaymentAmount <= 0) {
      message.error("Please enter a valid payment amount");
      return;
    }

    const totals = calculateTotals();
    const currentTotalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    
    if (currentTotalPaid + currentPaymentAmount > totals.total) {
      message.warning("Payment amount exceeds the remaining balance");
      return;
    }

    const newPayment: SalePayment = {
      payment_method: currentPaymentMethod,
      amount: currentPaymentAmount,
      reference: currentPaymentReference || undefined,
    };

    setPayments([...payments, newPayment]);
    setCurrentPaymentAmount(0);
    setCurrentPaymentReference("");
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    const labels = {
      CASH: "Cash",
      CARD: "Card", 
      BANK_TRANSFER: "Bank Transfer",
      CHEQUE: "Cheque",
      MOBILE_MONEY: "Mobile Money",
      MFS: "MFS",
      DEPOSIT: "Deposit",
      CREDIT: "Credit",
    };
    return labels[method] || method;
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce(
      (sum, item) => sum + (Number(item.line_total) || 0),
      0
    );
    const totalTax = selectedItems.reduce(
      (sum, item) => sum + (Number(item.tax_amount) || 0),
      0
    );

    const finalDiscount =
      discountType === DiscountType.PERCENTAGE
        ? (subtotal * discountAmount) / 100
        : discountAmount;

    // For tax-inclusive pricing, don't add tax again
    const total = subtotal - finalDiscount + shippingCost;
    const totalPaid = getTotalPaid();
    const changeAmount = totalPaid - total;

    return {
      subtotal: Number(subtotal),
      totalTax: Number(totalTax),
      finalDiscount: Number(finalDiscount),
      shippingCost: Number(shippingCost),
      total: Number(total),
      totalPaid: Number(totalPaid),
      changeAmount: Number(changeAmount),
    };
  };

  const completeSale = async () => {
    if (selectedItems.length === 0) {
      message.error("Please add at least one item to the cart");
      return;
    }

    if (payments.length === 0) {
      message.error("Please add at least one payment method");
      return;
    }

    const totals = calculateTotals();

    if (totals.totalPaid < totals.total) {
      message.error(`Insufficient payment. Total: $${totals.total.toFixed(2)}, Paid: $${totals.totalPaid.toFixed(2)}`);
      return;
    }

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
      payment_status: paymentStatus,
      received_amount: totals.totalPaid,
      sale_type: SaleType.SALE,
      payments: payments,
    };

    try {
      setLoading(true);
      await salesApi.createSale(saleData);

      queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.batch] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.inventorySummary] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.lowStockItems] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.stockByVariant] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.variantStock] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.movementHistory] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.expiringBatches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.products] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.product] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.productVariants] });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.productsForInventory],
      });
      queryClient.invalidateQueries({ queryKey: [queryKeys.productsForSale] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.sales] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.sale] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.salesStats] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.eod] });

      message.success("Sale completed successfully!");

      // Reset everything
      setSelectedItems([]);
      setSelectedCustomer(null);
      setDiscountAmount(0);
      setShippingCost(0);
      setPayments([]);
      setCurrentPaymentAmount(0);
      setCurrentPaymentReference("");
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
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              padding: "8px",
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
                minWidth: "200px",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
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

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() =>
              setPriceType(
                priceType === PriceType.WHOLESALE
                  ? PriceType.REGULAR
                  : PriceType.WHOLESALE
              )
            }
            style={{
              padding: "8px 16px",
              background:
                priceType === PriceType.WHOLESALE ? "#2563eb" : "#f3f4f6",
              color: priceType === PriceType.WHOLESALE ? "white" : "#1f2937",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            👤 {priceType === PriceType.WHOLESALE ? "Wholesale" : "Regular"}{" "}
            Pricing
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "#2563eb",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "14px",
              }}
            >
              👤
            </div>
            <span style={{ fontWeight: "600", color: "#1f2937" }}>
              {user?.name}
            </span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                padding: "4px",
                fontSize: "16px",
              }}
            >
              🚪
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pos-main">
        {/* Left Panel - Compact Product Search */}
        <div className="product-search-panel">
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search products..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <button
              className="scan-btn"
              disabled
              title="Scan Barcode (Coming Soon)"
            >
              📷
            </button>
          </div>

          {/* Product Results */}
          <div className="products-grid">
            {!searchValue ? (
              <div className="no-search-state">
                <div className="no-search-icon">�️</div>
                <div className="no-search-title">Search to add products</div>
                <div className="no-search-subtitle">
                  Type product name or SKU
                </div>
              </div>
            ) : productsForSaleQuery.isLoading ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <div>⏳ Searching...</div>
              </div>
            ) : filteredVariants.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <div>❌ No products found</div>
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
                        💰 $
                        {priceType === PriceType.WHOLESALE
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

        {/* Right Panel - Main Cart & Checkout Area */}
        <div className="main-panel">
          {/* Shopping Cart - Most Prominent */}
          <div className="shopping-cart">
            <div className="cart-header">
              <h2 className="cart-title">
                🛒 Shopping Cart (
                {selectedItems.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                items)
              </h2>
              <button
                className="clear-btn"
                onClick={() => setSelectedItems([])}
                disabled={selectedItems.length === 0}
              >
                🗑️ Clear All
              </button>
            </div>

            {/* Cart Items - Prominent Display */}
            <div className="cart-items">
              {selectedItems.length === 0 ? (
                <div className="empty-cart">
                  <div className="empty-cart-icon">🛒</div>
                  <div className="empty-cart-text">Cart is empty</div>
                  <div className="empty-cart-hint">
                    Search and add products to get started
                  </div>
                </div>
              ) : (
                selectedItems.map((item) => (
                  <div
                    key={`${item.variant_id}-${item.batch_id}`}
                    className="cart-item"
                  >
                    <div className="cart-item-left">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.variant_name}
                          className="cart-item-image"
                        />
                      )}
                      <div className="cart-item-info">
                        <div className="cart-item-name">
                          {item.product_name}
                        </div>
                        <div className="cart-item-variant">
                          {item.variant_name}
                        </div>
                      </div>
                    </div>

                    <div className="cart-item-center">
                      <div className="cart-item-price">
                        💰 ${Number(item.unit_price).toFixed(2)} each
                      </div>
                      <div className="cart-item-batch">
                        📦 Batch #{item.batch_number}
                      </div>
                    </div>

                    <div className="cart-item-right">
                      <div className="quantity-controls">
                        <button
                          className="qty-btn"
                          onClick={() =>
                            updateItemQuantity(
                              item.variant_id,
                              item.batch_id!,
                              item.quantity - 1
                            )
                          }
                        >
                          ➖
                        </button>
                        <input
                          type="number"
                          className="qty-input"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 1;
                            updateItemQuantity(
                              item.variant_id,
                              item.batch_id!,
                              newQty
                            );
                          }}
                          min="1"
                          max={item.available_stock}
                        />
                        <button
                          className="qty-btn"
                          onClick={() =>
                            updateItemQuantity(
                              item.variant_id,
                              item.batch_id!,
                              item.quantity + 1
                            )
                          }
                          disabled={item.quantity >= item.available_stock}
                        >
                          ➕
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() =>
                            removeItem(item.variant_id, item.batch_id!)
                          }
                          title="Remove item"
                        >
                          🗑️
                        </button>
                      </div>
                      <div className="cart-item-total">
                        <div className="item-subtotal">
                          ${Number(item.line_total).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transaction Details & Checkout */}
          <div className="checkout-section">
            <div className="checkout-layout">
              {/* Left Side - Input Fields */}
              <div className="inputs-panel">
                <h4 className="section-title">Transaction Details</h4>

                {/* Row 1: Customer & Payment Method */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="input-label">Customer</label>
                    <div className="customer-selection">
                      <select
                        className="form-input"
                        value={selectedCustomer?.id || ""}
                        onChange={(e) => {
                          const customer = customers.find(
                            (c) => c.id === Number(e.target.value)
                          );
                          setSelectedCustomer(customer || null);
                        }}
                      >
                        <option value="">Walk-in Customer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} ({customer.phone})
                          </option>
                        ))}
                      </select>
                      <button
                        className="add-btn"
                        onClick={() => setCustomerModalOpen(true)}
                        title="Add Customer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="input-label">Payment Method</label>
                    <select
                      className="form-input"
                      value={currentPaymentMethod}
                      onChange={(e) =>
                        setCurrentPaymentMethod(e.target.value as PaymentMethod)
                      }
                    >
                      <option value={PaymentMethod.CASH}>Cash</option>
                      <option value={PaymentMethod.CARD}>Card</option>
                      <option value={PaymentMethod.CHEQUE}>Cheque</option>
                      <option value={PaymentMethod.BANK_TRANSFER}>
                        Bank Transfer
                      </option>
                      <option value={PaymentMethod.MOBILE_MONEY}>
                        Mobile Money
                      </option>
                      <option value={PaymentMethod.MFS}>MFS</option>
                      <option value={PaymentMethod.DEPOSIT}>Deposit</option>
                      <option value={PaymentMethod.CREDIT}>Credit</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Payment Amount & Reference */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="input-label">Payment Amount</label>
                    <input
                      type="number"
                      className="form-input"
                      value={currentPaymentAmount}
                      onChange={(e) =>
                        setCurrentPaymentAmount(Number(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="input-label">Reference (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={currentPaymentReference}
                      onChange={(e) => setCurrentPaymentReference(e.target.value)}
                      placeholder="Transaction reference..."
                    />
                  </div>
                </div>

                {/* Add Payment Button */}
                <div className="form-row">
                  <button
                    type="button"
                    onClick={addPayment}
                    className="add-payment-btn"
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    ➕ Add Payment
                  </button>
                </div>

                {/* Payment List */}
                {payments.length > 0 && (
                  <div className="form-row">
                    <div className="form-group full-width">
                      <label className="input-label">Added Payments</label>
                      <div style={{ 
                        border: "1px solid #d1d5db", 
                        borderRadius: "6px", 
                        padding: "8px",
                        backgroundColor: "#f9fafb"
                      }}>
                        {payments.map((payment, index) => (
                          <div key={index} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "4px 8px",
                            marginBottom: "4px",
                            backgroundColor: "white",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}>
                            <span>
                              <strong>{getPaymentMethodLabel(payment.payment_method)}</strong>
                              {payment.reference && ` (${payment.reference})`}
                            </span>
                            <div>
                              <span style={{ marginRight: "8px" }}>
                                ${payment.amount.toFixed(2)}
                              </span>
                              <button
                                onClick={() => removePayment(index)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#ef4444",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 3: Discount */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="input-label">Discount</label>
                    <div className="discount-row">
                      <select
                        className="discount-type-select"
                        value={discountType}
                        onChange={(e) =>
                          setDiscountType(e.target.value as DiscountType)
                        }
                      >
                        <option value={DiscountType.FLAT}>Fixed ($)</option>
                        <option value={DiscountType.PERCENTAGE}>
                          Percent (%)
                        </option>
                      </select>
                      <input
                        type="number"
                        className="discount-amount-input"
                        value={discountAmount}
                        onChange={(e) =>
                          setDiscountAmount(Number(e.target.value) || 0)
                        }
                        min="0"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Notes */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label className="input-label">Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional transaction notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Right Side - Calculation Summary */}
              <div className="summary-panel">
                <h4 className="section-title">Payment Summary</h4>
                <div className="totals-display">
                  <div className="total-row">
                    <span className="total-label">Subtotal (inc. tax):</span>
                    <span className="total-value">
                      ${totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="total-row">
                    <span className="total-label">Tax (included):</span>
                    <span className="total-value" style={{ fontSize: "12px", color: "#666" }}>
                      ${totals.totalTax.toFixed(2)}
                    </span>
                  </div>
                  <div className="total-row">
                    <span className="total-label">Discount:</span>
                    <span className="total-value discount">
                      -${totals.finalDiscount.toFixed(2)}
                    </span>
                  </div>

                  <div className="grand-total">
                    <div className="total-row">
                      <span className="total-label">TOTAL:</span>
                      <span className="total-value grand">
                        ${totals.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="total-row">
                      <span className="total-label">Total Paid:</span>
                      <span className="total-value" style={{ color: "#52c41a" }}>
                        ${totals.totalPaid.toFixed(2)}
                      </span>
                    </div>
                    <div className="total-row">
                      <span className="total-label">Change:</span>
                      <span
                        className={`total-value change ${
                          totals.changeAmount < 0 ? "negative" : "positive"
                        }`}
                      >
                        ${totals.changeAmount.toFixed(2)}
                      </span>
                    </div>
                    
                    {/* Payment Status Indicator */}
                    <div className="total-row" style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #e5e7eb" }}>
                      <span className="total-label">Status:</span>
                      <span 
                        className="total-value"
                        style={{ 
                          color: totals.totalPaid >= totals.total ? "#52c41a" : "#ef4444",
                          fontWeight: "bold"
                        }}
                      >
                        {totals.totalPaid >= totals.total ? "✅ PAID" : "❌ INSUFFICIENT"}
                      </span>
                    </div>
                  </div>
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
                {loading ? "⏳ Processing Sale..." : "✅ COMPLETE SALE"}
              </button>
            </div>
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
