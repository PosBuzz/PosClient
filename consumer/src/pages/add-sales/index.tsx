import {
  CalculatorOutlined,
  DeleteOutlined,
  PlusOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { TagOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { salesApi } from "../../api/sales-api";
import CustomerModal from "../../components/CustomerModal";
import PageTitle from "../../components/PageTitle";
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
  SalePayment,
} from "../../types/sale.types";
import {
  Promotion,
  PromotionValidationResponse,
} from "../../types/promotion.types";
import { evaluatePromotionLocally } from "../../utils/promotion-validation";
import { setPageTitle } from "../../utils/setPageTitle";
import {
  getVariantPriceForSale as getVariantPriceForSaleByType,
  removeSaleItem,
  updateSaleItemQuantity,
  updateSaleItemSpecialDiscount,
  upsertVariantInSaleItems as upsertSaleItemVariant,
} from "../../utils/sale-item.utils";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import { useSaleManager } from "../../hooks/useSaleManager";
import {
  getPaymentProviderOptions,
  getPaymentProviderPlaceholder,
  PAYMENT_METHODS_REQUIRING_PROVIDER,
  paymentMethodRequiresProvider,
} from "../../utils/payment-provider.utils";

const { Option } = Select;
const { Text } = Typography;

const NewSale = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();

  // Get quotation_id from URL if converting from quotation
  const quotationId = searchParams.get("quotation_id");

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
    promotionDrawerOpen,
    setPromotionDrawerOpen,
    appliedPromotions,
    setAppliedPromotions,
    dismissedAutoPromotionIds,
    setDismissedAutoPromotionIds,
    applyingPromotionId,
    setApplyingPromotionId,
    promotionEligibilityMap,
    setPromotionEligibilityMap,
    salePayments,
    setSalePayments,
    userBranches,
    productsForSaleQuery,
    activePromotionsQuery,
    handleBranchChange,
  } = useSaleManager({ form, user });

  const [isOnlineOrder, setIsOnlineOrder] = useState(false);
  const isHydratingFromQuotationRef = useRef(false);

  // Load quotation data if converting from quotation
  const quotationQuery = useQuery({
    queryKey: [queryKeys.quotation, parseInt(quotationId || "0")],
    queryFn: () => salesApi.getQuotation(parseInt(quotationId!)),
    enabled: !!quotationId,
    staleTime: 0, // Don't cache, always fetch fresh
  });

  // Check if quotation is already converted and redirect if so
  useEffect(() => {
    if (quotationQuery.data && quotationQuery.data.converted_to_sale_id) {
      messageApi?.error("This quotation has already been converted to a sale");
      navigate(`/quotations/view/${quotationQuery.data.id}`);
    }
  }, [quotationQuery.data, navigate, messageApi]);

  // Pre-fill form from quotation data
  useEffect(() => {
    if (quotationQuery.data && productsForSaleQuery.data) {
      isHydratingFromQuotationRef.current = true;
      const quotation = quotationQuery.data;

      // Set branch
      setSelectedBranch(quotation.branch_id);

      // Set customer
      if (quotation.customer_id) {
        const customer = customers.find((c) => c.id === quotation.customer_id);
        if (customer) {
          setSelectedCustomer(customer);
        }
      }

      // Set price type
      setPriceType(quotation.price_type as PriceType);

      // Pre-fill items from quotation first to calculate actual average discount
      const quotationItems: SaleItem[] =
        quotation.items?.map((item: any) => {
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

          // During quotation conversion, use the current variant price
          // instead of the historical discounted sale_items.unit_price.
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
          const baseAmount = quantity * (Number(baseUnitPrice) || 0);
          const recalculatedTaxAmount =
            taxMethod === "INCLUSIVE"
              ? (baseAmount * taxPercentage) / 100
              : (baseAmount * taxPercentage) / 100;
          const recalculatedLineTotal =
            taxMethod === "INCLUSIVE"
              ? baseAmount
              : baseAmount + recalculatedTaxAmount;

          return {
            variant_id: item.variant_id,
            variant_name: item.variant?.name || "",
            variant_sku: item.variant?.sku || "",
            quantity,
            unit_price: Number(baseUnitPrice) || 0,
            average_discount_amount: Number(item.average_discount_amount) || 0,
            special_discount_amount: Number(item.special_discount_amount) || 0,
            promotion_discount_amount:
              Number(item.promotion_discount_amount) || 0,
            applied_promotion_id: item.applied_promotion_id || undefined,
            tax_amount: Number(recalculatedTaxAmount) || 0,
            line_total: Number(recalculatedLineTotal) || 0,
            product_name: item.variant?.product?.name || "",
            regular_price: regularPrice,
            wholesale_price: wholesalePrice,
            image: item.variant?.image,
            unit_name: item.variant?.sale_unit?.name || "",
            tax_percentage: taxPercentage,
            tax_method: taxMethod,
          };
        }) || [];

      // Calculate actual average discount from items only (not total discount)
      const totalAverageDiscount = quotationItems.reduce(
        (sum, item) => sum + Number(item.average_discount_amount || 0),
        0,
      );
      const rawBaseSubtotal = quotationItems.reduce(
        (sum, item) =>
          sum + Number(item.unit_price) * Number(item.quantity || 0),
        0,
      );

      const averageDiscountValue =
        quotation.discount_type === "percentage" && rawBaseSubtotal > 0
          ? (totalAverageDiscount / rawBaseSubtotal) * 100
          : totalAverageDiscount;

      // Set form values
      form.setFieldsValue({
        branch_id: quotation.branch_id,
        customer_id: quotation.customer_id,
        customer_name: quotation.customer_name,
        customer_phone: quotation.customer_phone,
        customer_email: quotation.customer_email,
        average_discount_amount: averageDiscountValue,
        shipping_cost: quotation.shipping_cost,
        notes: quotation.notes,
      });

      setAverageDiscountType(
        (quotation.discount_type as DiscountType) || DiscountType.FLAT,
      );

      const appliedPromotionIds = Array.from(
        new Set(
          quotation.items
            ?.map((item: any) => Number(item.applied_promotion_id || 0))
            .filter((id: number) => id > 0) || [],
        ),
      );

      if (appliedPromotionIds.length > 0 && activePromotionsQuery.data) {
        const restoredPromotions = activePromotionsQuery.data.filter(
          (promotion) => appliedPromotionIds.includes(promotion.id),
        );

        const missingPromotionIds = appliedPromotionIds.filter(
          (id) => !restoredPromotions.some((promotion) => promotion.id === id),
        );

        const fallbackPromotions = missingPromotionIds
          .map((id) => {
            const sourceItem = quotation.items?.find(
              (item: any) => Number(item.applied_promotion_id) === id,
            );
            const sourcePromotion = sourceItem?.applied_promotion as any;
            if (!sourcePromotion) {
              return null;
            }

            return {
              id: Number(sourcePromotion.id),
              name: sourcePromotion.name || `Promotion #${id}`,
              description: sourcePromotion.description || "",
              scope: sourcePromotion.scope || "SINGLE_PRODUCT",
              discount_type: sourcePromotion.discount_type || "percentage",
              discount_value: Number(sourcePromotion.discount_value || 0),
              start_date:
                sourcePromotion.start_date || new Date(0).toISOString(),
              end_date: sourcePromotion.end_date || undefined,
              is_active: true,
              min_purchase: Number(sourcePromotion.min_purchase || 0),
              min_quantity: Number(sourcePromotion.min_quantity || 1),
              usage_limit: sourcePromotion.usage_limit,
              cap_quantity: sourcePromotion.cap_quantity,
              max_discount_amount: sourcePromotion.max_discount_amount,
              cap_discount_amount: sourcePromotion.cap_discount_amount,
              member_only: Boolean(sourcePromotion.member_only),
              limit_per_customer: Boolean(sourcePromotion.limit_per_customer),
              customer_usage_limit: sourcePromotion.customer_usage_limit,
              customer_usage_daily_reset: Boolean(
                sourcePromotion.customer_usage_daily_reset,
              ),
              auto_apply: false,
              branch_specific: false,
              branch_ids: [],
              variant_ids: [],
              brand_id: sourcePromotion.brand_id,
              products: [],
              branches: [],
              sales_count: 0,
              total_discount_given: 0,
              total_discounted_sales: 0,
            };
          })
          .filter(Boolean) as Promotion[];

        setAppliedPromotions([...restoredPromotions, ...fallbackPromotions]);
      } else {
        setAppliedPromotions([]);
      }

      setSelectedItems(quotationItems);
      setTimeout(() => {
        isHydratingFromQuotationRef.current = false;
      }, 0);
    }
  }, [
    quotationQuery.data,
    productsForSaleQuery.data,
    activePromotionsQuery.data,
    customers,
    form,
    messageApi,
  ]);

  // Auto-apply promotions when cart changes
  useEffect(() => {
    const tryAutoApplyPromotions = async () => {
      if (isHydratingFromQuotationRef.current) {
        return;
      }

      if (
        selectedItems.length === 0 ||
        !selectedBranch ||
        !activePromotionsQuery.data ||
        activePromotionsQuery.data.length === 0
      ) {
        return;
      }

      const autoApplyPromotions = activePromotionsQuery.data.filter(
        (p) => p.auto_apply && p.is_active,
      );

      if (autoApplyPromotions.length === 0) {
        return;
      }

      // Keep a dismissed auto promotion blocked only while it stays eligible.
      // If conditions no longer match, unblock it so it can auto-apply later.
      setDismissedAutoPromotionIds((prev) => {
        if (prev.length === 0) {
          return prev;
        }

        const retained = prev.filter((promotionId) => {
          const promotion = autoApplyPromotions.find(
            (p) => p.id === promotionId,
          );
          if (!promotion) {
            return false;
          }

          const validation = evaluatePromotionForItems(
            promotion,
            selectedItems,
          );
          return validation.is_eligible;
        });

        return retained.length === prev.length ? prev : retained;
      });

      const alreadyAppliedIds = new Set(appliedPromotions.map((p) => p.id));
      const dismissedIds = new Set(dismissedAutoPromotionIds);
      const promotionsToAdd: Promotion[] = [];

      for (const promotion of autoApplyPromotions) {
        if (
          alreadyAppliedIds.has(promotion.id) ||
          dismissedIds.has(promotion.id)
        ) {
          continue;
        }

        const validation = evaluatePromotionForItems(promotion, selectedItems);

        if (validation.is_eligible) {
          promotionsToAdd.push(promotion);
        }
      }

      if (promotionsToAdd.length > 0) {
        setAppliedPromotions((prev) => [...prev, ...promotionsToAdd]);
        messageApi?.success(
          `${promotionsToAdd.map((p) => p.name).join(", ")} auto-applied`,
        );
      }
    };

    tryAutoApplyPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedItems,

    selectedBranch,

    selectedCustomer?.id,

    activePromotionsQuery.data,
    appliedPromotions,
    dismissedAutoPromotionIds,
  ]);

  const upsertVariantInSaleItems = (
    sourceItems: SaleItem[],
    variant: ProductVariantForSale,
    quantityToAdd: number,
  ) => {
    return upsertSaleItemVariant({
      sourceItems,
      variant,
      quantityToAdd,
      priceType,
    });
  };

  const addToSale = (variant: ProductVariantForSale) => {
    setSelectedItems((items) => upsertVariantInSaleItems(items, variant, 1));
  };

  const variantBrandById = useMemo(() => {
    const map: Record<number, number | undefined> = {};
    for (const variant of filteredVariants) {
      map[variant.id] = variant.brand_id ? Number(variant.brand_id) : undefined;
    }
    return map;
  }, [filteredVariants]);

  const evaluatePromotionForItems = (
    promotion: Promotion,
    items: SaleItem[],
  ): PromotionValidationResponse => {
    return evaluatePromotionLocally({
      promotion,
      items,
      branchId: selectedBranch,
      customerId: selectedCustomer?.id,
      variantBrandById,
    });
  };

  const getVariantPriceForSale = (variant: ProductVariantForSale) => {
    return getVariantPriceForSaleByType(variant, priceType);
  };

  const getPromotionRequiredVariantIds = (promotion: Promotion) => {
    if (promotion.scope === "BRAND") {
      return [];
    }

    return promotion.variant_ids?.length > 0
      ? promotion.variant_ids
      : promotion.products?.map((item) => item.variant_id) || [];
  };

  const getPromotionCandidateVariants = (promotion: Promotion) => {
    if (promotion.scope === "BRAND") {
      return filteredVariants.filter(
        (variant) =>
          promotion.brand_id &&
          Number(variant.brand_id) === Number(promotion.brand_id),
      );
    }

    const requiredIds = getPromotionRequiredVariantIds(promotion);
    return requiredIds
      .map((variantId) =>
        filteredVariants.find((variant) => variant.id === variantId),
      )
      .filter(Boolean) as ProductVariantForSale[];
  };

  const enrichCartForPromotion = (
    promotion: Promotion,
    sourceItems: SaleItem[],
    reason?: string,
  ) => {
    let nextItems = [...sourceItems];
    let changed = false;
    const reasonText = (reason || "").toLowerCase();

    const requiredIds = getPromotionRequiredVariantIds(promotion);
    const requiredVariants = requiredIds
      .map((variantId) =>
        filteredVariants.find((variant) => variant.id === variantId),
      )
      .filter(Boolean) as ProductVariantForSale[];

    if (promotion.scope !== "BRAND") {
      const existingIds = new Set(nextItems.map((item) => item.variant_id));
      const missingRequired = requiredVariants.filter(
        (variant) => !existingIds.has(variant.id),
      );

      if (missingRequired.length > 0) {
        missingRequired.forEach((variant) => {
          nextItems = upsertVariantInSaleItems(nextItems, variant, 1);
          changed = true;
        });
      }
    }

    const candidateVariants = getPromotionCandidateVariants(promotion);
    const highestPriceVariant = [...candidateVariants].sort(
      (a, b) => getVariantPriceForSale(b) - getVariantPriceForSale(a),
    )[0];

    if (!highestPriceVariant) {
      return { items: nextItems, changed };
    }

    const candidateIds = new Set(
      candidateVariants.map((variant) => variant.id),
    );
    const currentMatchedQty = nextItems.reduce((sum, item) => {
      return candidateIds.has(item.variant_id)
        ? sum + Number(item.quantity || 0)
        : sum;
    }, 0);

    const minQty = Number(promotion.min_quantity || 1);
    const currentSubtotal = nextItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );
    const minPurchase = Number(promotion.min_purchase || 0);

    const needsMinQty =
      currentMatchedQty < minQty || reasonText.includes("minimum quantity");
    if (needsMinQty) {
      const qtyToAdd = Math.max(1, minQty - currentMatchedQty);
      nextItems = upsertVariantInSaleItems(
        nextItems,
        highestPriceVariant,
        qtyToAdd,
      );
      changed = true;
    }

    const recalculatedSubtotal = nextItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );
    const needsMinPurchase =
      recalculatedSubtotal < minPurchase ||
      reasonText.includes("minimum purchase");

    if (needsMinPurchase) {
      const unitPrice = Math.max(
        0.01,
        getVariantPriceForSale(highestPriceVariant),
      );
      const qtyToAdd = Math.max(
        1,
        Math.ceil(Math.max(0, minPurchase - recalculatedSubtotal) / unitPrice),
      );
      nextItems = upsertVariantInSaleItems(
        nextItems,
        highestPriceVariant,
        qtyToAdd,
      );
      changed = true;
    }

    if (
      !changed &&
      (reasonText.includes("required product") ||
        reasonText.includes("bundle") ||
        reasonText.includes("no matching brand"))
    ) {
      nextItems = upsertVariantInSaleItems(nextItems, highestPriceVariant, 1);
      changed = true;
    }

    if (!changed && currentSubtotal < minPurchase) {
      const unitPrice = Math.max(
        0.01,
        getVariantPriceForSale(highestPriceVariant),
      );
      const qtyToAdd = Math.max(
        1,
        Math.ceil(Math.max(0, minPurchase - currentSubtotal) / unitPrice),
      );
      nextItems = upsertVariantInSaleItems(
        nextItems,
        highestPriceVariant,
        qtyToAdd,
      );
      changed = true;
    }

    return { items: nextItems, changed };
  };

  useEffect(() => {
    let cancelled = false;

    const evaluatePromotionsForCurrentCart = async () => {
      if (
        !promotionDrawerOpen ||
        !selectedBranch ||
        !activePromotionsQuery.data ||
        activePromotionsQuery.data.length === 0 ||
        selectedItems.length === 0
      ) {
        setPromotionEligibilityMap({});
        return;
      }

      const evaluations = await Promise.all(
        activePromotionsQuery.data.map(async (promotion) => {
          const validation = evaluatePromotionForItems(
            promotion,
            selectedItems,
          );
          return [promotion.id, validation] as const;
        }),
      );

      if (cancelled) {
        return;
      }

      setPromotionEligibilityMap(Object.fromEntries(evaluations));
    };

    evaluatePromotionsForCurrentCart();

    return () => {
      cancelled = true;
    };
  }, [
    promotionDrawerOpen,
    selectedBranch,
    selectedCustomer?.id,
    selectedItems,
    activePromotionsQuery.data,
  ]);

  useEffect(() => {
    if (isHydratingFromQuotationRef.current) {
      return;
    }

    if (appliedPromotions.length === 0) {
      return;
    }

    if (!selectedBranch || selectedItems.length === 0) {
      setAppliedPromotions([]);
      if (selectedItems.length === 0) {
        messageApi?.warning("Applied promotions removed: cart is empty");
      }
      return;
    }

    const kept: Promotion[] = [];
    const removed: string[] = [];

    appliedPromotions.forEach((promotion) => {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (validation.is_eligible) {
        kept.push(promotion);
      } else {
        removed.push(promotion.name);
      }
    });

    if (removed.length > 0) {
      setAppliedPromotions(kept);
      messageApi?.warning(
        `Removed ineligible promotions: ${removed.join(", ")}`,
      );
    }
  }, [
    appliedPromotions,
    selectedItems,
    selectedBranch,
    selectedCustomer?.id,
    variantBrandById,
    messageApi,
  ]);

  const clearAppliedPromotions = () => {
    const autoEligiblePromotionIds = appliedPromotions
      .filter((promotion) => {
        if (!promotion.auto_apply) {
          return false;
        }
        const validation = evaluatePromotionForItems(promotion, selectedItems);
        return validation.is_eligible;
      })
      .map((promotion) => promotion.id);

    if (autoEligiblePromotionIds.length > 0) {
      setDismissedAutoPromotionIds((prev) =>
        Array.from(new Set([...prev, ...autoEligiblePromotionIds])),
      );
    }

    setAppliedPromotions([]);
  };

  const removeAppliedPromotion = (promotionId: number) => {
    const promotion = appliedPromotions.find((p) => p.id === promotionId);
    if (promotion?.auto_apply) {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (validation.is_eligible) {
        setDismissedAutoPromotionIds((prev) =>
          prev.includes(promotionId) ? prev : [...prev, promotionId],
        );
      }
    }

    setAppliedPromotions((prev) => prev.filter((p) => p.id !== promotionId));
  };

  const applyPromotionToCurrentSale = (promotion: Promotion) => {
    if (!selectedBranch) {
      messageApi?.error("Please select a branch before applying a promotion");
      return;
    }

    if (appliedPromotions.some((item) => item.id === promotion.id)) {
      messageApi?.info(`${promotion.name} is already applied`);
      return;
    }

    let workingItems = [...selectedItems];
    let cartUpdated = false;

    setApplyingPromotionId(promotion.id);

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (workingItems.length === 0) {
          const enriched = enrichCartForPromotion(promotion, workingItems);
          if (enriched.changed) {
            workingItems = enriched.items;
            cartUpdated = true;
          }
        }

        if (workingItems.length === 0) {
          break;
        }

        const validation = evaluatePromotionForItems(promotion, workingItems);

        if (validation.is_eligible) {
          if (cartUpdated) {
            setSelectedItems(workingItems);
          }

          setAppliedPromotions((prev) => [...prev, promotion]);
          messageApi?.success(`${promotion.name} applied`);
          setPromotionDrawerOpen(false);
          return;
        }

        const enriched = enrichCartForPromotion(
          promotion,
          workingItems,
          validation.reason,
        );

        if (!enriched.changed) {
          if (cartUpdated) {
            setSelectedItems(workingItems);
          }
          messageApi?.error(
            validation.reason || "Promotion conditions not matched",
          );
          return;
        }

        workingItems = enriched.items;
        cartUpdated = true;
      }

      if (cartUpdated) {
        setSelectedItems(workingItems);
      }

      messageApi?.error("Promotion conditions not matched");
    } finally {
      setApplyingPromotionId(null);
    }
  };

  // Handle barcode scanning
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
        console.error("Error scanning barcode:", error);
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

  const updateItemSpecialDiscount = (variantId: number, discount: number) => {
    setSelectedItems((items) =>
      updateSaleItemSpecialDiscount(items, variantId, discount),
    );
  };

  const calculateTotals = () => {
    const round2 = (value: number) => Number((value || 0).toFixed(2));
    const getItemBaseAmount = (item: SaleItem) => {
      const taxMethod = String(item.tax_method || "EXCLUSIVE").toUpperCase();
      if (taxMethod === "INCLUSIVE") {
        return Math.max(
          0,
          Number(item.line_total) - Number(item.tax_amount || 0),
        );
      }
      return Number(item.unit_price) * Number(item.quantity);
    };

    // Calculate subtotal for sale totals (price before tax for exclusive, pre-tax base for inclusive)
    const subtotal = selectedItems.reduce((sum, item) => {
      return sum + getItemBaseAmount(item);
    }, 0);

    // Average discount must be based on raw base price regardless of tax method.
    const averageDiscountBaseSubtotal = selectedItems.reduce((sum, item) => {
      return sum + Number(item.unit_price) * Number(item.quantity || 0);
    }, 0);

    const totalTax = selectedItems.reduce(
      (sum, item) => sum + (Number(item.tax_amount) || 0),
      0,
    );

    const averageDiscountAmountNum = Number(averageDiscountAmount) || 0;
    const shippingCostNum = Number(shippingCost) || 0;

    const averageDiscount =
      averageDiscountType === DiscountType.PERCENTAGE
        ? (averageDiscountBaseSubtotal * averageDiscountAmountNum) / 100
        : averageDiscountAmountNum;

    const specialDiscount = selectedItems.reduce(
      (sum, item) => sum + (Number(item.special_discount_amount) || 0),
      0,
    );

    const variantAverageBaseMap = new Map<number, number>();
    const variantPromoBaseMap = new Map<number, number>();
    const variantQuantityMap = new Map<number, number>();
    selectedItems.forEach((item) => {
      const rawBase = Number(item.unit_price) * Number(item.quantity || 0);
      variantAverageBaseMap.set(item.variant_id, Number(rawBase) || 0);
      variantPromoBaseMap.set(item.variant_id, Number(rawBase) || 0);
      variantQuantityMap.set(item.variant_id, Number(item.quantity || 0));
    });

    const distributeDiscount = (
      totalDiscount: number,
      baseMap: Map<number, number>,
    ) => {
      const distributed = new Map<number, number>();
      if (
        totalDiscount <= 0 ||
        selectedItems.length === 0 ||
        averageDiscountBaseSubtotal <= 0
      ) {
        selectedItems.forEach((item) => distributed.set(item.variant_id, 0));
        return distributed;
      }

      let assigned = 0;
      selectedItems.forEach((item, index) => {
        const isLast = index === selectedItems.length - 1;
        if (isLast) {
          distributed.set(item.variant_id, round2(totalDiscount - assigned));
          return;
        }
        const base = baseMap.get(item.variant_id) || 0;
        const share = round2(
          (totalDiscount * base) / averageDiscountBaseSubtotal,
        );
        distributed.set(item.variant_id, share);
        assigned += share;
      });

      return distributed;
    };

    const averageDiscountMap = distributeDiscount(
      Number(averageDiscount) || 0,
      variantAverageBaseMap,
    );

    const promotionChoiceByVariant = new Map<
      number,
      {
        amount: number;
        promotionId: number;
        promotionName: string;
        promotionMatchedQuantity: number;
      }
    >();

    for (const promotion of appliedPromotions) {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (!validation.is_eligible) {
        continue;
      }

      const matchedVariantIds = (validation.matched_variant_ids || []).filter(
        (id) => selectedItems.some((item) => item.variant_id === id),
      );

      if (matchedVariantIds.length === 0) {
        continue;
      }

      const promotionMatchedQuantity = matchedVariantIds.reduce(
        (sum, variantId) => sum + (variantQuantityMap.get(variantId) || 0),
        0,
      );

      const matchedBaseTotal = matchedVariantIds.reduce(
        (sum, variantId) => sum + (variantPromoBaseMap.get(variantId) || 0),
        0,
      );

      const promoTotal = Number(validation.discount_amount || 0);
      if (promoTotal <= 0 || matchedBaseTotal <= 0) {
        continue;
      }

      let assigned = 0;

      matchedVariantIds.forEach((variantId, index) => {
        const isLast = index === matchedVariantIds.length - 1;
        const nextAmount = isLast
          ? round2(promoTotal - assigned)
          : round2(
              (promoTotal * (variantPromoBaseMap.get(variantId) || 0)) /
                matchedBaseTotal,
            );

        assigned += nextAmount;

        const existing = promotionChoiceByVariant.get(variantId);
        const shouldReplace =
          !existing ||
          nextAmount > existing.amount ||
          (nextAmount === existing.amount &&
            promotionMatchedQuantity > existing.promotionMatchedQuantity);

        if (shouldReplace) {
          promotionChoiceByVariant.set(variantId, {
            amount: nextAmount,
            promotionId: promotion.id,
            promotionName: promotion.name,
            promotionMatchedQuantity,
          });
        }
      });
    }

    const promotionDiscountMap = new Map<number, number>();
    promotionChoiceByVariant.forEach((value, variantId) => {
      promotionDiscountMap.set(variantId, round2(value.amount));
    });

    const promotionDiscountAmount = Array.from(
      promotionDiscountMap.values(),
    ).reduce((sum, value) => sum + Number(value || 0), 0);

    // Total discount = average + special + promotion
    const finalDiscount =
      promotionDiscountAmount + averageDiscount + specialDiscount;

    // Total = subtotal - total_discount + tax + shipping
    const total = subtotal - finalDiscount + totalTax + shippingCostNum;

    const discountBreakdownByVariant: Record<
      number,
      {
        average: number;
        special: number;
        promotion: number;
        total: number;
        appliedPromotionId?: number;
        appliedPromotionName?: string;
        appliedPromotionMatchedQuantity?: number;
      }
    > = {};

    const discountedItems = selectedItems.map((item) => {
      const averageShare = Number(averageDiscountMap.get(item.variant_id) || 0);
      const promotionShare = Number(
        promotionDiscountMap.get(item.variant_id) || 0,
      );
      const specialShare = Number(item.special_discount_amount || 0);

      discountBreakdownByVariant[item.variant_id] = {
        average: round2(averageShare),
        special: round2(specialShare),
        promotion: round2(promotionShare),
        total: round2(averageShare + specialShare + promotionShare),
        appliedPromotionId: promotionChoiceByVariant.get(item.variant_id)
          ?.promotionId,
        appliedPromotionName: promotionChoiceByVariant.get(item.variant_id)
          ?.promotionName,
        appliedPromotionMatchedQuantity: promotionChoiceByVariant.get(
          item.variant_id,
        )?.promotionMatchedQuantity,
      };

      // Calculate net line_total (after all discounts)
      const totalDiscount = averageShare + specialShare + promotionShare;
      const netLineTotal = round2(Number(item.line_total) - totalDiscount);

      // Calculate new unit_price = net_line_total / quantity
      const newUnitPrice = round2(netLineTotal / Number(item.quantity || 1));

      return {
        ...item,
        unit_price: newUnitPrice,
        line_total: netLineTotal,
        average_discount_amount: round2(averageShare),
        special_discount_amount: round2(specialShare),
        promotion_discount_amount: round2(promotionShare),
        applied_promotion_id: promotionChoiceByVariant.get(item.variant_id)
          ?.promotionId,
      };
    });

    return {
      subtotal: Number(subtotal),
      totalTax: Number(totalTax),
      promotionDiscount: Number(promotionDiscountAmount),
      averageDiscount: Number(averageDiscount),
      specialDiscount: Number(specialDiscount),
      finalDiscount: Number(finalDiscount),
      discountBreakdownByVariant,
      discountedItems,
      shippingCost: Number(shippingCostNum),
      total: Number(total),
    };
  };

  const onFinish = async (values: any) => {
    if (selectedItems.length === 0) {
      messageApi?.error("Please add at least one item to the sale");
      return;
    }

    // Check if payments are configured
    if (salePayments.length === 0) {
      messageApi?.error("Please add at least one payment method");
      return;
    }
    for (const payment of salePayments) {
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
    const totals = calculateTotals();
    const totalPaymentAmount = salePayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    // Determine payment status
    let paymentStatus = PaymentStatus.PAID;
    if (totalPaymentAmount < totals.total) {
      paymentStatus = PaymentStatus.PARTIAL;
    } else if (totalPaymentAmount === 0) {
      paymentStatus = PaymentStatus.DUE;
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
        average_discount_amount: item.average_discount_amount,
        special_discount_amount: item.special_discount_amount,
        promotion_discount_amount: item.promotion_discount_amount,
        applied_promotion_id: item.applied_promotion_id,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        // Remove batch_id to let backend use FIFO automatically
      })),
      price_type: priceType,
      discount_amount: totals.finalDiscount,
      applied_promotion_id: undefined,
      shipping_cost: totals.shippingCost,
      payment_status: paymentStatus,
      received_amount: totalPaymentAmount,
      payments: salePayments,
      quotation_id: quotationId ? parseInt(quotationId) : undefined,
      is_online_order: isOnlineOrder,
      online_order_status: isOnlineOrder ? "PENDING" : undefined,
    };

    try {
      setLoading(true);
      const createdSale = await salesApi.createSale(saleData);

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
      paymentStatus === PaymentStatus.PARTIAL &&
        queryClient.invalidateQueries({
          queryKey: [queryKeys.partialPayments],
        });

      messageApi?.success("Sale created successfully!");
      navigate(`/sales/view/${createdSale.id}`);
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
  const effectiveAppliedPromotions = appliedPromotions.filter((promotion) =>
    Object.values(totals.discountBreakdownByVariant || {}).some(
      (breakdown) => breakdown.appliedPromotionId === promotion.id,
    ),
  );

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
      title: "Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => `$${(Number(price) || 0).toFixed(2)}`,
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
            onPressEnter={(e) => {
              // Just blur the input, the global handler will handle form submission
              (e.target as HTMLInputElement).blur();
            }}
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
        return `$${(Number(record.tax_amount) || 0).toFixed(2)} (${taxLabel})`;
      },
    },
    {
      title: "Avg Disc",
      key: "average_discount",
      render: (record: SaleItem) => {
        const avgDiscount =
          totals.discountBreakdownByVariant?.[record.variant_id]?.average || 0;
        return `-$${(Number(avgDiscount) || 0).toFixed(2)}`;
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
            <span>{`-$${(Number(promoDiscount) || 0).toFixed(2)}`}</span>
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
        return `$${(Number(netLineTotal) || 0).toFixed(2)}`;
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
      {setPageTitle("New Sale")}
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
        onCreateCustomer={async (customer) => {
          try {
            const newCustomer = await post(endpoints.createCustomer, customer);
            setSelectedCustomer(newCustomer);
            setCustomers([...customers, newCustomer]);
            form.setFieldsValue({ customer_id: newCustomer.id });

            // Invalidate customers cache
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
                      applyPromotionToCurrentSale(promotion);
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
                          : `$${Number(promotion.discount_value).toFixed(2)} discount`}
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
                      const servedByUser = servedByUsers.find(
                        (u) => u.id === value,
                      );
                      setSelectedServedByUser(servedByUser || null);
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
                  {/* <Button
                    icon={<PlusOutlined />}
                    onClick={() => setCustomerModalOpen(true)}
                    title="Add new customer"
                  /> */}
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
            onChange={(value) => {
              if (value) {
                const selectedVariant = filteredVariants.find(
                  (v) => v.id === value,
                );
                if (selectedVariant) {
                  addToSale(selectedVariant);
                }
              }
            }}
            filterOption={(input, option) =>
              (option?.label?.toString().toLowerCase() || "").includes(
                input.toLowerCase(),
              )
            }
            loading={productsForSaleQuery.isLoading}
            disabled={!selectedBranch}
          >
            {filteredVariants.map((variant) => (
              <Option
                key={variant.id}
                value={variant.id}
                label={`${variant.product_name} - ${variant.name}`}
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
          <h3 style={{ marginBottom: 12 }}>Sale Items</h3>
          <Table
            columns={saleItemColumns}
            dataSource={selectedItems}
            rowKey={(record) => record.variant_id}
            size="small"
            pagination={false}
            locale={{ emptyText: "No items added yet" }}
          />
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
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
                <Button
                  type="link"
                  size="small"
                  onClick={clearAppliedPromotions}
                >
                  Remove All Promotions
                </Button>
              </Space>
            </div>
          ) : null}
          <Row gutter={16}>
            <Col span={8}>
              <Row gutter={8}>
                <Col span={10}>
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
                <Col span={7}>
                  <Form.Item
                    label="Avg Discount"
                    name="average_discount_amount"
                  >
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="small"
                      placeholder="0"
                      onPressEnter={(e) => {
                        (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={7}>
                  <Form.Item label="Shipping" name="shipping_cost">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="small"
                      placeholder="0"
                      onPressEnter={(e) => {
                        // Just blur the input, the global handler will handle form submission
                        (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 12, fontSize: 14 }}>
                  Payment Methods
                </h4>

                <div style={{ marginBottom: 8 }}>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      const remainingAmount = Math.max(
                        0,
                        totals.total -
                          salePayments.reduce((sum, p) => sum + p.amount, 0),
                      );
                      const newPayment: SalePayment = {
                        payment_method: PaymentMethod.CASH,
                        amount:
                          remainingAmount > 0 ? remainingAmount : totals.total,
                        reference: "",
                        // notes: "",
                      };
                      setSalePayments([...salePayments, newPayment]);
                    }}
                    style={{ width: "100%" }}
                  >
                    Add Payment Method
                  </Button>
                </div>

                <div style={{ minHeight: "auto" }}>
                  {salePayments.map((payment, index) => {
                    const requiresProvider = paymentMethodRequiresProvider(
                      payment.payment_method,
                    );
                    const providerOptions = getPaymentProviderOptions(
                      payment.payment_method,
                    );

                    return (
                      <div key={index} style={{ marginBottom: 8 }}>
                        <Row gutter={4}>
                          {/* Payment Method */}
                          <Col span={6}>
                            <Select
                              size="small"
                              value={payment.payment_method}
                              onChange={(value) => {
                                const updatedPayments = [...salePayments];
                                updatedPayments[index] = {
                                  ...updatedPayments[index],
                                  payment_method: value,
                                  payment_type: undefined, // reset subtype on method change
                                };
                                setSalePayments(updatedPayments);
                              }}
                              style={{ width: "100%" }}
                              placeholder="Method"
                            >
                              <Option value={PaymentMethod.CASH}>Cash</Option>
                              <Option value={PaymentMethod.CARD}>Card</Option>
                              <Option value={PaymentMethod.CHEQUE}>
                                Cheque
                              </Option>
                              <Option value={PaymentMethod.BANK_TRANSFER}>
                                Bank Transfer
                              </Option>
                              <Option value={PaymentMethod.MOBILE_MONEY}>
                                Mobile Money
                              </Option>
                              <Option value={PaymentMethod.MFS}>MFS</Option>
                              <Option value={PaymentMethod.CREDIT}>
                                Credit
                              </Option>
                              <Option value={PaymentMethod.EXCHANGE}>
                                Exchange
                              </Option>
                            </Select>
                          </Col>

                          {/* Bank or MFS sub-selector */}
                          <Col span={requiresProvider ? 7 : 0}>
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
                              />
                            ) : null}
                          </Col>

                          {/* Amount */}
                          <Col span={requiresProvider ? 4 : 6}>
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
                              placeholder="0.00"
                            />
                          </Col>

                          {/* Reference */}
                          <Col span={requiresProvider ? 5 : 6}>
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
                              placeholder="Reference"
                            />
                          </Col>

                          {/* Delete */}
                          <Col span={2}>
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                setSalePayments(
                                  salePayments.filter((_, i) => i !== index),
                                );
                              }}
                            />
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                    ${(Number(totals.subtotal) || 0).toFixed(2)}
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
                    ${(Number(totals.totalTax) || 0).toFixed(2)}
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
                      -${(Number(totals.promotionDiscount) || 0).toFixed(2)}
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
                      -${(Number(totals.averageDiscount) || 0).toFixed(2)}
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
                      -${(Number(totals.specialDiscount) || 0).toFixed(2)}
                    </Text>
                  </div>
                )}
                {/* {totals.promotionDiscount === 0 &&
                  totals.averageDiscount === 0 &&
                  totals.specialDiscount === 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 12 }}>Discount:</Text>
                        <Text style={{ fontSize: 12 }}>
                          -${(Number(totals.finalDiscount) || 0).toFixed(2)}
                        </Text>
                      </div>
                    )} */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Shipping:</Text>
                  <Text style={{ fontSize: 12 }}>
                    ${(Number(totals.shippingCost) || 0).toFixed(2)}
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
                    ${(Number(totals.total) || 0).toFixed(2)}
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
                      color:
                        Math.max(
                          0,
                          salePayments.reduce((sum, p) => sum + p.amount, 0) -
                            totals.total,
                        ) >= 0
                          ? "#52c41a"
                          : "#ff4d4f",
                    }}
                  >
                    $
                    {Math.max(
                      0,
                      salePayments.reduce((sum, p) => sum + p.amount, 0) -
                        totals.total,
                    ).toFixed(2)}
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
              <Form.Item
                name="is_online_order"
                valuePropName="checked"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                <Checkbox
                  checked={isOnlineOrder}
                  onChange={(e) => setIsOnlineOrder(e.target.checked)}
                >
                  This is an Online Order
                </Checkbox>
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
                    disabled={selectedItems.length === 0 || loading}
                    loading={loading}
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

export default NewSale;
