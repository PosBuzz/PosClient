import {
  ArrowLeftOutlined,
  CalculatorOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MinusOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TagOutlined,
} from "@ant-design/icons";
import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Tag,
} from "antd";
import { useMemo, useState } from "react";
import { Money, takaPrefix } from "../../components/Currency";
import {
  Customer,
  DiscountType,
  PaymentMethod,
  PriceType,
  ProductVariantForSale,
  SaleItem,
  SalePayment,
} from "../../types/sale.types";
import {
  getPaymentProviderOptions,
  getPaymentProviderPlaceholder,
  paymentMethodRequiresProvider,
} from "../../utils/payment-provider.utils";
import "./RestaurantPosLayout.css";
import CompanyLogo from "../../components/CompanyLogo";

type StaffUser = { id: number; name: string };
type BranchOption = { id: number; name?: string };

type RestaurantPosLayoutProps = {
  companyName?: string;
  userName?: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBack: () => void;
  onOpenLayoutSettings: () => void;
  onOpenPromotions: () => void;
  promotionCount: number;
  selectedBranch: number | null;
  userBranches: BranchOption[];
  onBranchChange: (branchId: number) => void;
  customers: Customer[];
  selectedCustomer: Customer | null;
  onCustomerChange: (customerId?: number) => void;
  onCustomerSearch: (value: string) => void;
  onAddCustomer: () => void;
  servedByUsers: StaffUser[];
  selectedServedByUser: StaffUser | null;
  onServedByChange: (userId?: number) => void;
  priceType: PriceType;
  onPriceTypeChange: (priceType: PriceType) => void;
  averageDiscountType: DiscountType;
  onAverageDiscountTypeChange: (type: DiscountType) => void;
  products: ProductVariantForSale[];
  productsLoading: boolean;
  onProductSearch: (value: string) => void;
  onAddProduct: (variant: ProductVariantForSale) => void;
  selectedItems: SaleItem[];
  onUpdateQuantity: (variantId: number, quantity: number) => void;
  onUpdateSpecialDiscount: (variantId: number, amount: number) => void;
  specialDiscountMode: "overall" | "quantity";
  onSpecialDiscountModeChange: (mode: "overall" | "quantity") => void;
  onRemoveItem: (variantId: number) => void;
  appliedPromotions: Array<{ id: number; name: string }>;
  onRemovePromotion: (promotionId: number) => void;
  onClearPromotions: () => void;
  salePayments: SalePayment[];
  onSalePaymentsChange: (payments: SalePayment[]) => void;
  totals: {
    subtotal: number;
    totalTax: number;
    finalDiscount: number;
    specialDiscount: number;
    shippingCost: number;
    total: number;
    discountBreakdownByVariant?: Record<number, { total?: number }>;
  };
  loading: boolean;
  onCancel: () => void;
};

const PAYMENT_OPTIONS = [
  { value: PaymentMethod.CASH, label: "Cash" },
  { value: PaymentMethod.CARD, label: "Card" },
  { value: PaymentMethod.MFS, label: "MFS" },
  { value: PaymentMethod.MOBILE_MONEY, label: "Mobile Money" },
  { value: PaymentMethod.BANK_TRANSFER, label: "Bank Transfer" },
  { value: PaymentMethod.CHEQUE, label: "Cheque" },
  { value: PaymentMethod.CREDIT, label: "Credit" },
  { value: PaymentMethod.EXCHANGE, label: "Exchange" },
];

const RestaurantPosLayout = ({
  companyName,
  userName,
  isFullscreen,
  onToggleFullscreen,
  onBack,
  onOpenLayoutSettings,
  onOpenPromotions,
  promotionCount,
  selectedBranch,
  userBranches,
  onBranchChange,
  customers,
  selectedCustomer,
  onCustomerChange,
  onCustomerSearch,
  onAddCustomer,
  servedByUsers,
  selectedServedByUser,
  onServedByChange,
  priceType,
  onPriceTypeChange,
  averageDiscountType,
  onAverageDiscountTypeChange,
  products,
  productsLoading,
  onProductSearch,
  onAddProduct,
  selectedItems,
  onUpdateQuantity,
  onUpdateSpecialDiscount,
  specialDiscountMode,
  onSpecialDiscountModeChange,
  onRemoveItem,
  appliedPromotions,
  onRemovePromotion,
  onClearPromotions,
  salePayments,
  onSalePaymentsChange,
  totals,
  loading,
  onCancel,
}: RestaurantPosLayoutProps) => {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [serviceType, setServiceType] = useState("Dine in");

  const categories = useMemo(
    () =>
      [
        "All",
        ...Array.from(
          new Set(
            products.map((product) => product.category_name).filter(Boolean),
          ),
        ).sort(),
      ] as string[],
    [products],
  );

  const visibleProducts = useMemo(
    () =>
      selectedCategory === "All"
        ? products
        : products.filter(
            (product) => product.category_name === selectedCategory,
          ),
    [products, selectedCategory],
  );

  const itemCount = selectedItems.reduce(
    (count, item) => count + Number(item.quantity || 0),
    0,
  );

  const updatePayment = (index: number, patch: Partial<SalePayment>) => {
    const nextPayments = [...salePayments];
    nextPayments[index] = { ...nextPayments[index], ...patch };
    onSalePaymentsChange(nextPayments);
  };

  return (
    <div className="restaurant-pos">
      <section className="restaurant-pos__catalog">
        <header className="restaurant-pos__topbar">
          <div className="restaurant-pos__brand">
            <CompanyLogo size={42} />
            <div className="restaurant-pos__brand-copy">
              <div className="restaurant-pos__brand-name">
                {companyName || "PosBuzz"}
              </div>
              <div className="restaurant-pos__brand-kicker">Restaurant POS</div>
            </div>
          </div>

          <div className="restaurant-pos__search">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search menu or scan barcode..."
              onChange={(event) => {
                setSelectedCategory("All");
                onProductSearch(event.target.value);
              }}
            />
          </div>

          <div className="restaurant-pos__top-actions">
            <Button
              className="restaurant-pos__icon-button"
              aria-label="POS layout settings"
              title="POS layout settings"
              icon={<SettingOutlined />}
              onClick={onOpenLayoutSettings}
            />
            <Button
              className="restaurant-pos__icon-button"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              icon={
                isFullscreen ? (
                  <FullscreenExitOutlined />
                ) : (
                  <FullscreenOutlined />
                )
              }
              onClick={onToggleFullscreen}
            />
            <Button
              className="restaurant-pos__icon-button"
              aria-label="Back to dashboard"
              title="Back to dashboard"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
            />
          </div>
        </header>

        <div className="restaurant-pos__intro">
          <h1>Choose an item</h1>
          <p>
            {userName ? `Welcome back, ${userName}. ` : ""}
            Tap a menu item to add it to the current order.
          </p>
        </div>

        <nav
          className="restaurant-pos__categories"
          aria-label="Menu categories"
        >
          {categories.map((category) => (
            <Button
              key={category}
              className={`restaurant-pos__category ${
                selectedCategory === category
                  ? "restaurant-pos__category--active"
                  : ""
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </nav>

        <div className="restaurant-pos__products" aria-busy={productsLoading}>
          {visibleProducts.map((product) => {
            const price =
              priceType === PriceType.WHOLESALE
                ? product.wholesale_price || product.regular_price
                : product.regular_price;
            return (
              <article
                key={product.id}
                className="restaurant-pos__product"
                role="button"
                tabIndex={0}
                aria-label={`Add ${product.product_name} ${product.name}`}
                onClick={() => onAddProduct(product)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onAddProduct(product);
                  }
                }}
              >
                {product.image ? (
                  <img
                    className="restaurant-pos__product-image"
                    src={product.image}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="restaurant-pos__product-placeholder">
                    <ShoppingCartOutlined />
                  </div>
                )}
                <span className="restaurant-pos__product-add">
                  <PlusOutlined />
                </span>
                <div className="restaurant-pos__product-body">
                  <div className="restaurant-pos__product-name">
                    {product.product_name}
                  </div>
                  <div className="restaurant-pos__product-meta">
                    <span className="restaurant-pos__product-variant">
                      {product.name}
                    </span>
                    <span className="restaurant-pos__product-price">
                      <Money value={price} />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}

          {!productsLoading && visibleProducts.length === 0 && (
            <div className="restaurant-pos__empty-products">
              <div>
                <ShoppingCartOutlined
                  style={{ fontSize: 34, marginBottom: 10 }}
                />
                <div>No available items found.</div>
                {!selectedBranch && (
                  <small>Select a branch in order options.</small>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="restaurant-pos__order">
        <div className="restaurant-pos__order-header">
          <div className="restaurant-pos__order-heading">
            <div>
              <h2>Current order</h2>
              <span className="restaurant-pos__order-number">
                {itemCount} {itemCount === 1 ? "item" : "items"}
                {selectedCustomer ? ` • ${selectedCustomer.name}` : ""}
              </span>
            </div>
            <div className="restaurant-pos__order-actions">
              <Button
                icon={<TagOutlined />}
                onClick={onOpenPromotions}
                disabled={!selectedBranch}
              >
                {promotionCount}
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setOptionsOpen(true)}
              >
                Options
              </Button>
            </div>
          </div>
          <div className="restaurant-pos__service-type" aria-label="Order type">
            {["Dine in", "Takeaway", "Delivery"].map((type) => (
              <button
                key={type}
                type="button"
                className={serviceType === type ? "is-active" : ""}
                onClick={() => setServiceType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="restaurant-pos__items">
          {selectedItems.length === 0 ? (
            <div className="restaurant-pos__empty-cart">
              <div>
                <div className="restaurant-pos__empty-cart-icon">
                  <ShoppingCartOutlined />
                </div>
                <strong>Your order is empty</strong>
                <div style={{ fontSize: 12, marginTop: 5 }}>
                  Select an item from the menu to begin.
                </div>
              </div>
            </div>
          ) : (
            selectedItems.map((item) => {
              const itemDiscount =
                totals.discountBreakdownByVariant?.[item.variant_id]?.total ||
                0;
              const lineTotal = Math.max(
                0,
                Number(item.line_total || 0) - Number(itemDiscount),
              );
              return (
                <div className="restaurant-pos__line" key={item.variant_id}>
                  {item.image ? (
                    <img
                      className="restaurant-pos__line-image"
                      src={item.image}
                      alt=""
                    />
                  ) : (
                    <div className="restaurant-pos__line-placeholder">
                      <ShoppingCartOutlined />
                    </div>
                  )}
                  <div className="restaurant-pos__line-info">
                    <div className="restaurant-pos__line-name">
                      {item.product_name}
                    </div>
                    <div className="restaurant-pos__line-variant">
                      {item.variant_name} • <Money value={item.unit_price} />
                    </div>
                    <div className="restaurant-pos__qty">
                      <Button
                        icon={<MinusOutlined />}
                        aria-label={`Decrease ${item.product_name}`}
                        onClick={() =>
                          onUpdateQuantity(item.variant_id, item.quantity - 1)
                        }
                      />
                      <span className="restaurant-pos__qty-value">
                        {item.quantity}
                      </span>
                      <Button
                        icon={<PlusOutlined />}
                        aria-label={`Increase ${item.product_name}`}
                        onClick={() =>
                          onUpdateQuantity(item.variant_id, item.quantity + 1)
                        }
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={`Remove ${item.product_name}`}
                        onClick={() => onRemoveItem(item.variant_id)}
                      />
                    </div>
                    <InputNumber
                      min={0}
                      precision={2}
                      size="small"
                      addonBefore="Disc"
                      value={
                        specialDiscountMode === "quantity"
                          ? (Number(item.special_discount_amount) || 0) /
                            Math.max(1, Number(item.quantity) || 1)
                          : Number(item.special_discount_amount) || 0
                      }
                      onChange={(value) =>
                        onUpdateSpecialDiscount(
                          item.variant_id,
                          Number(value) || 0,
                        )
                      }
                      style={{ width: 150, marginTop: 6 }}
                    />
                  </div>
                  <div className="restaurant-pos__line-total">
                    <Money value={lineTotal} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="restaurant-pos__summary">
          <div className="restaurant-pos__summary-row">
            <span>Subtotal</span>
            <strong>
              <Money value={totals.subtotal} />
            </strong>
          </div>
          <div className="restaurant-pos__summary-row">
            <span>Tax</span>
            <strong>
              <Money value={totals.totalTax} />
            </strong>
          </div>
          {totals.finalDiscount > 0 && (
            <div className="restaurant-pos__summary-row">
              <span>Discount</span>
              <strong>
                -<Money value={totals.finalDiscount} />
              </strong>
            </div>
          )}
          {totals.shippingCost > 0 && (
            <div className="restaurant-pos__summary-row">
              <span>Delivery / shipping</span>
              <strong>
                <Money value={totals.shippingCost} />
              </strong>
            </div>
          )}
          <div className="restaurant-pos__summary-total">
            <span>Total</span>
            <strong>
              <Money value={totals.total} />
            </strong>
          </div>
          <Button
            className="restaurant-pos__checkout"
            type="primary"
            htmlType="submit"
            size="large"
            disabled={selectedItems.length === 0 || loading}
            loading={loading}
            block
          >
            <span>
              <CalculatorOutlined /> Checkout
            </span>
            <span>
              <Money value={totals.total} /> →
            </span>
          </Button>
        </div>
      </aside>

      <Drawer
        title="Order options"
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        width={460}
      >
        <div className="restaurant-pos__drawer-section">
          <div className="restaurant-pos__drawer-title">Order details</div>
          <Form.Item
            label="Branch"
            name="branch_id"
            rules={[{ required: true, message: "Select branch" }]}
          >
            <Select
              placeholder="Select branch"
              value={selectedBranch || undefined}
              onChange={onBranchChange}
              options={userBranches.map((branch) => ({
                value: branch.id,
                label: branch.name || `Branch ${branch.id}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Customer" name="customer_id">
            <Space.Compact style={{ width: "100%" }}>
              <Select
                showSearch
                allowClear
                placeholder="Walk-in customer"
                value={selectedCustomer?.id}
                onChange={onCustomerChange}
                onSearch={onCustomerSearch}
                onClear={() => onCustomerSearch("")}
                filterOption={false}
                style={{ width: "calc(100% - 42px)" }}
                options={customers.map((customer) => ({
                  value: customer.id,
                  label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ""}`,
                }))}
              />
              <Button icon={<PlusOutlined />} onClick={onAddCustomer} />
            </Space.Compact>
          </Form.Item>
          <Row gutter={10}>
            <Col span={14}>
              <Form.Item label="Served by" name="served_by_id">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select staff"
                  value={selectedServedByUser?.id}
                  onChange={onServedByChange}
                  optionFilterProp="label"
                  options={servedByUsers.map((staff) => ({
                    value: staff.id,
                    label: staff.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Pricing">
                <Select
                  value={priceType}
                  onChange={onPriceTypeChange}
                  options={[
                    { value: PriceType.REGULAR, label: "Retail" },
                    { value: PriceType.WHOLESALE, label: "Wholesale" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="restaurant-pos__drawer-section">
          <div className="restaurant-pos__drawer-title">
            Discounts & charges
          </div>
          <Space size={8} style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12 }}>Special discount</span>
            <Radio.Group
              size="small"
              optionType="button"
              buttonStyle="solid"
              value={specialDiscountMode}
              onChange={(event) =>
                onSpecialDiscountModeChange(event.target.value)
              }
              options={[
                { label: "Overall", value: "overall" },
                { label: "Per quantity", value: "quantity" },
              ]}
            />
            <strong style={{ fontSize: 12 }}>
              Total: <Money value={totals.specialDiscount} negative />
            </strong>
          </Space>
          {appliedPromotions.length > 0 && (
            <Space wrap style={{ marginBottom: 12 }}>
              {appliedPromotions.map((promotion) => (
                <Tag
                  key={promotion.id}
                  color="orange"
                  closable
                  onClose={(event) => {
                    event.preventDefault();
                    onRemovePromotion(promotion.id);
                  }}
                >
                  {promotion.name}
                </Tag>
              ))}
              <Button type="link" size="small" onClick={onClearPromotions}>
                Clear all
              </Button>
            </Space>
          )}
          <Radio.Group
            value={averageDiscountType}
            onChange={(event) =>
              onAverageDiscountTypeChange(event.target.value)
            }
            style={{ marginBottom: 12 }}
          >
            <Radio.Button value={DiscountType.FLAT}>Fixed</Radio.Button>
            <Radio.Button value={DiscountType.PERCENTAGE}>
              Percentage
            </Radio.Button>
          </Radio.Group>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item label="Order discount" name="average_discount_amount">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  prefix={
                    averageDiscountType === DiscountType.PERCENTAGE
                      ? "%"
                      : takaPrefix
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Shipping cost" name="shipping_cost">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  prefix={takaPrefix}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Order notes"
            name="notes"
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={2} placeholder="Kitchen or sale notes..." />
          </Form.Item>
        </div>

        <div className="restaurant-pos__drawer-section">
          <div className="restaurant-pos__drawer-title">
            <CreditCardOutlined /> Payments
          </div>
          <Space direction="vertical" style={{ width: "100%" }}>
            {salePayments.map((payment, index) => {
              const requiresProvider = paymentMethodRequiresProvider(
                payment.payment_method,
              );
              return (
                <div
                  key={index}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: "transparent",
                  }}
                >
                  <Row gutter={[8, 8]}>
                    <Col span={requiresProvider ? 12 : 24}>
                      <Select
                        value={payment.payment_method}
                        onChange={(value) =>
                          updatePayment(index, {
                            payment_method: value,
                            payment_type: undefined,
                          })
                        }
                        options={PAYMENT_OPTIONS}
                        style={{ width: "100%" }}
                      />
                    </Col>
                    {requiresProvider && (
                      <Col span={12}>
                        <Select
                          showSearch
                          allowClear
                          placeholder={getPaymentProviderPlaceholder(
                            payment.payment_method,
                          )}
                          value={payment.payment_type}
                          onChange={(value) =>
                            updatePayment(index, { payment_type: value })
                          }
                          options={getPaymentProviderOptions(
                            payment.payment_method,
                          )}
                          style={{ width: "100%" }}
                        />
                      </Col>
                    )}
                    <Col span={11}>
                      <InputNumber
                        min={0}
                        precision={2}
                        prefix={takaPrefix}
                        value={payment.amount}
                        onChange={(value) =>
                          updatePayment(index, { amount: Number(value) || 0 })
                        }
                        style={{ width: "100%" }}
                      />
                    </Col>
                    <Col span={11}>
                      <Input
                        placeholder="Reference"
                        value={payment.reference}
                        onChange={(event) =>
                          updatePayment(index, {
                            reference: event.target.value,
                          })
                        }
                      />
                    </Col>
                    <Col span={2}>
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        aria-label="Remove payment"
                        onClick={() =>
                          onSalePaymentsChange(
                            salePayments.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      />
                    </Col>
                  </Row>
                </div>
              );
            })}
            <Button
              block
              icon={<PlusOutlined />}
              onClick={() =>
                onSalePaymentsChange([
                  ...salePayments,
                  {
                    payment_method: PaymentMethod.CASH,
                    amount: Math.max(
                      0,
                      totals.total -
                        salePayments.reduce(
                          (sum, payment) => sum + Number(payment.amount || 0),
                          0,
                        ),
                    ),
                    reference: "",
                  },
                ])
              }
            >
              Add split payment
            </Button>
          </Space>
        </div>

        <Button
          danger
          block
          disabled={selectedItems.length === 0}
          onClick={() => {
            onCancel();
            setOptionsOpen(false);
          }}
        >
          Cancel order
        </Button>
      </Drawer>
    </div>
  );
};

export default RestaurantPosLayout;
