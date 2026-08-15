import { Money, takaPrefix } from "../../components/Currency";
import {
  ArrowLeftOutlined,
  BankOutlined,
  CalculatorOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MobileOutlined,
  MoneyCollectOutlined,
  PayCircleOutlined,
  PercentageOutlined,
  PlusOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TagOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
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
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { BsCash } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { salesApi } from "../../api/sales-api";
import CustomerModal from "../../components/CustomerModal";
import { queryKeys } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import {
  DiscountType,
  PaymentMethod,
  PaymentStatus,
  PriceType,
  ProductVariantForSale,
  SaleFormData,
  SaleItem,
} from "../../types/sale.types";
import {
  discountPercentSuffix,
  formatCurrency,
} from "../../utils/formatters";
import { setPageTitle } from "../../utils/setPageTitle";
import {
  getVariantPriceForSale as getVariantPriceForSaleByType,
  removeSaleItem,
  updateSaleItemQuantity,
  updateSaleItemSpecialDiscount,
  upsertVariantInSaleItems as upsertSaleItemVariant,
} from "../../utils/sale-item.utils";
import { calculateSaleTotals } from "../../utils/calculate-totals.utils";
import {
  getPaymentProviderOptions,
  getPaymentProviderPlaceholder,
  PAYMENT_METHODS_REQUIRING_PROVIDER,
  paymentMethodRequiresProvider,
} from "../../utils/payment-provider.utils";
import { useSaleManager } from "../../hooks/useSaleManager";
import { usePromotionManager } from "../../hooks/usePromotionManager";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import useDarkMode from "../../hooks/useDarkMode";
import { useModalStore } from "../../stores/modalStore";
import { getProductVariantSearchLabel } from "../../utils/product-search.utils";

const { Option } = Select;
const { Text } = Typography;

const NewSale = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();
  const { modal } = useModalStore();
  const isDarkMode = useDarkMode();

  // Watch form values for real-time calculations
  const averageDiscountAmount =
    Form.useWatch("average_discount_amount", form) || 0;
  const shippingCost = Form.useWatch("shipping_cost", form) || 0;
  // State to track if we're in fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    selectedItems,
    setSelectedItems,
    customers,
    setCustomers,
    servedByUsers,
    filteredVariants,
    setProductSearch,
    selectedBranch,
    selectedServedByUser,
    setSelectedServedByUser,
    selectedCustomer,
    setSelectedCustomer,
    customerModalOpen,
    setCustomerModalOpen,
    priceType,
    setPriceType,
    averageDiscountType,
    setAverageDiscountType,
    loading,
    setLoading,
    salePayments,
    setSalePayments,
    userBranches,
    productsForSaleQuery,
    activePromotionsQuery,
    handleBranchChange: handleBranchChangeFromManager,
  } = useSaleManager({ form, user });

  // Listen for fullscreen change events (e.g., when user presses Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Set initial page title
  useEffect(() => {
    setPageTitle("New Sale");
  }, []);

  const handleBranchChange = useCallback(
    (branchId: number) => {
      handleBranchChangeFromManager(branchId);
    },
    [handleBranchChangeFromManager],
  );

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
    getVariantPriceForSaleByType(variant, priceType);

  const {
    appliedPromotions,
    setAppliedPromotions,
    setDismissedAutoPromotionIds,
    applyingPromotionId,
    promotionEligibilityMap,
    promotionDrawerOpen,
    setPromotionDrawerOpen,
    evaluatePromotionForItems,
    removeAppliedPromotion,
    clearAppliedPromotions: clearAppliedPromotion,
    applyPromotion: applyPromotionToCurrentSale,
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
  });

  // --- Helper function to reset sale data ---
  const resetSaleData = useCallback(() => {
    // Preserve values
    const currentBranchId = form.getFieldValue("branch_id");
    const currentServedById = form.getFieldValue("served_by_id");

    // Reset states
    setSelectedItems([]);
    setSelectedCustomer(null);
    setPriceType(PriceType.REGULAR);
    setAverageDiscountType(DiscountType.FLAT);
    setAppliedPromotions([]);
    setDismissedAutoPromotionIds([]);
    setSalePayments([
      {
        payment_method: PaymentMethod.CASH,
        amount: 0,
        reference: "",
      },
    ]);

    // Reset form fields, but preserve branch and served_by
    form.setFieldsValue({
      branch_id: currentBranchId,
      served_by_id: currentServedById,
      customer_id: undefined,
      average_discount_amount: 0,
      shipping_cost: 0,
      notes: "",
    });

    messageApi?.info("Sale cancelled and form cleared.");
  }, [
    form,
    messageApi,
    setAppliedPromotions,
    setAverageDiscountType,
    setDismissedAutoPromotionIds,
    setPriceType,
    setSalePayments,
    setSelectedCustomer,
    setSelectedItems,
  ]);

  // --- Handle Cancel Button Click ---
  const handleCancel = useCallback(() => {
    if (selectedItems.length > 0) {
      modal?.confirm({
        title: "Cancel Sale?",
        content:
          "Are you sure you want to cancel? All items, discounts, and customer details will be removed.",
        okText: "Yes, Cancel",
        okType: "danger",
        cancelText: "No",
        onOk: () => {
          resetSaleData();
        },
      });
    } else {
      resetSaleData();
    }
  }, [resetSaleData, selectedItems.length]);

  const addToSale = (variant: ProductVariantForSale) => {
    setSelectedItems((items) => upsertFn(items, variant, 1));
  };

  const handleBarcodeScann = useCallback(
    async (barcode: string) => {
      if (!selectedBranch || !barcode.trim()) {
        return;
      }

      try {
        const product = await salesApi.getProductByBarcode(
          selectedBranch,
          barcode.trim(),
        );

        if (product) {
          addToSale(product);
          messageApi?.success(
            `Added ${product.product_name} - ${product.name} to sale`,
          );
        } else {
          messageApi?.error(`Product not found for barcode: ${barcode}`);
        }
      } catch (error: any) {
        messageApi?.error("Failed to scan barcode");
      }
    },
    [addToSale, messageApi, selectedBranch],
  );

  useBarcodeScanner({
    selectedBranch,
    onBarcodeScanned: handleBarcodeScann,
    onSubmit: () => form.submit(),
  });

  const updateItemQuantity = (variantId: number, quantity: number) => {
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
    setSelectedItems((items) => removeSaleItem(items, variantId));
  };

  const updateItemSpecialDiscount = (variantId: number, amount: number) => {
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

  // ─── Auto Print Thermal Receipt Logic ─────────────────────────────────
  const printReceipt = useCallback(
    async (sale: any) => {
      if (!sale) return;

      try {
        const customerRewards = sale.customer?.rewards_points;
        const amountPaid = Number(sale?.received_amount) || 0;
        const correctTotal = Number(sale.total) || 0; // Fallback safely

        const getPaymentMethodLabel = (method: string) => {
          const map: Record<string, string> = {
            CASH: "Cash",
            CARD: "Card",
            CHEQUE: "Cheque",
            BANK_TRANSFER: "Transfer",
            MOBILE_MONEY: "Mobile",
            MFS: "MFS",
            CREDIT: "Credit",
            EXCHANGE: "Exchange",
          };
          return map[method] || method;
        };

        const paymentMethods =
          sale.payments && sale.payments.length > 0
            ? sale.payments
                .map((payment: any) =>
                  getPaymentMethodLabel(payment.payment_method),
                )
                .join(", ")
            : "Cash";

        const receiptData = {
          orderId: sale.sale_number,
          receiptNumber: sale.sale_number,
          saleNumber: sale.sale_number,
          sale_number: sale.sale_number,
          barcodeValue: sale.sale_number,
          date: dayjs(sale.sale_date).format("YYYY-MM-DD"),
          time: dayjs(sale.sale_date).format("HH:mm:ss"),
          sale_date: sale.sale_date,
          cashier: sale.user?.name || sale.user_name || "Staff",
          servedBy: sale.served_by?.name || undefined,
          customer: sale.customer_name || "Walk-in Customer",
          customerName:
            sale.customer_name || sale.customer?.name || "Walk-in Customer",
          customerPhone: sale.customer_phone || sale.customer?.phone || "",
          customerEmail: sale.customer_email || sale.customer?.email || "",
          rewardPoints: customerRewards?.total_points,
          pointsEarned: customerRewards?.lifetime_earned,
          pointsRedeemed: customerRewards?.lifetime_redeemed,
          branch: sale.branch
            ? {
                name: sale.branch.name,
                address: sale.branch.address,
                phone: sale.branch.phone,
                email: sale.branch.email,
              }
            : undefined,
          user: sale.user
            ? {
                name: sale.user.name,
                id: String(sale.user.id),
              }
            : undefined,
          items:
            sale.items?.map((item: any) => {
              const quantity = Number(item.quantity) || 0;
              const unitPrice = Number(item.unit_price) || 0;
              const grossLineTotal = unitPrice * quantity;
              const averageDiscountAmount =
                Number(item.average_discount_amount) || 0;
              const specialDiscountAmount =
                Number(item.special_discount_amount) || 0;
              const promotionDiscountAmount =
                Number(item.promotion_discount_amount) || 0;
              const discountAmount =
                averageDiscountAmount +
                specialDiscountAmount +
                promotionDiscountAmount;
              const taxAmount = Number(item.tax_amount) || 0;
              const taxMethod =
                item.variant?.product?.tax_method || "exclusive";
              const isInclusiveTax = String(taxMethod)
                .toLowerCase()
                .startsWith("inc");
              const computedLineTotal = Math.max(
                0,
                grossLineTotal -
                  discountAmount +
                  (isInclusiveTax ? 0 : taxAmount),
              );

              return {
                name: `${item.variant?.product?.name || "Product"} - ${item.variant?.name || ""}`.trim(),
                quantity,
                unitPrice,
                price: unitPrice,
                grossLineTotal,
                averageDiscountAmount,
                specialDiscountAmount,
                promotionDiscountAmount,
                discountAmount,
                taxAmount,
                taxPercentage: Number(item.variant?.product?.tax) || 0,
                taxMethod,
                lineTotal: computedLineTotal,
                total: computedLineTotal,
              };
            }) || [],
          subtotal: Number(sale?.subtotal) || 0,
          discount: Number(sale?.discount_amount) || 0,
          discountAmount: Number(sale?.discount_amount) || 0,
          shipping: Number(sale?.shipping_cost) || 0,
          shippingCost: Number(sale?.shipping_cost) || 0,
          tax: Number(sale?.tax_amount) || 0,
          taxAmount: Number(sale?.tax_amount) || 0,
        total: correctTotal,
        totalAmount: correctTotal,
        amountPaid,
        receivedAmount: amountPaid,
        change: Math.max(0, amountPaid - correctTotal),
        changeAmount: Math.max(0, amountPaid - correctTotal),
        due: Math.max(0, correctTotal - amountPaid),
        dueAmount: Math.max(0, correctTotal - amountPaid),
        paymentMethod: paymentMethods,
          payments:
            sale.payments?.map((payment: any) => ({
              payment_method: getPaymentMethodLabel(payment.payment_method),
              amount: Number(payment.amount) || 0,
            })) || [],
          paymentStatus: sale.payment_status,
          notes: sale.notes || undefined,
        };

        const response = await fetch("http://localhost:8080/print", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(receiptData),
        });

        if (response.ok) {
          await response.json();
          messageApi?.success("Receipt sent to printer!");
        } else {
          const errorText = await response.text();
          messageApi?.error("Failed to print receipt: " + errorText);
        }
      } catch (error: any) {
        console.error("Print error:", error);
        if (error.message.includes("fetch")) {
          messageApi?.error(
            "Printing agent is not running. Please start the printing agent on your computer and try again.",
          );
        } else {
          messageApi?.error(
            "Failed to print receipt. Please check your connection.",
          );
        }
      }
    },
    [messageApi],
  );

  const onFinish = async (values: any) => {
    if (selectedItems.length === 0) {
      messageApi?.error("Please add at least one item to the sale");
      return;
    }

    const totals = calculateTotals();

    // Zero-amount rows are dropped. No payment at all is allowed: the sale is
    // recorded as fully unpaid (DUE) and collected later from Due Payments.
    const effectivePayments = salePayments.filter(
      (payment) => Number(payment.amount) > 0,
    );

    for (const payment of effectivePayments) {
      if (
        PAYMENT_METHODS_REQUIRING_PROVIDER.includes(payment.payment_method) &&
        !payment.payment_type
      ) {
        messageApi?.error(
          `${payment.payment_method} payment must have a payment type selected`,
        );
        return;
      }
    }
    const totalPaymentAmount = effectivePayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

    // Determine payment status — check "nothing paid" first, otherwise a fully
    // unpaid sale would be recorded as PARTIAL
    let paymentStatus = PaymentStatus.PAID;
    if (totalPaymentAmount === 0) {
      paymentStatus = PaymentStatus.DUE;
    } else if (totalPaymentAmount < totals.total) {
      paymentStatus = PaymentStatus.PARTIAL;
    }

    const saleData: SaleFormData = {
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
      payment_status: paymentStatus,
      received_amount: totalPaymentAmount,
      payments: effectivePayments,
    };

    try {
      setLoading(true);
      const createdSale = await salesApi.createSale(saleData); // Capture returned sale object

      // Invalidate all relevant caches after sales operation
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
      queryClient.invalidateQueries({ queryKey: [queryKeys.promotions] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.eod] });

      messageApi?.success("Sale created successfully!");

      // ─── AUTO PRINT LOGIC ───────────────────────────────
      const shouldAutoPrint =
        localStorage.getItem("autoPrintThermal") === "true";
      if (shouldAutoPrint && createdSale) {
        printReceipt(createdSale); // Fire & forget async print process
      }
      // ─── END AUTO PRINT LOGIC ───────────────────────────

      // Reset form selections except branch
      setSelectedItems([]);
      setSelectedCustomer(null);
      setSelectedServedByUser(null);
      setPriceType(PriceType.REGULAR);
      setAverageDiscountType(DiscountType.FLAT);
      setAppliedPromotions([]);
      setDismissedAutoPromotionIds([]);
      setSalePayments([
        {
          payment_method: PaymentMethod.CASH,
          amount: 0,
          reference: "",
        },
      ]);
      form.setFieldsValue({
        customer_id: undefined,
        served_by_id: undefined,
        average_discount_amount: 0,
        shipping_cost: 0,
        notes: "",
        // Keep branch_id as is
      });
    } catch (error: any) {
      console.error("Error creating sale:", error);
      messageApi?.error(
        error.response?.data?.message || "Failed to create sale",
      );
    } finally {
      setLoading(false);
    }
  };

  // Update default payment amount when totals change
  useEffect(() => {
    const totals = calculateTotals();
    if (
      salePayments.length === 1 &&
      salePayments[0].payment_method === PaymentMethod.CASH
    ) {
      const currentTotalPaid = salePayments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      if (currentTotalPaid !== totals.total) {
        setSalePayments([
          {
            ...salePayments[0],
            amount: totals.total,
          },
        ]);
      }
    }
  }, [
    selectedItems,
    averageDiscountAmount,
    shippingCost,
    averageDiscountType,
    appliedPromotions,
  ]);

  const totals = calculateTotals();
  const totalPaidAmount = salePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const dueAmount = Math.max(0, Number(totals.total || 0) - totalPaidAmount);
  const changeAmount = Math.max(0, totalPaidAmount - Number(totals.total || 0));

  const saleItemColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: SaleItem) => (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 120,
          }}
        >
          {record.image && (
            <img
              src={record.image}
              alt={record.variant_name}
              style={{
                width: 48,
                height: 48,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid var(--ant-color-border)",
              }}
            />
          )}
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                lineHeight: "1.2",
                marginBottom: 2,
              }}
            >
              {record.product_name}
            </div>
            <Text
              type="secondary"
              style={{ fontSize: 12, display: "block", lineHeight: "1.2" }}
            >
              {record.variant_name}
            </Text>
            {record.variant_sku && (
              <Text
                type="secondary"
                style={{ fontSize: 11, display: "block", marginTop: 2 }}
              >
                SKU: {record.variant_sku}
              </Text>
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
      title: "Qty",
      key: "quantity",
      render: (record: SaleItem) => (
        <div>
          <InputNumber
            min={1}
            value={record.quantity}
            onChange={(value) =>
              updateItemQuantity(record.variant_id, value || 1)
            }
            onPressEnter={(e) => {
              (e.target as HTMLInputElement).blur();
            }}
            style={{ width: 70, marginBottom: 4 }}
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
        return (
          <Money
            value={avgDiscount}
            negative
            suffix={discountPercentSuffix(avgDiscount, record.line_total)}
          />
        );
      },
    },
    {
      title: "Special Disc",
      key: "special_discount",
      render: (record: SaleItem) => {
        const specialDiscount = Number(record.special_discount_amount) || 0;
        const percent = discountPercentSuffix(
          specialDiscount,
          record.line_total,
        );
        return (
          <div>
            <InputNumber
              min={0}
              precision={2}
              value={specialDiscount}
              onChange={(value) =>
                updateItemSpecialDiscount(record.variant_id, Number(value) || 0)
              }
              style={{ width: 100 }}
              size="small"
            />
            {percent && (
              <div style={{ fontSize: 11, color: "#666" }}>{percent.trim()}</div>
            )}
          </div>
        );
      },
    },
    {
      title: "Promo Disc",
      key: "promo_discount",
      render: (record: SaleItem) => {
        const promoDiscount =
          totals.discountBreakdownByVariant?.[record.variant_id]?.promotion ||
          0;
        const promoName =
          totals.discountBreakdownByVariant?.[record.variant_id]?.promotionName;
        const promoId =
          totals.discountBreakdownByVariant?.[record.variant_id]?.promotionId;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Money
              value={promoDiscount}
              negative
              suffix={discountPercentSuffix(promoDiscount, record.line_total)}
            />
            {promoName ? (
              <Tag
                className="w-max"
                color="processing"
                closable
                onClose={(e) => {
                  e.preventDefault();
                  if (promoId) {
                    removeAppliedPromotion(promoId);
                  }
                }}
              >
                {promoName}
              </Tag>
            ) : null}
          </div>
        );
      },
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
      align: "center" as const,
      render: (record: SaleItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          size="small"
          onClick={() => removeItem(record.variant_id)}
        />
      ),
    },
  ];
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
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
            const isApplied = appliedPromotions.some(
              (item) => item.id === promotion.id,
            );

            return (
              <List.Item
                actions={[
                  <Button
                    key={`apply-${promotion.id}`}
                    type={isApplied ? "default" : "primary"}
                    size="small"
                    loading={applyingPromotionId === promotion.id}
                    onClick={() => {
                      if (isApplied) {
                        removeAppliedPromotion(promotion.id);
                        return;
                      }
                      applyPromotionToCurrentSale(promotion);
                    }}
                  >
                    {isApplied ? "Remove" : "Apply"}
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
                              : "green"
                        }
                      >
                        {promotion.scope}
                      </Tag>
                      {isApplied ? <Tag color="green">Applied</Tag> : null}
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

      {/* POS Header Bar */}
      <div
        style={{
          padding: "6px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Typography.Title
            level={5}
            style={{ margin: 0, whiteSpace: "nowrap" }}
          >
            Point of Sale
          </Typography.Title>
          {selectedItems.length > 0 && (
            <Badge
              count={`${selectedItems.length} items`}
              style={{
                fontSize: 12,
                height: 22,
                lineHeight: "22px",
                borderRadius: 11,
                padding: "0 8px",
              }}
            />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            icon={<TagOutlined />}
            onClick={() => setPromotionDrawerOpen(true)}
            disabled={!selectedBranch}
            size="small"
            style={{
              backgroundColor: "#722ed1",
              borderColor: "#722ed1",
              color: "#fff",
            }}
          >
            Promos ({(activePromotionsQuery.data || []).length})
          </Button>
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/")}
            type="primary"
            ghost
          >
            Back
          </Button>
          <Button
            size="small"
            icon={
              isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
            }
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement
                  .requestFullscreen()
                  .then(() => {
                    setIsFullscreen(true);
                  })
                  .catch(() => {
                    setIsFullscreen(false);
                  });
              } else {
                document.exitFullscreen().then(() => {
                  setIsFullscreen(false);
                });
              }
            }}
            type="primary"
            ghost
          >
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </div>

      {/* Main POS Body */}
      <Form
        form={form}
        onFinish={onFinish}
        layout="vertical"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 8,
            padding: 8,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              gap: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "stretch",
                gap: 8,
                overflowX: "auto",
                overflowY: "hidden",
              }}
            >
              {/* Card for selecting Branch, Customer, Served By, and Pricing Type */}
              <Card
                size="small"
                style={{
                  flex: "1 1 240px",
                  minWidth: 240,
                  borderRadius: 10,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  height: 240,
                  overflow: "hidden",
                }}
                bodyStyle={{
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                <Form.Item
                  label={
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      Branch
                    </span>
                  }
                  name="branch_id"
                  rules={[{ required: true, message: "Select branch" }]}
                  style={{ marginBottom: 6 }}
                >
                  <Select
                    placeholder="Select branch"
                    size="small"
                    onChange={(value) => {
                      handleBranchChange(value);
                      setTimeout(() => {
                        const activeElement =
                          document.activeElement as HTMLElement;
                        if (activeElement && activeElement.blur)
                          activeElement.blur();
                      }, 0);
                    }}
                    loading={loading}
                  >
                    {userBranches.map((branch) => (
                      <Option key={branch.id} value={branch.id}>
                        {branch.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  label={
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      Customer
                    </span>
                  }
                  name="customer_id"
                  style={{ marginBottom: 6 }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <Select
                      placeholder="Walk-in customer"
                      showSearch
                      allowClear
                      size="small"
                      optionFilterProp="children"
                      value={selectedCustomer?.id}
                      onChange={(value) => {
                        const customer = customers.find((c) => c.id === value);
                        setSelectedCustomer(customer || null);
                        form.setFieldsValue({ customer_id: value });
                        setTimeout(() => {
                          const activeElement =
                            document.activeElement as HTMLElement;
                          if (activeElement && activeElement.blur)
                            activeElement.blur();
                        }, 0);
                      }}
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      {customers.map((customer) => (
                        <Option key={customer.id} value={customer.id}>
                          {customer.name} • {customer.phone}
                        </Option>
                      ))}
                    </Select>
                    <Tooltip title="Add customer">
                      <Button
                        icon={<PlusOutlined />}
                        size="small"
                        onClick={() => setCustomerModalOpen(true)}
                        style={{
                          flex: "0 0 auto",
                          borderColor: "#52c41a",
                          color: "#52c41a",
                        }}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
                <Row gutter={6}>
                  <Col span={14}>
                    <Form.Item
                      label={
                        <span style={{ fontWeight: 600, fontSize: 12 }}>
                          Served By
                        </span>
                      }
                      name="served_by_id"
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        placeholder="Select staff"
                        showSearch
                        allowClear
                        size="small"
                        optionFilterProp="children"
                        value={selectedServedByUser?.id}
                        onChange={(value) => {
                          const user = servedByUsers.find(
                            (u) => u.id === value,
                          );
                          setSelectedServedByUser(user || null);
                          form.setFieldsValue({ served_by_id: value });
                          setTimeout(() => {
                            const activeElement =
                              document.activeElement as HTMLElement;
                            if (activeElement && activeElement.blur)
                              activeElement.blur();
                          }, 0);
                        }}
                      >
                        {servedByUsers.map((user) => (
                          <Option key={user.id} value={user.id}>
                            {user.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item
                      label={
                        <span style={{ fontWeight: 600, fontSize: 12 }}>
                          Pricing
                        </span>
                      }
                      style={{ marginBottom: 0 }}
                    >
                      <Button
                        icon={<SwapOutlined />}
                        size="small"
                        onClick={() =>
                          setPriceType(
                            priceType === PriceType.REGULAR
                              ? PriceType.WHOLESALE
                              : PriceType.REGULAR,
                          )
                        }
                        type={
                          priceType === PriceType.WHOLESALE
                            ? "primary"
                            : "default"
                        }
                        style={{ width: "100%" }}
                      >
                        {priceType === PriceType.WHOLESALE
                          ? "Wholesale"
                          : "Retail"}
                      </Button>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              {/* Card for Adding Products and applying Discounts & Charges */}
              <Card
                size="small"
                style={{
                  flex: "1 1 300px",
                  minWidth: 280,
                  borderRadius: 10,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  height: 240,
                  overflow: "hidden",
                }}
                bodyStyle={{
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 12 }}>
                  <ShoppingCartOutlined style={{ marginRight: 4 }} /> Add
                  Products
                </div>
                <Select
                  placeholder={
                    <>
                      <SearchOutlined /> Search or scan barcode...
                    </>
                  }
                  showSearch
                  allowClear
                  style={{ width: "100%", marginBottom: 10 }}
                  size="small"
                  optionFilterProp="children"
                  value={null}
                  onSearch={setProductSearch}
                  onClear={() => setProductSearch("")}
                  onChange={(value) => {
                    if (value) {
                      const selectedVariant = filteredVariants.find(
                        (v) => v.id === value,
                      );
                      if (selectedVariant) addToSale(selectedVariant);
                    }
                    setProductSearch("");
                    setTimeout(() => {
                      const activeElement =
                        document.activeElement as HTMLElement;
                      if (activeElement && activeElement.blur)
                        activeElement.blur();
                    }, 0);
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 0",
                        }}
                      >
                        {variant.image ? (
                          <img
                            src={variant.image}
                            alt={variant.name}
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ShoppingCartOutlined />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {variant.product_name}
                          </div>
                          <div style={{ fontSize: 11 }}>
                            {variant.name}
                            {variant.product_code &&
                              ` • Code: ${variant.product_code}`}
                            {variant.sku && ` • ${variant.sku}`}
                            {variant.barcode && ` • ${variant.barcode}`}
                          </div>
                          {variant.locations?.length ? (
                            <div style={{ fontSize: 11, color: "#666" }}>
                              <EnvironmentOutlined /> {variant.locations.join(", ")}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            <Money
                              value={
                                priceType === PriceType.WHOLESALE
                                  ? variant.wholesale_price ||
                                    variant.regular_price
                                  : variant.regular_price
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>

                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  <TagOutlined style={{ marginRight: 4 }} /> Discounts & Charges
                </div>
                {appliedPromotions.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <Space wrap size={4}>
                      {appliedPromotions.map((promotion) => (
                        <Tag
                          key={promotion.id}
                          color="green"
                          closable
                          style={{ fontSize: 11 }}
                          onClose={(e) => {
                            e.preventDefault();
                            removeAppliedPromotion(promotion.id);
                          }}
                        >
                          {promotion.name}
                        </Tag>
                      ))}
                      <Button
                        type="link"
                        size="small"
                        onClick={clearAppliedPromotion}
                        style={{ fontSize: 11, padding: 0 }}
                      >
                        Clear All
                      </Button>
                    </Space>
                  </div>
                )}
                <Row gutter={6}>
                  <Col span={12}>
                    <Radio.Group
                      value={averageDiscountType}
                      onChange={(e) => setAverageDiscountType(e.target.value)}
                      buttonStyle="solid"
                      size="small"
                      style={{ width: "100%", marginBottom: 6 }}
                    >
                      <Radio.Button
                        value={DiscountType.FLAT}
                        style={{
                          width: "50%",
                          textAlign: "center",
                          fontSize: 11,
                        }}
                      >
                        <MoneyCollectOutlined /> Fixed
                      </Radio.Button>
                      <Radio.Button
                        value={DiscountType.PERCENTAGE}
                        style={{
                          width: "50%",
                          textAlign: "center",
                          fontSize: 11,
                        }}
                      >
                        <PercentageOutlined />
                      </Radio.Button>
                    </Radio.Group>
                  </Col>
                  <Col span={12} />
                  <Col span={12}>
                    <Form.Item
                      name="average_discount_amount"
                      label={
                        <span style={{ fontSize: 11, fontWeight: 600 }}>
                          Avg Discount
                        </span>
                      }
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber
                        min={0}
                        size="small"
                        style={{ width: "100%" }}
                        prefix={
                          averageDiscountType === DiscountType.PERCENTAGE
                            ? "%"
                            : takaPrefix
                        }
                        onPressEnter={(e) =>
                          (e.target as HTMLInputElement).blur()
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="shipping_cost"
                      label={
                        <span style={{ fontSize: 11, fontWeight: 600 }}>
                          Shipping Cost
                        </span>
                      }
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber
                        min={0}
                        size="small"
                        style={{ width: "100%" }}
                        prefix={takaPrefix}
                        onPressEnter={(e) =>
                          (e.target as HTMLInputElement).blur()
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              {/* Card for managing Payments and Payment Methods */}
              <Card
                size="small"
                style={{
                  flex: "1 1 480px",
                  minWidth: 340,
                  borderRadius: 10,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  height: 240,
                  overflow: "hidden",
                }}
                bodyStyle={{
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    <CreditCardOutlined style={{ marginRight: 4 }} /> Payments
                  </span>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: 2,
                      height: "auto",
                    }}
                    onClick={() => {
                      const remainingAmount = Math.max(
                        0,
                        totals.total -
                          salePayments.reduce((sum, p) => sum + p.amount, 0),
                      );
                      setSalePayments([
                        ...salePayments,
                        {
                          payment_method: PaymentMethod.CASH,
                          amount:
                            remainingAmount > 0
                              ? remainingAmount
                              : totals.total,
                          reference: "",
                        },
                      ]);
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    paddingRight: 2,
                  }}
                >
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: "100%" }}
                  >
                    {salePayments.map((payment, index) => (
                      <Card
                        key={index}
                        size="small"
                        style={{ borderRadius: 6 }}
                        bodyStyle={{ padding: 4 }}
                      >
                        {(() => {
                          const requiresProvider =
                            paymentMethodRequiresProvider(
                              payment.payment_method,
                            );
                          const providerOptions = getPaymentProviderOptions(
                            payment.payment_method,
                          );

                          return (
                            <Row gutter={6} align="middle">
                              <Col span={requiresProvider ? 6 : 8}>
                                <Select
                                  size="small"
                                  value={payment.payment_method}
                                  onChange={(value) => {
                                    const updatedPayments = [...salePayments];
                                    updatedPayments[index] = {
                                      ...updatedPayments[index],
                                      payment_method: value,
                                      payment_type: undefined,
                                    };
                                    setSalePayments(updatedPayments);
                                    setTimeout(() => {
                                      const activeElement =
                                        document.activeElement as HTMLElement;
                                      if (activeElement && activeElement.blur) {
                                        activeElement.blur();
                                      }
                                    }, 0);
                                  }}
                                  style={{ width: "100%" }}
                                  placeholder="Method"
                                >
                                  <Option value={PaymentMethod.CASH}>
                                    <BsCash className="mr-2 inline" /> Cash
                                  </Option>
                                  <Option value={PaymentMethod.CARD}>
                                    <CreditCardOutlined className="mr-2" /> Card
                                  </Option>
                                  <Option value={PaymentMethod.CHEQUE}>
                                    <FileTextOutlined className="mr-2" /> Cheque
                                  </Option>
                                  <Option value={PaymentMethod.BANK_TRANSFER}>
                                    <BankOutlined className="mr-2" /> Transfer
                                  </Option>
                                  <Option value={PaymentMethod.MOBILE_MONEY}>
                                    <MobileOutlined className="mr-2" /> Mobile
                                  </Option>
                                  <Option value={PaymentMethod.MFS}>
                                    <PayCircleOutlined className="mr-2" /> MFS
                                  </Option>
                                  <Option value={PaymentMethod.CREDIT}>
                                    <WalletOutlined className="mr-2" /> Credit
                                  </Option>
                                  <Option value={PaymentMethod.EXCHANGE}>
                                    <SwapOutlined className="mr-2" /> Exchange
                                  </Option>
                                </Select>
                              </Col>

                              <Col span={requiresProvider ? 6 : 0}>
                                {requiresProvider ? (
                                  <Select
                                    size="small"
                                    showSearch
                                    allowClear
                                    placeholder={getPaymentProviderPlaceholder(
                                      payment.payment_method,
                                    )}
                                    value={payment.payment_type || undefined}
                                    onChange={(value) => {
                                      const updatedPayments = [...salePayments];
                                      updatedPayments[index] = {
                                        ...updatedPayments[index],
                                        payment_type: value,
                                      };
                                      setSalePayments(updatedPayments);
                                    }}
                                    style={{ width: "100%" }}
                                    optionFilterProp="label"
                                    options={providerOptions}
                                    popupMatchSelectWidth={false}
                                    listHeight={200}
                                  />
                                ) : null}
                              </Col>

                              <Col span={requiresProvider ? 5 : 7}>
                                <InputNumber
                                  size="small"
                                  value={payment.amount}
                                  onChange={(value) => {
                                    const updatedPayments = [...salePayments];
                                    updatedPayments[index].amount = value || 0;
                                    setSalePayments(updatedPayments);
                                  }}
                                  onPressEnter={(e) =>
                                    (e.target as HTMLInputElement).blur()
                                  }
                                  min={0}
                                  precision={2}
                                  style={{ width: "100%" }}
                                  placeholder="Amount"
                                  prefix={takaPrefix}
                                />
                              </Col>
                              <Col span={requiresProvider ? 5 : 7}>
                                <Input
                                  size="small"
                                  value={payment.reference}
                                  onChange={(e) => {
                                    const updatedPayments = [...salePayments];
                                    updatedPayments[index].reference =
                                      e.target.value;
                                    setSalePayments(updatedPayments);
                                  }}
                                  onPressEnter={(e) =>
                                    (e.target as HTMLInputElement).blur()
                                  }
                                  placeholder="Ref#"
                                />
                              </Col>
                              <Col span={2}>
                                <Tooltip title="Remove">
                                  <Button
                                    size="small"
                                    danger
                                    type="text"
                                    icon={<DeleteOutlined />}
                                    onClick={() => {
                                      const updatedPayments =
                                        salePayments.filter(
                                          (_, i) => i !== index,
                                        );
                                      setSalePayments(updatedPayments);
                                    }}
                                  />
                                </Tooltip>
                              </Col>
                            </Row>
                          );
                        })()}
                      </Card>
                    ))}
                  </Space>
                </div>
              </Card>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  minWidth: 0,
                }}
              >
                <Card
                  style={{
                    borderRadius: 10,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                  bodyStyle={{
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "10px 10px 0 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Typography.Title
                      level={5}
                      style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 14,
                      }}
                    >
                      <ShoppingCartOutlined /> Cart Items
                    </Typography.Title>
                    {selectedItems.length > 0 && (
                      <Badge
                        count={selectedItems.length}
                        style={{
                          backgroundColor: "#52c41a",
                          fontSize: 12,
                          height: 20,
                          lineHeight: "20px",
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: "auto",
                      overflowX: "auto",
                      padding: "0 8px 8px 8px",
                    }}
                  >
                    {selectedItems.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "40px 20px",
                          color: isDarkMode ? "#ffffffb3" : "#00000080",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "100%",
                        }}
                      >
                        <ShoppingCartOutlined
                          style={{
                            fontSize: 48,
                            marginBottom: 12,
                            opacity: isDarkMode ? 0.3 : 0.7,
                          }}
                        />
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          No items in cart
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Search and add products to start
                        </div>
                      </div>
                    ) : (
                      <Table
                        columns={saleItemColumns}
                        dataSource={selectedItems}
                        rowKey={(record) => record.variant_id}
                        size="small"
                        pagination={false}
                        showHeader={true}
                        sticky
                        bordered={false}
                        style={{ background: "transparent" }}
                      />
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>

          <div
            style={{
              width: 280,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              gap: 8,
            }}
          >
            <Card
              style={{
                borderRadius: 10,
                boxShadow: "0 3px 16px rgba(0,0,0,0.12)",
                border: "none",
                flexShrink: 0,
              }}
              bodyStyle={{ padding: "10px 12px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: 600 }}>TOTAL</Text>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                  }}
                >
                  <Money
                    value={Math.ceil(Number(totals.total) || 0)}
                    decimals={0}
                  />
                </Text>
              </div>
            </Card>

            <Card
              style={{
                borderRadius: 10,
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
              bodyStyle={{
                padding: 8,
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              {[
                {
                  label: "Subtotal",
                  value: <Money value={totals.subtotal} />,
                },
                {
                  label: "Tax",
                  value: <Money value={totals.totalTax} />,
                },
                {
                  label: "Discount",
                  value: (
                    <Money
                      value={totals.finalDiscount}
                      negative
                      suffix={discountPercentSuffix(
                        totals.finalDiscount,
                        totals.subtotal,
                      )}
                    />
                  ),
                  highlight: totals.finalDiscount > 0,
                },
                {
                  label: "Promo Disc",
                  value: (
                    <Money
                      value={totals.promotionDiscount}
                      negative
                      suffix={discountPercentSuffix(
                        totals.promotionDiscount,
                        totals.subtotal,
                      )}
                    />
                  ),
                },
                {
                  label: "Avg Disc",
                  value: (
                    <Money
                      value={totals.averageDiscount}
                      negative
                      suffix={discountPercentSuffix(
                        totals.averageDiscount,
                        totals.subtotal,
                      )}
                    />
                  ),
                },
                {
                  label: "Special Disc",
                  value: (
                    <Money
                      value={totals.specialDiscount}
                      negative
                      suffix={discountPercentSuffix(
                        totals.specialDiscount,
                        totals.subtotal,
                      )}
                    />
                  ),
                },
                {
                  label: "Shipping",
                  value: <Money value={totals.shippingCost} />,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 6px",
                    borderRadius: 4,
                    fontSize: 12,
                    background: row.highlight
                      ? isDarkMode
                        ? "rgba(255, 214, 102, 0.15)"
                        : "rgba(255, 214, 102, 0.55)"
                      : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{row.label}</Text>
                  <Text strong style={{ fontSize: 14 }}>
                    {row.value}
                  </Text>
                </div>
              ))}

              <Divider style={{ margin: "6px 0" }} />

              <Form.Item name="notes" style={{ marginBottom: 6 }}>
                <Input.TextArea
                  rows={2}
                  placeholder="Sale notes..."
                  style={{ borderRadius: 6, fontSize: 12 }}
                  autoSize={{ minRows: 2, maxRows: 2 }}
                />
              </Form.Item>

              <div
                style={{
                  padding: "6px 8px",
                  background:
                    dueAmount === 0
                      ? isDarkMode
                        ? "rgba(149, 222, 100, 0.2)"
                        : "rgba(149, 222, 100, 0.5)"
                      : isDarkMode
                        ? "rgba(255, 120, 117, 0.2)"
                        : "rgba(255, 120, 117, 0.5)",
                  borderRadius: 8,
                  border:
                    dueAmount === 0
                      ? "1px solid rgba(149, 222, 100, 0.4)"
                      : "1px solid rgba(255, 120, 117, 0.4)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text strong style={{ fontSize: 13 }}>
                    <MoneyCollectOutlined style={{ marginRight: 4 }} />{" "}
                    {dueAmount > 0 ? "Due" : "Change"}
                  </Text>
                  <Text strong style={{ fontSize: 18, fontWeight: 700 }}>
                    <Money
                      value={Math.floor(
                        dueAmount > 0 ? dueAmount : changeAmount,
                      )}
                      decimals={0}
                    />
                  </Text>
                </div>
              </div>
            </Card>

            <Card
              style={{
                borderRadius: 10,
                boxShadow: "0 3px 16px rgba(0,0,0,0.12)",
                flexShrink: 0,
                border: "none",
              }}
              bodyStyle={{ padding: 10 }}
            >
              <Row gutter={8}>
                <Col span={8}>
                  <Button
                    size="large"
                    block
                    onClick={handleCancel}
                    disabled={selectedItems.length === 0}
                  >
                    Cancel
                  </Button>
                </Col>
                <Col span={16}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<CalculatorOutlined />}
                    size="large"
                    disabled={selectedItems.length === 0 || loading}
                    loading={loading}
                    block
                    style={{ fontWeight: 700 }}
                  >
                    Complete Sale
                  </Button>
                </Col>
              </Row>
            </Card>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default NewSale;
