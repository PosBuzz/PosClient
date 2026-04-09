import {
  ArrowLeftOutlined,
  BankOutlined,
  CalculatorOutlined,
  CreditCardOutlined,
  DeleteOutlined,
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
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Promotion,
  PromotionValidationResponse,
} from "../../types/promotion.types";
import { evaluatePromotionLocally } from "../../utils/promotion-validation";
import { setPageTitle } from "../../utils/setPageTitle";
import {
  removeSaleItem,
  updateSaleItemQuantity,
  updateSaleItemSpecialDiscount,
  upsertVariantInSaleItems as upsertSaleItemVariant,
} from "../../utils/sale-item.utils";
import {
  getPaymentProviderOptions,
  getPaymentProviderPlaceholder,
  PAYMENT_METHODS_REQUIRING_PROVIDER,
  paymentMethodRequiresProvider,
} from "../../utils/payment-provider.utils";
import { useSaleManager } from "../../hooks/useSaleManager";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import useDarkMode from "../../hooks/useDarkMode";

const { Option } = Select;
const { Text } = Typography;

const NewSale = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();
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

  // --- Helper function to reset sale data ---
  const resetSaleData = useCallback(() => {
    // Preserve values
    const currentBranchId = form.getFieldValue("branch_id");
    const currentServedById = form.getFieldValue("served_by_id");

    // Reset states
    setSelectedItems([]);
    setSelectedCustomer(null);
    // Note: We do NOT reset selectedBranch or selectedServedByUser state variables
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
      Modal.confirm({
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
      // If cart is empty, just clear silently or notify
      resetSaleData();
    }
  }, [resetSaleData, selectedItems.length]);

  // Auto-apply promotions when cart changes
  useEffect(() => {
    const tryAutoApplyPromotions = async () => {
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

      setDismissedAutoPromotionIds((prev) => {
        if (prev.length === 0) {
          return prev;
        }

        const retained = prev.filter((promotionId) => {
          const promotion = autoApplyPromotions.find(
            (item) => item.id === promotionId,
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

      const alreadyAppliedIds = new Set(
        appliedPromotions.map((item) => item.id),
      );
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
          `${promotionsToAdd.map((promotion) => promotion.name).join(", ")} auto-applied`,
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
    return priceType === PriceType.WHOLESALE
      ? Number(variant.wholesale_price) || Number(variant.regular_price)
      : Number(variant.regular_price);
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
    if (appliedPromotions.length === 0 || !selectedBranch) {
      return;
    }

    if (selectedItems.length === 0) {
      setAppliedPromotions([]);
      setDismissedAutoPromotionIds([]);
      messageApi?.warning("Applied promotions removed: cart is empty");
      return;
    }

    // Validate all applied promotions are still eligible
    const stillValidPromotions = appliedPromotions.filter((promotion) => {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (!validation.is_eligible) {
        messageApi?.warning(
          `Promotion removed: ${promotion.name} - ${validation.reason || "conditions no longer match"}`,
        );
        return false;
      }
      return true;
    });

    if (stillValidPromotions.length < appliedPromotions.length) {
      setAppliedPromotions(stillValidPromotions);
    }
  }, [
    appliedPromotions,
    selectedItems,
    selectedBranch,
    selectedCustomer?.id,
    variantBrandById,
  ]);

  const removeAppliedPromotion = (promotionId: number) => {
    const promotion = appliedPromotions.find((item) => item.id === promotionId);
    if (promotion?.auto_apply) {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (validation.is_eligible) {
        setDismissedAutoPromotionIds((prev) =>
          prev.includes(promotionId) ? prev : [...prev, promotionId],
        );
      }
    }

    setAppliedPromotions((prev) =>
      prev.filter((item) => item.id !== promotionId),
    );
  };

  const clearAppliedPromotion = () => {
    setAppliedPromotions([]);
    setDismissedAutoPromotionIds([]);
  };

  const applyPromotionToCurrentSale = (promotion: Promotion) => {
    if (!selectedBranch) {
      messageApi?.error("Please select a branch before applying a promotion");
      return;
    }

    // Check if promotion is already applied
    if (appliedPromotions.some((p) => p.id === promotion.id)) {
      messageApi?.warning(`${promotion.name} is already applied`);
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
    const round2 = (value: number) => Number((value || 0).toFixed(2));

    // Calculate raw base subtotal (price * quantity without tax considerations)
    const averageDiscountBaseSubtotal = selectedItems.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity || 0),
      0,
    );

    // Calculate subtotal (price before tax for both exclusive and inclusive)
    const subtotal = selectedItems.reduce((sum, item) => {
      // For both inclusive and exclusive tax, we need the base amount (price without tax)
      const variant = productsForSaleQuery.data?.find(
        (v) => v.id === item.variant_id,
      );
      const taxMethod = variant?.tax_method || "EXCLUSIVE";

      if (taxMethod === "INCLUSIVE") {
        // For inclusive tax, the subtotal is the line_total minus tax
        return sum + (Number(item.line_total) - Number(item.tax_amount));
      } else {
        // For exclusive tax, the subtotal is the base price (unit_price * quantity)
        return sum + Number(item.unit_price) * Number(item.quantity);
      }
    }, 0);

    const totalTax = selectedItems.reduce(
      (sum, item) => sum + (Number(item.tax_amount) || 0),
      0,
    );

    const averageDiscountAmountNum = Number(averageDiscountAmount) || 0;
    const shippingCostNum = Number(shippingCost) || 0;

    // Calculate average discount on raw base (not tax-adjusted)
    const averageDiscount =
      averageDiscountType === DiscountType.PERCENTAGE
        ? (averageDiscountBaseSubtotal * averageDiscountAmountNum) / 100
        : averageDiscountAmountNum;

    const specialDiscount = selectedItems.reduce(
      (sum, item) => sum + (Number(item.special_discount_amount) || 0),
      0,
    );

    // Build variant base map using raw base (unit_price * quantity)
    const variantBaseMap = new Map<number, number>();
    selectedItems.forEach((item) => {
      const baseAmount = Number(item.unit_price) * Number(item.quantity || 0);
      variantBaseMap.set(item.variant_id, Number(baseAmount) || 0);
    });

    const distributeDiscount = (
      totalDiscount: number,
      baseMap?: Map<number, number>,
    ) => {
      const distributed = new Map<number, number>();
      selectedItems.forEach((item) => distributed.set(item.variant_id, 0));

      const currentBaseMap = baseMap || variantBaseMap;
      const targetItems = selectedItems.filter(
        (item) => (currentBaseMap.get(item.variant_id) || 0) > 0,
      );
      const totalBase = targetItems.reduce(
        (sum, item) => sum + (currentBaseMap.get(item.variant_id) || 0),
        0,
      );

      if (totalDiscount <= 0 || targetItems.length === 0 || totalBase <= 0) {
        return distributed;
      }

      let assigned = 0;
      targetItems.forEach((item, index) => {
        const isLast = index === targetItems.length - 1;
        if (isLast) {
          distributed.set(item.variant_id, round2(totalDiscount - assigned));
          return;
        }

        const base = currentBaseMap.get(item.variant_id) || 0;
        const share = round2((totalDiscount * base) / totalBase);
        distributed.set(item.variant_id, share);
        assigned += share;
      });

      return distributed;
    };

    const averageDiscountMap = distributeDiscount(Number(averageDiscount) || 0);

    // Multi-promotion conflict resolution: per variant, keep best promotion
    const promotionChoiceByVariant = new Map<
      number,
      {
        promotionId: number;
        discount: number;
        matchedQty: number;
        matchedVariantCount: number;
        matchedTotalQty: number;
      }
    >();

    for (const promotion of appliedPromotions) {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (!validation.is_eligible) continue;

      const promotionDiscount = Number(validation.discount_amount || 0);
      const matchedVariantIds = new Set(validation.matched_variant_ids || []);
      const matchedVariantCount = matchedVariantIds.size;
      const matchedTotalQty = selectedItems.reduce(
        (sum, item) =>
          matchedVariantIds.has(item.variant_id)
            ? sum + Number(item.quantity || 0)
            : sum,
        0,
      );
      const eligibleBaseMap = new Map<number, number>();

      selectedItems.forEach((item) => {
        if (!matchedVariantIds.has(item.variant_id)) {
          return;
        }

        const base = Number(variantBaseMap.get(item.variant_id) || 0);
        if (base > 0) {
          eligibleBaseMap.set(item.variant_id, base);
        }
      });

      const promotionDiscountMap = distributeDiscount(
        promotionDiscount,
        eligibleBaseMap,
      );

      // For each item in the promotion scope, check if this is the best promo
      selectedItems.forEach((item) => {
        if (!matchedVariantIds.has(item.variant_id)) {
          return;
        }

        const itemDiscount = promotionDiscountMap.get(item.variant_id) || 0;
        if (itemDiscount <= 0) return;

        const matchedQty = Number(item.quantity || 0);
        const current = promotionChoiceByVariant.get(item.variant_id);

        if (!current) {
          promotionChoiceByVariant.set(item.variant_id, {
            promotionId: promotion.id,
            discount: itemDiscount,
            matchedQty,
            matchedVariantCount,
            matchedTotalQty,
          });
        } else if (
          itemDiscount > current.discount ||
          (itemDiscount === current.discount &&
            (matchedVariantCount > current.matchedVariantCount ||
              (matchedVariantCount === current.matchedVariantCount &&
                (matchedTotalQty > current.matchedTotalQty ||
                  (matchedTotalQty === current.matchedTotalQty &&
                    matchedQty > current.matchedQty) ||
                  (matchedTotalQty === current.matchedTotalQty &&
                    matchedQty === current.matchedQty &&
                    promotion.id < current.promotionId)))))
        ) {
          promotionChoiceByVariant.set(item.variant_id, {
            promotionId: promotion.id,
            discount: itemDiscount,
            matchedQty,
            matchedVariantCount,
            matchedTotalQty,
          });
        }
      });
    }

    const promotionDiscountMap = new Map<number, number>();
    promotionChoiceByVariant.forEach((choice, variantId) => {
      promotionDiscountMap.set(variantId, choice.discount);
    });

    const discountBreakdownByVariant: Record<
      number,
      {
        average: number;
        special: number;
        promotion: number;
        total: number;
        promotionId?: number;
        promotionName?: string;
      }
    > = {};

    const discountedItems = selectedItems.map((item) => {
      const averageShare = Number(averageDiscountMap.get(item.variant_id) || 0);
      const specialShare = Number(item.special_discount_amount || 0);
      const promotionShare = Number(
        promotionDiscountMap.get(item.variant_id) || 0,
      );
      const appliedPromotionId = promotionChoiceByVariant.get(
        item.variant_id,
      )?.promotionId;
      const appliedPromotion = appliedPromotions.find(
        (p) => p.id === appliedPromotionId,
      );

      discountBreakdownByVariant[item.variant_id] = {
        average: round2(averageShare),
        special: round2(specialShare),
        promotion: round2(promotionShare),
        total: round2(averageShare + specialShare + promotionShare),
        promotionId: appliedPromotionId,
        promotionName: appliedPromotion?.name,
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
        applied_promotion_id: appliedPromotionId,
      };
    });

    const finalDiscount =
      promotionDiscountMap.size > 0
        ? Array.from(promotionDiscountMap.values()).reduce((a, b) => a + b, 0)
        : 0;
    const totalPromoDiscount =
      finalDiscount + averageDiscount + specialDiscount;

    // Total = subtotal - (all discounts) + tax + shipping
    const total = subtotal - totalPromoDiscount + totalTax + shippingCostNum;

    return {
      subtotal: Number(subtotal),
      totalTax: Number(totalTax),
      promotionDiscount: Number(finalDiscount),
      averageDiscount: Number(averageDiscount),
      specialDiscount: Number(specialDiscount),
      finalDiscount: Number(totalPromoDiscount),
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
      shipping_cost: totals.shippingCost,
      payment_status: paymentStatus,
      received_amount: totalPaymentAmount,
      payments: salePayments,
    };

    try {
      setLoading(true);
      await salesApi.createSale(saleData);

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
      //   navigate(`/sales/view/${createdSale.id}`);
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
      render: (price: number) => `$${(Number(price) || 0).toFixed(2)}`,
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
              // Just blur the input, the global handler will handle form submission
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
            <span>{`-$${(Number(promoDiscount) || 0).toFixed(2)}`}</span>
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
        return `$${(Number(netLineTotal) || 0).toFixed(2)}`;
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
                  onChange={(value) => {
                    if (value) {
                      const selectedVariant = filteredVariants.find(
                        (v) => v.id === value,
                      );
                      if (selectedVariant) addToSale(selectedVariant);
                    }
                    setTimeout(() => {
                      const activeElement =
                        document.activeElement as HTMLElement;
                      if (activeElement && activeElement.blur)
                        activeElement.blur();
                    }, 0);
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
                            {variant.sku && ` • ${variant.sku}`}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            ${" "}
                            {priceType === PriceType.WHOLESALE
                              ? variant.wholesale_price || variant.regular_price
                              : variant.regular_price}
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
                        <PercentageOutlined /> %
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
                            : "$"
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
                        prefix="$"
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
                      padding: 4,
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
                        {/* Keep payment method/provider behavior aligned with Add Sale page. */}
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
                                    // Remove focus after selection
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
                                  prefix="$"
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
                {/* Card for displaying the Total Amount */}
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
            {/* Card for displaying Sale Breakdown, Notes, Change, and Action Buttons */}
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
                  ${Math.ceil(Number(totals.total) || 0).toFixed(0)}
                </Text>
              </div>
            </Card>

            {/* Card for listing Cart Items */}
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
                  value: `$${(Number(totals.subtotal) || 0).toFixed(2)}`,
                },
                {
                  label: "Tax",
                  value: `$${(Number(totals.totalTax) || 0).toFixed(2)}`,
                },
                {
                  label: "Discount",
                  value: `-$${(Number(totals.finalDiscount) || 0).toFixed(2)}`,
                  highlight: totals.finalDiscount > 0,
                },
                {
                  label: "Promo Disc",
                  value: `-$${(Number(totals.promotionDiscount) || 0).toFixed(2)}`,
                },
                {
                  label: "Avg Disc",
                  value: `-$${(Number(totals.averageDiscount) || 0).toFixed(2)}`,
                },
                {
                  label: "Special Disc",
                  value: `-$${(Number(totals.specialDiscount) || 0).toFixed(2)}`,
                },
                {
                  label: "Shipping",
                  value: `$${(Number(totals.shippingCost) || 0).toFixed(2)}`,
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
                    salePayments.reduce((sum, p) => sum + p.amount, 0) >=
                    totals.total
                      ? isDarkMode
                        ? "rgba(149, 222, 100, 0.2)"
                        : "rgba(149, 222, 100, 0.5)"
                      : isDarkMode
                        ? "rgba(255, 120, 117, 0.2)"
                        : "rgba(255, 120, 117, 0.5)",
                  borderRadius: 8,
                  border:
                    salePayments.reduce((sum, p) => sum + p.amount, 0) >=
                    totals.total
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
                    <MoneyCollectOutlined style={{ marginRight: 4 }} /> Change
                  </Text>
                  <Text strong style={{ fontSize: 18, fontWeight: 700 }}>
                    ${" "}
                    {Math.floor(
                      Math.max(
                        0,
                        salePayments.reduce((sum, p) => sum + p.amount, 0) -
                          totals.total,
                      ),
                    ).toFixed(0)}
                  </Text>
                </div>
              </div>
            </Card>

            {/* Card for Action Buttons (Cancel/Complete) */}
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
