import { formatCurrency } from "../../utils/formatters";
import {
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { TagOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Col,
  Divider,
  Drawer,
  FloatButton,
  Form,
  Input,
  InputNumber,
  List,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { salesApi } from "../../api/sales-api";
import CustomerModal from "../../components/CustomerModal";
import { Money } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import {
  DiscountType,
  PriceType,
  ProductVariantForSale,
  SaleFormData,
  SaleItem,
} from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";
import {
  calculateTaxAndTotal,
  getVariantPriceForSale,
  removeSaleItem,
  updateSaleItemQuantity,
  updateSaleItemSpecialDiscount,
  upsertVariantInSaleItems as upsertSaleItemVariant,
} from "../../utils/sale-item.utils";
import { calculateSaleTotals } from "../../utils/calculate-totals.utils";
import { usePromotionManager } from "../../hooks/usePromotionManager";
import { useSaleManager } from "../../hooks/useSaleManager";
import { getProductVariantSearchLabel } from "../../utils/product-search.utils";

const { Option } = Select;
const { Text } = Typography;

const NewQuotation = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();
  const [searchParams] = useSearchParams();

  // Get copy_from parameter if copying an existing quotation
  const copyFromId = searchParams.get("copy_from");

  // Watch form values for real-time calculations
  const averageDiscountAmount =
    Form.useWatch("average_discount_amount", form) || 0;
  const shippingCost = Form.useWatch("shipping_cost", form) || 0;

  const {
    selectedItems,
    setSelectedItems,
    customers,
    setCustomers,
    servedByUsers,
    filteredVariants,
    setProductSearch,
    selectedBranch,
    setSelectedBranch,
    selectedCustomer,
    setSelectedCustomer,
    selectedServedByUser,
    setSelectedServedByUser,
    customerModalOpen,
    setCustomerModalOpen,
    priceType,
    setPriceType,
    averageDiscountType,
    setAverageDiscountType,
    loading,
    setLoading,
    userBranches,
    productsForSaleQuery,
    activePromotionsQuery,
    handleBranchChange: handleBranchChangeFromManager,
  } = useSaleManager({ form, user });

  const isHydratingFromCopyRef = useRef(false);
  const hasManualCartMutationRef = useRef(!copyFromId);

  useEffect(() => {
    hasManualCartMutationRef.current = !copyFromId;
  }, [copyFromId]);

  // Load quotation to copy if copy_from is provided
  const copyFromQuotationQuery = useQuery({
    queryKey: [queryKeys.quotation, parseInt(copyFromId || "0")],
    queryFn: () => salesApi.getQuotation(parseInt(copyFromId!)),
    enabled: !!copyFromId,
    staleTime: 0,
  });

  const upsertFn = (
    items: SaleItem[],
    variant: ProductVariantForSale,
    qty: number,
  ) =>
    upsertSaleItemVariant({
      sourceItems: items,
      variant,
      quantityToAdd: qty,
      priceType,
    });

  const getVariantPriceFn = (variant: ProductVariantForSale) =>
    getVariantPriceForSale(variant, priceType);

  const {
    appliedPromotions,
    setAppliedPromotions,
    applyingPromotionId,
    promotionEligibilityMap,
    promotionDrawerOpen,
    setPromotionDrawerOpen,
    evaluatePromotionForItems,
    removeAppliedPromotion,
    clearAppliedPromotions,
    applyPromotion: applyPromotionToCurrentQuotation,
  } = usePromotionManager({
    selectedItems,
    selectedBranch,
    selectedCustomer,
    filteredVariants,
    activePromotionsQuery,
    setSelectedItems,
    upsertFn,
    getVariantPriceFn,
    messageApi: messageApi || null,
    shouldSkipAutoApply: () => {
      if (isHydratingFromCopyRef.current) return true;
      if (copyFromId && !hasManualCartMutationRef.current) return true;
      return false;
    },
  });

  // Set initial page title
  useEffect(() => {
    if (copyFromId && copyFromQuotationQuery.data) {
      setPageTitle("Copy Quotation");
    } else {
      setPageTitle("New Quotation");
    }
  }, [copyFromId, copyFromQuotationQuery.data]);

  // Populate form when copying from existing quotation
  useEffect(() => {
    if (copyFromQuotationQuery.data) {
      const quotation = copyFromQuotationQuery.data;

      if (selectedBranch !== quotation.branch_id) {
        form.setFieldsValue({ branch_id: quotation.branch_id });
        setSelectedBranch(quotation.branch_id);
        return;
      }

      isHydratingFromCopyRef.current = true;

      const copyAverageDiscountTotal = (quotation.items || []).reduce(
        (sum: number, item: any) =>
          sum + Number(item.average_discount_amount || 0),
        0,
      );
      const copyRawBaseSubtotal = (quotation.items || []).reduce(
        (sum: number, item: any) =>
          sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
        0,
      );
      const copyAverageDiscountValue =
        quotation.discount_type === "percentage" && copyRawBaseSubtotal > 0
          ? (copyAverageDiscountTotal / copyRawBaseSubtotal) * 100
          : copyAverageDiscountTotal;

      form.setFieldsValue({
        branch_id: quotation.branch_id,
        customer_id: quotation.customer_id,
        customer_name: quotation.customer_name,
        customer_phone: quotation.customer_phone,
        customer_email: quotation.customer_email,
        served_by_id: quotation.served_by_id,
        price_type: quotation.price_type,
        average_discount_amount: copyAverageDiscountValue,
        shipping_cost: Number(quotation.shipping_cost),
        notes: quotation.notes,
      });

      setPriceType(quotation.price_type as PriceType);
      setAverageDiscountType(
        (quotation.discount_type as DiscountType) || DiscountType.FLAT,
      );

      if (quotation.customer) {
        setSelectedCustomer(quotation.customer);
      }

      if (quotation.served_by) {
        setSelectedServedByUser(quotation.served_by);
      }

      // Set items using shared upsert utility
      const items: SaleItem[] = (quotation.items || []).map((item: any) => {
        const currentVariant = productsForSaleQuery.data?.find(
          (variant) => variant.id === item.variant_id,
        );

        const regularPrice = Number(
          currentVariant?.regular_price ?? item.variant?.regular_price ?? 0,
        );
        const wholesalePriceValue =
          currentVariant?.wholesale_price ?? item.variant?.wholesale_price;
        const wholesalePrice =
          wholesalePriceValue !== undefined && wholesalePriceValue !== null
            ? Number(wholesalePriceValue)
            : undefined;

        const baseUnitPrice =
          quotation.price_type === PriceType.WHOLESALE
            ? wholesalePrice || regularPrice
            : regularPrice;

        const quantity = Number(item.quantity || 0);
        const taxPercentage = Number(currentVariant?.tax_percentage || 0);
        const taxMethod = String(
          currentVariant?.tax_method ||
            item.variant?.product?.tax_method ||
            "EXCLUSIVE",
        ).toUpperCase();

        const { tax_amount: taxAmount, line_total: lineTotal } =
          calculateTaxAndTotal(
            Number(baseUnitPrice) || 0,
            quantity,
            taxPercentage,
            taxMethod,
          );

        return {
          variant_id: item.variant_id,
          variant_name: item.variant?.name || "",
          variant_sku: item.variant?.sku,
          quantity,
          unit_price: Number(baseUnitPrice) || 0,
          average_discount_amount: Number(item.average_discount_amount || 0),
          special_discount_amount: Number(item.special_discount_amount || 0),
          promotion_discount_amount: Number(
            item.promotion_discount_amount || 0,
          ),
          applied_promotion_id: item.applied_promotion_id || undefined,
          tax_amount: Number(taxAmount) || 0,
          line_total: Number(lineTotal) || 0,
          product_name:
            item.variant?.product_name || item.variant?.product?.name || "",
          regular_price: regularPrice,
          wholesale_price: wholesalePrice,
          image: item.variant?.image,
          unit_name:
            item.variant?.unit_name || item.variant?.sale_unit?.name || "",
          tax_percentage: taxPercentage,
          tax_method: taxMethod,
        };
      });
      setSelectedItems(items);

      const appliedPromotionIds = Array.from(
        new Set(
          (quotation.items || [])
            .map((item: any) => Number(item.applied_promotion_id || 0))
            .filter((id: number) => id > 0),
        ),
      );

      if (appliedPromotionIds.length > 0 && activePromotionsQuery.data) {
        const restoredPromotions = activePromotionsQuery.data.filter(
          (promotion) => appliedPromotionIds.includes(promotion.id),
        );
        setAppliedPromotions(restoredPromotions);
      } else {
        setAppliedPromotions([]);
      }

      setTimeout(() => {
        isHydratingFromCopyRef.current = false;
      }, 0);
    }
  }, [
    copyFromQuotationQuery.data,
    selectedBranch,
    activePromotionsQuery.data,
    form,
    productsForSaleQuery.data,
  ]);

  const handleBranchChange = (branchId: number) => {
    hasManualCartMutationRef.current = true;
    handleBranchChangeFromManager(branchId);
  };

  const addToQuotation = (variant: ProductVariantForSale) => {
    hasManualCartMutationRef.current = true;
    setSelectedItems((items) =>
      upsertSaleItemVariant({
        sourceItems: items,
        variant,
        quantityToAdd: 1,
        priceType,
      }),
    );
  };

  const updateItemQuantity = (variantId: number, quantity: number) => {
    hasManualCartMutationRef.current = true;
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    setSelectedItems((items) =>
      updateSaleItemQuantity({
        sourceItems: items,
        variantId,
        quantity,
        variants: productsForSaleQuery.data || [],
      }),
    );
  };

  const removeItem = (variantId: number) => {
    hasManualCartMutationRef.current = true;
    setSelectedItems((items) => removeSaleItem(items, variantId));
  };

  const updateItemSpecialDiscount = (variantId: number, amount: number) => {
    hasManualCartMutationRef.current = true;
    setSelectedItems((items) =>
      updateSaleItemSpecialDiscount(items, variantId, amount),
    );
  };

  const calculateTotals = () => {
    return calculateSaleTotals({
      selectedItems,
      averageDiscountAmount,
      averageDiscountType,
      shippingCost,
      appliedPromotions,
      evaluatePromotionFn: evaluatePromotionForItems,
    });
  };

  const onFinish = async (values: any) => {
    if (selectedItems.length === 0) {
      messageApi?.error("Please add at least one item to the quotation");
      return;
    }

    const totals = calculateTotals();

    const quotationData: SaleFormData = {
      ...values,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name || values.customer_name,
      customer_phone: selectedCustomer?.phone || values.customer_phone,
      customer_email: selectedCustomer?.email || values.customer_email,
      served_by_id: selectedServedByUser?.id || values.served_by_id,
      items: totals.discountedItems.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sold_unit_price: item.sold_unit_price,
        average_discount_amount: item.average_discount_amount,
        special_discount_amount: item.special_discount_amount,
        promotion_discount_amount: item.promotion_discount_amount,
        applied_promotion_id: item.applied_promotion_id,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
      })),
      price_type: priceType,
      discount_amount: totals.finalDiscount,
      shipping_cost: totals.shippingCost,
      sale_type: "quotation",
      payment_status: "due",
      received_amount: 0,
      payments: [],
    };

    try {
      setLoading(true);
      const createdQuotation = await salesApi.createQuotation(quotationData);
      queryClient.invalidateQueries({ queryKey: [queryKeys.quotations] });
      messageApi?.success("Quotation created successfully!");
      navigate(`/quotations/view/${createdQuotation.id}`);
    } catch (error: any) {
      console.error("Error creating quotation:", error);
      messageApi?.error(
        error.response?.data?.message || "Failed to create quotation",
      );
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  const effectiveAppliedPromotions = appliedPromotions.filter((promotion) =>
    Object.values(totals.discountBreakdownByVariant || {}).some(
      (breakdown) => breakdown.appliedPromotionId === promotion.id,
    ),
  );

  const itemColumns = [
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
      title: "Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => <Money value={price} />,
    },
    {
      title: "Quantity",
      key: "quantity",
      render: (record: SaleItem) => (
        <div>
          <InputNumber
            min={1}
            value={record.quantity}
            onChange={(value) =>
              updateItemQuantity(record.variant_id, value || 1)
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
      render: (record: SaleItem) => {
        const variant = productsForSaleQuery.data?.find(
          (v) => v.id === record.variant_id,
        );
        const taxMethod = (
          record.tax_method ||
          variant?.tax_method ||
          "EXCLUSIVE"
        )
          .toString()
          .toUpperCase();
        const taxLabel = taxMethod === "INCLUSIVE" ? "Inc" : "Exc";
        return <Money value={record.tax_amount} suffix={` (${taxLabel})`} />;
      },
    },
    {
      title: "Avg Disc",
      key: "average_discount",
      render: (record: SaleItem) => {
        const avgDiscount =
          totals.discountBreakdownByVariant?.[record.variant_id]?.average || 0;
        return <Money value={avgDiscount} negative />;
      },
    },
    {
      title: "Promo Disc",
      key: "promotion_discount",
      render: (record: SaleItem) => {
        const promoDiscount =
          totals.discountBreakdownByVariant?.[record.variant_id]?.promotion ||
          0;
        const promoName =
          totals.discountBreakdownByVariant?.[record.variant_id]
            ?.appliedPromotionName;
        const promoId =
          totals.discountBreakdownByVariant?.[record.variant_id]
            ?.appliedPromotionId;

        return (
          <Space size={4} wrap>
            <Money value={promoDiscount} negative />
            {promoName && promoId ? (
              <Tag
                color="processing"
                closable
                onClose={(e) => {
                  e.preventDefault();
                  removeAppliedPromotion(promoId);
                }}
              >
                {promoName}
              </Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "Special Disc",
      key: "special_discount",
      render: (record: SaleItem) => (
        <InputNumber
          min={0}
          precision={2}
          value={Number(record.special_discount_amount) || 0}
          onChange={(value) =>
            updateItemSpecialDiscount(record.variant_id, Number(value) || 0)
          }
          style={{ width: 100 }}
          size="small"
        />
      ),
    },
    {
      title: "Total",
      key: "line_total",
      render: (record: SaleItem) => {
        const rowDiscount =
          totals.discountBreakdownByVariant?.[record.variant_id]?.total || 0;
        const netLineTotal =
          (Number(record.line_total) || 0) - (Number(rowDiscount) || 0);
        return <Money value={netLineTotal} />;
      },
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

  return (
    <div>
      {setPageTitle(
        copyFromId && copyFromQuotationQuery.data
          ? "Copy Quotation"
          : "New Quotation",
      )}
      <PageTitle
        title="New Quotation"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Quotations", href: "/quotations" },
          { title: "New Quotation" },
        ]}
      />

      <CustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreateCustomer={async (customer) => {
          try {
            const newCustomer = await post(endpoints.createCustomer, customer);
            setSelectedCustomer(newCustomer);
            setCustomers([...customers, newCustomer]);
            form.setFieldsValue({ customer_id: newCustomer.id });

            queryClient.invalidateQueries({
              queryKey: [queryKeys.customers],
            });

            messageApi?.success("Customer created successfully");
          } catch (error) {
            console.error("Error creating customer:", error);
            messageApi?.error("Failed to create customer");
          }
        }}
      />

      <Drawer
        title="Available Promotions"
        open={promotionDrawerOpen}
        onClose={() => setPromotionDrawerOpen(false)}
        width={460}
      >
        <List
          loading={activePromotionsQuery.isLoading}
          locale={{ emptyText: "No active promotions found" }}
          dataSource={activePromotionsQuery.data || []}
          renderItem={(promotion) => {
            const eligibility = promotionEligibilityMap[promotion.id];
            const isAvailableNow = Boolean(eligibility?.is_eligible);
            const isAlreadyApplied = appliedPromotions.some(
              (item) => item.id === promotion.id,
            );

            return (
              <List.Item
                actions={[
                  <Button
                    key={`apply-${promotion.id}`}
                    type={isAlreadyApplied ? "default" : "primary"}
                    size="small"
                    loading={applyingPromotionId === promotion.id}
                    onClick={() => {
                      if (isAlreadyApplied) {
                        removeAppliedPromotion(promotion.id);
                        return;
                      }
                      applyPromotionToCurrentQuotation(promotion);
                    }}
                  >
                    {isAlreadyApplied ? "Remove" : "Apply"}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{promotion.name}</span>
                      <Tag
                        color={
                          promotion.scope === "BRAND"
                            ? "blue"
                            : promotion.scope === "BUNDLE"
                              ? "purple"
                              : "lime"
                        }
                      >
                        {promotion.scope}
                      </Tag>
                      {isAvailableNow ? (
                        <Tag color="success">Available</Tag>
                      ) : null}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {promotion.discount_type === "percentage"
                          ? `${promotion.discount_value}% discount`
                          : `${formatCurrency(
                              Number(promotion.discount_value),
                            )} discount`}
                      </Text>
                      {promotion.description ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {promotion.description}
                        </Text>
                      ) : null}
                      {selectedItems.length > 0 &&
                      eligibility &&
                      !eligibility.is_eligible ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {eligibility.reason ||
                            "Not eligible for current cart"}
                        </Text>
                      ) : null}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Drawer>

      <Form form={form} onFinish={onFinish} layout="vertical">
        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                label="Branch"
                name="branch_id"
                rules={[{ required: true, message: "Please select a branch" }]}
              >
                <Select
                  placeholder="Select branch"
                  onChange={handleBranchChange}
                  loading={loading}
                >
                  {userBranches.map((branch) => (
                    <Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Customer" name="customer_id">
                <div style={{ display: "flex", gap: 8 }}>
                  <Select
                    placeholder="Select customer"
                    showSearch
                    allowClear
                    optionFilterProp="children"
                    value={selectedCustomer?.id}
                    onChange={(value) => {
                      const customer = customers.find((c) => c.id === value);
                      setSelectedCustomer(customer || null);
                      form.setFieldsValue({ customer_id: value });
                    }}
                    style={{ flex: 1 }}
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
                    title="Add new customer"
                  />
                </div>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Served By" name="served_by_id">
                <div style={{ display: "flex", gap: 8 }}>
                  <Select
                    placeholder="Select Staff"
                    showSearch
                    allowClear
                    optionFilterProp="children"
                    value={selectedServedByUser?.id}
                    onChange={(value) => {
                      const user = servedByUsers.find((u) => u.id === value);
                      setSelectedServedByUser(user || null);
                      form.setFieldsValue({ served_by_id: value });
                    }}
                    style={{ flex: 1 }}
                  >
                    {servedByUsers.map((user) => (
                      <Option key={user.id} value={user.id}>
                        {user.name}
                      </Option>
                    ))}
                  </Select>
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
                        : PriceType.REGULAR,
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
          <Select
            placeholder="Search and select products..."
            showSearch
            allowClear
            style={{ width: "100%" }}
            optionFilterProp="children"
            value={null}
            onSearch={setProductSearch}
            onClear={() => setProductSearch("")}
            onChange={(value) => {
              if (value) {
                const selectedVariant = filteredVariants.find(
                  (v) => v.id === value,
                );
                if (selectedVariant) {
                  addToQuotation(selectedVariant);
                }
              }
              setProductSearch("");
            }}
            filterOption={false}
            loading={productsForSaleQuery.isLoading}
            disabled={!selectedBranch}
          >
            {filteredVariants.map((variant) => (
              <Option
                key={variant.id}
                value={variant.id}
                label={getProductVariantSearchLabel(variant)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {variant.image && (
                    <img
                      src={variant.image}
                      alt={variant.name}
                      style={{
                        width: 24,
                        height: 24,
                        objectFit: "cover",
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <div>
                    <span style={{ fontWeight: 500 }}>
                      {variant.product_name} - {variant.name}
                    </span>
                    {variant.sku && (
                      <div style={{ fontSize: 11, color: "#666" }}>
                        SKU: {variant.sku}
                      </div>
                    )}
                    {variant.barcode && (
                      <div style={{ fontSize: 11, color: "#666" }}>
                        Barcode: {variant.barcode}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#666" }}>
                      $
                      {priceType === PriceType.WHOLESALE
                        ? variant.wholesale_price || variant.regular_price
                        : variant.regular_price}
                    </div>
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Quotation Items</h3>
          <Table
            columns={itemColumns}
            dataSource={selectedItems}
            rowKey={(record) => record.variant_id}
            size="small"
            pagination={false}
            locale={{ emptyText: "No items added yet" }}
          />
        </div>

        {effectiveAppliedPromotions.length > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <Space wrap>
              {effectiveAppliedPromotions.map((promotion) => (
                <Tag
                  key={promotion.id}
                  color="green"
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    removeAppliedPromotion(promotion.id);
                  }}
                >
                  Applied: {promotion.name}
                </Tag>
              ))}
              <Button type="link" size="small" onClick={clearAppliedPromotions}>
                Remove All Promotions
              </Button>
            </Space>
          </div>
        ) : null}

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label="Average Type">
                    <Radio.Group
                      value={averageDiscountType}
                      onChange={(e) => setAverageDiscountType(e.target.value)}
                      size="small"
                    >
                      <Radio value={DiscountType.FLAT}>Fixed</Radio>
                      <Radio value={DiscountType.PERCENTAGE}>Percent</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Average Discount"
                    name="average_discount_amount"
                  >
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
            <Col span={12}>
              <div
                style={{
                  padding: 12,
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
                    <Money value={totals.subtotal} />
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
                    <Money value={totals.totalTax} />
                  </Text>
                </div>
                {totals.promotionDiscount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#52c41a" }}>
                      Promo Discount:
                    </Text>
                    <Text style={{ fontSize: 12, color: "#52c41a" }}>
                      <Money value={totals.promotionDiscount} negative />
                    </Text>
                  </div>
                )}
                {totals.averageDiscount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>Average Discount:</Text>
                    <Text style={{ fontSize: 12 }}>
                      <Money value={totals.averageDiscount} negative />
                    </Text>
                  </div>
                )}
                {totals.specialDiscount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>Special Discount:</Text>
                    <Text style={{ fontSize: 12 }}>
                      <Money value={totals.specialDiscount} negative />
                    </Text>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Shipping:</Text>
                  <Text style={{ fontSize: 12 }}>
                    <Money value={totals.shippingCost} />
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
                    <Money value={totals.total} />
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
                  placeholder="Optional notes about this quotation"
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
                  <Button
                    onClick={() => navigate("/quotations")}
                    size="large"
                    block
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    size="large"
                    disabled={selectedItems.length === 0 || loading}
                    loading={loading}
                    block
                  >
                    Save Quotation
                  </Button>
                </Space>
              </div>
            </Col>
          </Row>
        </div>
      </Form>

      <FloatButton
        icon={<TagOutlined />}
        tooltip="Promotions"
        type="primary"
        badge={{ count: (activePromotionsQuery.data || []).length }}
        onClick={() => setPromotionDrawerOpen(true)}
      />
    </div>
  );
};

export default NewQuotation;
