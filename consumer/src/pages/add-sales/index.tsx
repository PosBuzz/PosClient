import {
  CalculatorOutlined,
  DeleteOutlined,
  PlusOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import {
  TagOutlined,
} from "@ant-design/icons";
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
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { get, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { promotionApi } from "../../api/promotion-api";
import { salesApi } from "../../api/sales-api";
import CustomerModal from "../../components/CustomerModal";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
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
} from "../../types/sale.types";
import { Promotion, PromotionValidationResponse } from "../../types/promotion.types";
import { evaluatePromotionLocally } from "../../utils/promotion-validation";
import { setPageTitle } from "../../utils/setPageTitle";

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

  // State
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [servedByUsers, setServedByUsers] = useState<{ id: number; name: string }[]>([]);
  const [filteredVariants, setFilteredVariants] = useState<
    ProductVariantForSale[]
  >([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
    const [selectedServedByUser, setSelectedServedByUser] = useState<{ id: number; name: string } | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [averageDiscountType, setAverageDiscountType] = useState<DiscountType>(
    DiscountType.FLAT,
  );
  const [loading, setLoading] = useState(false);
  const [isOnlineOrder, setIsOnlineOrder] = useState(false);
  const [promotionDrawerOpen, setPromotionDrawerOpen] = useState(false);
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(
    null,
  );
  const [promotionDiscountAmount, setPromotionDiscountAmount] = useState(0);
  const [applyingPromotionId, setApplyingPromotionId] = useState<number | null>(
    null,
  );
  const [promotionEligibilityMap, setPromotionEligibilityMap] = useState<
    Record<number, { is_eligible: boolean; reason?: string }>
  >({});
  const [salePayments, setSalePayments] = useState<SalePayment[]>([
    {
      payment_method: PaymentMethod.CASH,
      amount: 0,
      reference: "",
      notes: "",
    },
  ]);

  // Barcode scanning state - POS SYSTEM BEHAVIOR:
  // - Barcode scanner works regardless of what input is focused
  // - Enter key outside inputs completes the sale
  // - Fast sequential keystrokes are treated as barcode input
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);

  // Reset barcode buffer when component unmounts or branch changes
  useEffect(() => {
    setBarcodeBuffer("");
    setLastKeyTime(0);
  }, [selectedBranch]);

  // Get user's branches from auth store
  const userBranches = user?.branches || [];

  // Load customers using React Query
  const customersQuery = useQuery({
    queryKey: [queryKeys.customers],
    queryFn: async () => {
      const data = await get(endpoints.getCustomers);
      return data.data || data;
    },
    staleTime: queryStaleTimeMap[queryKeys.customers],
  });

  // Load served_by users for dropdown (optional)
  const servedByUsersQuery = useQuery({
    queryKey: [queryKeys.users,selectedBranch],
    queryFn: async () => {
      const data = await get(endpoints.user,{ branch_id: selectedBranch });
      return data.data || data;
    },
    enabled: !!selectedBranch, // Only load when branch is selected
    staleTime: queryStaleTimeMap[queryKeys.users],
  });

  // Load products for sale when branch is selected
  const productsForSaleQuery = useQuery({
    queryKey: [queryKeys.productsForSale, selectedBranch],
    queryFn: () => salesApi.getProductsForSale(selectedBranch!),
    enabled: !!selectedBranch,
    staleTime: queryStaleTimeMap[queryKeys.productsForSale],
  });

  const activePromotionsQuery = useQuery({
    queryKey: [queryKeys.promotions, "active", selectedBranch],
    queryFn: () => promotionApi.getActivePromotions(selectedBranch || undefined),
    enabled: !!selectedBranch,
    staleTime: queryStaleTimeMap[queryKeys.promotions],
  });

  // Set default branch from user's branches
  useEffect(() => {
    if (userBranches.length > 0 && !selectedBranch) {
      // Just select the first branch from user's assigned branches
      const defaultBranch = userBranches[0];
      setSelectedBranch(defaultBranch.id);
      form.setFieldsValue({
        branch_id: defaultBranch.id,
        price_type: PriceType.REGULAR,
        average_discount_amount: 0,
        shipping_cost: 0,
      });
    }
  }, [userBranches, selectedBranch, form]);

  useEffect(() => {
    if (customersQuery.data) {
      setCustomers(customersQuery.data);
    }
  }, [customersQuery.data]);

  useEffect(() => {
    if (servedByUsersQuery.data) {
      setServedByUsers(servedByUsersQuery.data);
    }
  }, [servedByUsersQuery.data]);

  useEffect(() => {
    if (productsForSaleQuery.data) {
      setFilteredVariants(productsForSaleQuery.data);
    }
  }, [productsForSaleQuery.data]);

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

      // Map legacy quotation discount into average discount controls
      const averageDiscountValue =
        quotation.discount_type === "percentage"
          ? (Number(quotation.discount_amount) / Number(quotation.subtotal)) *
            100
          : Number(quotation.discount_amount);

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

      // Pre-fill items from quotation
      const items: SaleItem[] =
        quotation.items?.map((item: any) => ({
          variant_id: item.variant_id,
          variant_name: item.variant?.name || "",
          variant_sku: item.variant?.sku || "",
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          average_discount_amount: Number(item.average_discount_amount) || 0,
          special_discount_amount: Number(item.special_discount_amount) || 0,
          promotion_discount_amount: Number(item.promotion_discount_amount) || 0,
          applied_promotion_id: item.applied_promotion_id || undefined,
          tax_amount: Number(item.tax_amount) || 0,
          line_total: Number(item.line_total),
          product_name: item.variant?.product?.name || "",
          regular_price: Number(item.variant?.regular_price) || 0,
          wholesale_price: item.variant?.wholesale_price
            ? Number(item.variant.wholesale_price)
            : undefined,
          image: item.variant?.image,
          unit_name: item.variant?.sale_unit?.name || "",
          tax_percentage: 0, // Will be filled from variant data
        })) || [];

      setSelectedItems(items);
    }
  }, [
    quotationQuery.data,
    productsForSaleQuery.data,
    customers,
    form,
    messageApi,
  ]);

  const handleBranchChange = (branchId: number) => {
    setSelectedBranch(branchId);
    setSelectedItems([]); // Clear items when branch changes
    setAppliedPromotion(null);
    setPromotionDiscountAmount(0);
    setAverageDiscountType(DiscountType.FLAT);
    form.setFieldsValue({
      branch_id: branchId,
      average_discount_amount: 0,
    });
  };

  // Auto-apply promotions when cart changes
  useEffect(() => {
    const tryAutoApplyPromotion = async () => {
      // Only auto-apply if:
      // 1. No promotion is currently applied
      // 2. There are items in the cart
      // 3. A branch is selected
      // 4. Active promotions are loaded
      if (
        appliedPromotion ||
        selectedItems.length === 0 ||
        !selectedBranch ||
        !activePromotionsQuery.data ||
        activePromotionsQuery.data.length === 0
      ) {
        return;
      }

      // Find the first eligible auto-apply promotion
      const autoApplyPromotions = activePromotionsQuery.data.filter(
        (p) => p.auto_apply && p.is_active,
      );

      for (const promotion of autoApplyPromotions) {
        const validation = evaluatePromotionForItems(promotion, selectedItems);

        if (validation.is_eligible) {
          setAppliedPromotion(promotion);
          setPromotionDiscountAmount(Number(validation.discount_amount || 0));
          messageApi?.success(`${promotion.name} auto-applied`);
          break; // Apply only the first eligible promotion
        }
      }
    };

    tryAutoApplyPromotion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, selectedBranch, selectedCustomer?.id, activePromotionsQuery.data]);

  const calculateTaxAndTotal = (
    price: number,
    quantity: number,
    taxPercentage: number,
    taxMethod: string,
  ) => {
    const baseAmount = quantity * price;
    let taxAmount: number;
    let lineTotal: number;

    // Ensure taxPercentage is a valid number
    const validTaxPercentage = Number(taxPercentage) || 0;

    if (taxMethod === "INCLUSIVE") {
      // Tax is included in the price - the price already includes tax
      lineTotal = baseAmount; // Price includes tax
      taxAmount =
        (baseAmount * validTaxPercentage) / (100 + validTaxPercentage);
    } else {
      // Tax is exclusive - added on top of price
      taxAmount = (baseAmount * validTaxPercentage) / 100;
      lineTotal = baseAmount + taxAmount; // Add tax to get total
    }

    // Return precise values without rounding
    return {
      line_total: Number(lineTotal) || 0,
      tax_amount: Number(taxAmount) || 0,
      taxable_amount: Number(baseAmount) || 0,
    };
  };

  const upsertVariantInSaleItems = (
    sourceItems: SaleItem[],
    variant: ProductVariantForSale,
    quantityToAdd: number,
  ) => {
    const existingItem = sourceItems.find((item) => item.variant_id === variant.id);
    const price =
      priceType === PriceType.WHOLESALE
        ? Number(variant.wholesale_price) || Number(variant.regular_price)
        : Number(variant.regular_price);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantityToAdd;
      const { line_total, tax_amount } = calculateTaxAndTotal(
        price,
        newQuantity,
        Number(variant.tax_percentage) || 0,
        variant.tax_method || "EXCLUSIVE",
      );

      return sourceItems.map((item) =>
        item.variant_id === variant.id
          ? {
              ...item,
              quantity: newQuantity,
              unit_price: Number(price) || 0,
              tax_amount: Number(tax_amount) || 0,
              line_total: Number(line_total) || 0,
            }
          : item,
      );
    }

    const { line_total, tax_amount } = calculateTaxAndTotal(
      price,
      quantityToAdd,
      Number(variant.tax_percentage) || 0,
      variant.tax_method || "EXCLUSIVE",
    );

    const newItem: SaleItem = {
      variant_id: variant.id,
      variant_name: variant.name,
      variant_sku: variant.sku,
      quantity: quantityToAdd,
      unit_price: Number(price) || 0,
      average_discount_amount: 0,
      special_discount_amount: 0,
      promotion_discount_amount: 0,
      tax_amount: Number(tax_amount) || 0,
      line_total: Number(line_total) || 0,
      product_name: variant.product_name,
      regular_price: Number(variant.regular_price) || 0,
      wholesale_price: Number(variant.wholesale_price) || undefined,
      image: variant.image,
      unit_name: variant.unit_name,
      tax_percentage: Number(variant.tax_percentage) || 0,
    };

    return [...sourceItems, newItem];
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
          promotion.brand_id && Number(variant.brand_id) === Number(promotion.brand_id),
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

    const candidateIds = new Set(candidateVariants.map((variant) => variant.id));
    const currentMatchedQty = nextItems.reduce((sum, item) => {
      return candidateIds.has(item.variant_id) ? sum + Number(item.quantity || 0) : sum;
    }, 0);

    const minQty = Number(promotion.min_quantity || 1);
    const currentSubtotal = nextItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );
    const minPurchase = Number(promotion.min_purchase || 0);

    const needsMinQty = currentMatchedQty < minQty || reasonText.includes("minimum quantity");
    if (needsMinQty) {
      const qtyToAdd = Math.max(1, minQty - currentMatchedQty);
      nextItems = upsertVariantInSaleItems(nextItems, highestPriceVariant, qtyToAdd);
      changed = true;
    }

    const recalculatedSubtotal = nextItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );
    const needsMinPurchase =
      recalculatedSubtotal < minPurchase || reasonText.includes("minimum purchase");

    if (needsMinPurchase) {
      const unitPrice = Math.max(0.01, getVariantPriceForSale(highestPriceVariant));
      const qtyToAdd = Math.max(
        1,
        Math.ceil(Math.max(0, minPurchase - recalculatedSubtotal) / unitPrice),
      );
      nextItems = upsertVariantInSaleItems(nextItems, highestPriceVariant, qtyToAdd);
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
      const unitPrice = Math.max(0.01, getVariantPriceForSale(highestPriceVariant));
      const qtyToAdd = Math.max(
        1,
        Math.ceil(Math.max(0, minPurchase - currentSubtotal) / unitPrice),
      );
      nextItems = upsertVariantInSaleItems(nextItems, highestPriceVariant, qtyToAdd);
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
          const validation = evaluatePromotionForItems(promotion, selectedItems);
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
    if (!appliedPromotion || !selectedBranch) {
      return;
    }

    if (selectedItems.length === 0) {
      setAppliedPromotion(null);
      setPromotionDiscountAmount(0);
      messageApi?.warning("Applied promotion removed: cart is empty");
      return;
    }

    const validation = evaluatePromotionForItems(appliedPromotion, selectedItems);

    if (!validation.is_eligible) {
      setAppliedPromotion(null);
      setPromotionDiscountAmount(0);
      messageApi?.warning(
        `Applied promotion removed: ${validation.reason || "conditions no longer match"}`,
      );
      return;
    }

    setPromotionDiscountAmount(Number(validation.discount_amount || 0));
  }, [appliedPromotion, selectedItems, selectedBranch, selectedCustomer?.id, variantBrandById]);

  const clearAppliedPromotion = () => {
    setAppliedPromotion(null);
    setPromotionDiscountAmount(0);
  };

  const applyPromotionToCurrentSale = (promotion: Promotion) => {
    if (!selectedBranch) {
      messageApi?.error("Please select a branch before applying a promotion");
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

          setAppliedPromotion(promotion);
          setPromotionDiscountAmount(Number(validation.discount_amount || 0));
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
  const handleBarcodeScann = async (barcode: string) => {
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
  };

  // Global barcode scanner listener - POS style: works everywhere
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      const activeElement = document.activeElement as HTMLElement;

      // If more than 100ms have passed since last key, reset buffer (new scan)
      if (timeDiff > 100) {
        setBarcodeBuffer("");
      }

      setLastKeyTime(currentTime);

      // Check if user is actively typing in an input field - MORE COMPREHENSIVE CHECK
      const isTypingInInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.role === "textbox" ||
          activeElement.classList.contains(
            "ant-select-selection-search-input",
          ) ||
          activeElement.classList.contains("ant-input") ||
          activeElement.classList.contains("ant-input-number-input") ||
          activeElement.closest(".ant-select-dropdown") ||
          activeElement.closest(".ant-input") ||
          activeElement.closest(".ant-input-number") ||
          activeElement.getAttribute("contenteditable") === "true");

      // DEBUG: Log what's happening
      console.log(
        "Key pressed:",
        event.key,
        "isTypingInInput:",
        isTypingInInput,
        "activeElement:",
        activeElement?.tagName,
        activeElement?.className,
      );

      // If user is typing in input, do NOTHING with barcode logic
      if (isTypingInInput) {
        console.log("User is typing in input - ignoring for barcode");
        return; // Exit early, don't interfere with input
      }

      // POS RULE: Barcode scanner ONLY works when NOT in input fields
      // Handle Enter key (end of barcode scan)
      if (event.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          // BARCODE SCAN COMPLETE - always priority
          event.preventDefault();
          event.stopPropagation();
          handleBarcodeScann(barcodeBuffer);
          setBarcodeBuffer("");
          return;
        } else {
          // NO BARCODE BUFFER - submit form (since we're not in input)
          event.preventDefault();
          event.stopPropagation();
          form.submit();
          return;
        }
      }
      // Handle regular character input (part of barcode) - ONLY when not in input
      else if (event.key.length === 1 && /[a-zA-Z0-9\-_]/.test(event.key)) {
        // Barcode scanner detection logic:
        const isVeryFastTyping = timeDiff < 30;
        const hasExistingBuffer = barcodeBuffer.length > 0;
        const isLikelyBarcodeScanner = isVeryFastTyping || hasExistingBuffer;

        if (isLikelyBarcodeScanner) {
          // POS RULE: Barcode scanning overrides everything
          event.preventDefault();
          event.stopPropagation();
          setBarcodeBuffer((prev) => prev + event.key);

          // Blur any focused input to prevent interference
          if (activeElement && activeElement.blur) {
            activeElement.blur();
          }
        } else {
          // Regular typing outside inputs - still capture for potential barcode
          setBarcodeBuffer((prev) => prev + event.key);
        }
      }
    };

    // Add global keydown listener with highest priority (capture phase)
    document.addEventListener("keydown", handleKeyPress, true);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyPress, true);
    };
  }, [lastKeyTime, barcodeBuffer, selectedBranch, form]);

  const updateItemQuantity = (variantId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }

    setSelectedItems((items) =>
      items.map((item) => {
        if (item.variant_id === variantId) {
          // Find the variant to get tax_method
          const variant = productsForSaleQuery.data?.find(
            (v) => v.id === variantId,
          );
          const { line_total, tax_amount } = calculateTaxAndTotal(
            Number(item.unit_price),
            quantity,
            Number(item.tax_percentage) || 0,
            variant?.tax_method || "EXCLUSIVE",
          );

          return {
            ...item,
            quantity,
            tax_amount: Number(tax_amount) || 0,
            line_total: Number(line_total) || 0,
          };
        }
        return item;
      }),
    );
  };

  const removeItem = (variantId: number) => {
    setSelectedItems((items) =>
      items.filter((item) => item.variant_id !== variantId),
    );
  };

  const updateItemSpecialDiscount = (variantId: number, discount: number) => {
    setSelectedItems((items) =>
      items.map((item) =>
        item.variant_id === variantId
          ? {
              ...item,
              special_discount_amount: Math.max(0, Number(discount) || 0),
            }
          : item,
      ),
    );
  };

  const calculateTotals = () => {
    const round2 = (value: number) => Number((value || 0).toFixed(2));

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

    const averageDiscount =
      averageDiscountType === DiscountType.PERCENTAGE
        ? (subtotal * averageDiscountAmountNum) / 100
        : averageDiscountAmountNum;

    const specialDiscount = selectedItems.reduce(
      (sum, item) => sum + (Number(item.special_discount_amount) || 0),
      0,
    );

    const variantBaseMap = new Map<number, number>();
    selectedItems.forEach((item) => {
      const variant = productsForSaleQuery.data?.find(
        (v) => v.id === item.variant_id,
      );
      const taxMethod = variant?.tax_method || "EXCLUSIVE";
      const baseAmount =
        taxMethod === "INCLUSIVE"
          ? Number(item.line_total) - Number(item.tax_amount)
          : Number(item.unit_price) * Number(item.quantity);
      variantBaseMap.set(item.variant_id, Number(baseAmount) || 0);
    });

    const distributeDiscount = (totalDiscount: number) => {
      const distributed = new Map<number, number>();
      if (totalDiscount <= 0 || selectedItems.length === 0 || subtotal <= 0) {
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
        const base = variantBaseMap.get(item.variant_id) || 0;
        const share = round2((totalDiscount * base) / subtotal);
        distributed.set(item.variant_id, share);
        assigned += share;
      });

      return distributed;
    };

    const averageDiscountMap = distributeDiscount(Number(averageDiscount) || 0);
    const promotionDiscountMap = distributeDiscount(
      Number(promotionDiscountAmount) || 0,
    );

    // Total discount = average + special + promotion
    const finalDiscount =
      promotionDiscountAmount + averageDiscount + specialDiscount;

    // Total = subtotal - total_discount + tax + shipping
    const total = subtotal - finalDiscount + totalTax + shippingCostNum;

    const discountBreakdownByVariant: Record<
      number,
      { average: number; special: number; promotion: number; total: number }
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
      };

      return {
        ...item,
        average_discount_amount: round2(averageShare),
        special_discount_amount: round2(specialShare),
        promotion_discount_amount: round2(promotionShare),
        applied_promotion_id: appliedPromotion?.id,
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
      applied_promotion_id: appliedPromotion?.id,
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
    promotionDiscountAmount,
  ]);

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
      render: (record: SaleItem) =>
        `$${(Number(record.tax_amount) || 0).toFixed(2)}`,
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
            
            return (
              <List.Item
                actions={[
                  <Button
                    key={`apply-${promotion.id}`}
                    type="primary"
                    size="small"
                    loading={applyingPromotionId === promotion.id}
                    onClick={() => applyPromotionToCurrentSale(promotion)}
                  >
                    Apply
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{promotion.name}</span>
                      <Tag color={promotion.scope === "BRAND" ? "blue" : promotion.scope === "BUNDLE" ? "purple" : "lime"}>
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
                      {selectedItems.length > 0 && eligibility && !eligibility.is_eligible ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {eligibility.reason || "Not eligible for current cart"}
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
                      const servedByUser = servedByUsers.find((u) => u.id === value);
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
          {appliedPromotion ? (
            <div style={{ marginBottom: 12 }}>
              <Space>
                <Tag color="green">Applied: {appliedPromotion.name}</Tag>
                <Button type="link" size="small" onClick={clearAppliedPromotion}>
                  Remove Promotion
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
                  <Form.Item label="Average Discount" name="average_discount_amount">
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
                        notes: "",
                      };
                      setSalePayments([...salePayments, newPayment]);
                    }}
                    style={{ width: "100%" }}
                  >
                    Add Payment Method
                  </Button>
                </div>

                <div style={{ minHeight: "auto" }}>
                  {salePayments.map((payment, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: 8,
                        // padding: 8,
                        // border: '1px solid #d9d9d9',
                        // borderRadius: 4,
                        // backgroundColor: '#fafafa'
                      }}
                    >
                      <Row gutter={4}>
                        <Col span={6}>
                          <Select
                            size="small"
                            value={payment.payment_method}
                            onChange={(value) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].payment_method = value;
                              setSalePayments(updatedPayments);
                            }}
                            style={{ width: "100%" }}
                            placeholder="Method"
                          >
                            <Option value={PaymentMethod.CASH}>Cash</Option>
                            <Option value={PaymentMethod.CARD}>Card</Option>
                            <Option value={PaymentMethod.CHEQUE}>Cheque</Option>
                            <Option value={PaymentMethod.BANK_TRANSFER}>
                              Bank Transfer
                            </Option>
                            <Option value={PaymentMethod.MOBILE_MONEY}>
                              Mobile Money
                            </Option>
                            <Option value={PaymentMethod.MFS}>MFS</Option>
                            <Option value={PaymentMethod.DEPOSIT}>
                              Deposit
                            </Option>
                            <Option value={PaymentMethod.CREDIT}>Credit</Option>
                            <Option value={PaymentMethod.EXCHANGE}>
                              Exchange
                            </Option>
                          </Select>
                        </Col>
                        <Col span={6}>
                          <InputNumber
                            size="small"
                            value={payment.amount}
                            onChange={(value) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].amount = value || 0;
                              setSalePayments(updatedPayments);
                            }}
                            onPressEnter={(e) => {
                              // Just blur the input, the global handler will handle form submission
                              (e.target as HTMLInputElement).blur();
                            }}
                            min={0}
                            precision={2}
                            style={{ width: "100%" }}
                            placeholder="0.00"
                          />
                        </Col>
                        <Col span={6}>
                          <Input
                            size="small"
                            value={payment.reference}
                            onChange={(e) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].reference = e.target.value;
                              setSalePayments(updatedPayments);
                            }}
                            onPressEnter={(e) => {
                              // Just blur the input, the global handler will handle form submission
                              (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="Reference"
                          />
                        </Col>
                        <Col span={4}>
                          <Input
                            size="small"
                            value={payment.notes}
                            onChange={(e) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].notes = e.target.value;
                              setSalePayments(updatedPayments);
                            }}
                            onPressEnter={(e) => {
                              // Just blur the input, the global handler will handle form submission
                              (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="Notes"
                          />
                        </Col>
                        <Col span={2}>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              const updatedPayments = salePayments.filter(
                                (_, i) => i !== index,
                              );
                              setSalePayments(updatedPayments);
                            }}
                          />
                        </Col>
                      </Row>
                    </div>
                  ))}
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
                {promotionDiscountAmount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#52c41a" }}>Promo Discount:</Text>
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
                {promotionDiscountAmount === 0 &&
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
