import {
  ArrowLeftOutlined,
  BankOutlined,
  CalculatorOutlined,
  CarOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  DollarOutlined,
  FileTextOutlined,
  MobileOutlined,
  MoneyCollectOutlined,
  PayCircleOutlined,
  PercentageOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TagOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
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
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { BsCash } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { get, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { promotionApi } from "../../api/promotion-api";
import { salesApi } from "../../api/sales-api";
import CustomerModal from "../../components/CustomerModal";
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
import { Promotion } from "../../types/promotion.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text } = Typography;

const NewSale = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();

  // Watch form values for real-time calculations
  const discountAmount = Form.useWatch("discount_amount", form) || 0;
  const shippingCost = Form.useWatch("shipping_cost", form) || 0;

  // State
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [servedByUsers, setServedByUsers] = useState<
    { id: number; name: string }[]
  >([]);
  const [filteredVariants, setFilteredVariants] = useState<
    ProductVariantForSale[]
  >([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedServedByUser, setSelectedServedByUser] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [discountType, setDiscountType] = useState<DiscountType>(
    DiscountType.FLAT,
  );
  const [loading, setLoading] = useState(false);
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

  // Load served by users using React Query
  const servedByUsersQuery = useQuery({
    queryKey: [queryKeys.users,selectedBranch],
    queryFn: async () => {
      const data = await get(endpoints.user,{ branch_id: selectedBranch });
      return data.data || data;
    },
    enabled: !!selectedBranch,
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
        discount_type: DiscountType.FLAT,
        discount_amount: 0,
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

  // Set initial page title
  useEffect(() => {
    setPageTitle("New Sale");
  }, []);

  const handleBranchChange = (branchId: number) => {
    setSelectedBranch(branchId);
    setSelectedItems([]); // Clear items when branch changes
    setAppliedPromotion(null);
    setPromotionDiscountAmount(0);
    setDiscountType(DiscountType.FLAT);
    form.setFieldsValue({ branch_id: branchId, discount_amount: 0 });
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
        try {
          const validation = await promotionApi.validatePromotionCart(
            promotion.id,
            buildPromotionValidationPayload(selectedItems),
          );

          if (validation.is_eligible) {
            setAppliedPromotion(promotion);
            setPromotionDiscountAmount(Number(validation.discount_amount || 0));
            messageApi?.success(`${promotion.name} auto-applied`);
            break; // Apply only the first eligible promotion
          }
        } catch (error) {
          // Silently fail for auto-apply checks
          console.log(`Auto-apply check failed for ${promotion.name}:`, error);
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
      discount_amount: 0,
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

  const buildPromotionValidationPayload = (items: SaleItem[]) => ({
    branch_id: selectedBranch!,
    customer_id: selectedCustomer?.id,
    items: items.map((item) => ({
      variant_id: item.variant_id,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
  });

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
          try {
            const validation = await promotionApi.validatePromotionCart(
              promotion.id,
              buildPromotionValidationPayload(selectedItems),
            );

            return [promotion.id, validation] as const;
          } catch {
            return [
              promotion.id,
              {
                is_eligible: false,
                reason: "Unable to validate promotion",
              },
            ] as const;
          }
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
    let cancelled = false;

    const validateAppliedPromotionAgainstCart = async () => {
      if (!appliedPromotion || !selectedBranch) {
        return;
      }

      if (selectedItems.length === 0) {
        setAppliedPromotion(null);
        setPromotionDiscountAmount(0);
        messageApi?.warning("Applied promotion removed: cart is empty");
        return;
      }

      try {
        const validation = await promotionApi.validatePromotionCart(
          appliedPromotion.id,
          buildPromotionValidationPayload(selectedItems),
        );

        if (cancelled) {
          return;
        }

        if (!validation.is_eligible) {
          setAppliedPromotion(null);
          setPromotionDiscountAmount(0);
          messageApi?.warning(
            `Applied promotion removed: ${validation.reason || "conditions no longer match"}`,
          );
          return;
        }

        setPromotionDiscountAmount(Number(validation.discount_amount || 0));
      } catch {
        // Ignore transient validation failures
      }
    };

    validateAppliedPromotionAgainstCart();

    return () => {
      cancelled = true;
    };
  }, [appliedPromotion, selectedItems, selectedBranch, selectedCustomer?.id]);

  const clearAppliedPromotion = () => {
    setAppliedPromotion(null);
    setPromotionDiscountAmount(0);
  };

  const applyPromotionToCurrentSale = async (promotion: Promotion) => {
    if (!selectedBranch) {
      messageApi?.error("Please select a branch before applying a promotion");
      return;
    }

    let workingItems = [...selectedItems];
    let cartUpdated = false;

    try {
      setApplyingPromotionId(promotion.id);

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

        const validation = await promotionApi.validatePromotionCart(
          promotion.id,
          buildPromotionValidationPayload(workingItems),
        );

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
    } catch (error: any) {
      messageApi?.error(
        error.response?.data?.message || "Failed to apply promotion",
      );
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

  const calculateTotals = () => {
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

    const discountAmountNum = Number(discountAmount) || 0;
    const shippingCostNum = Number(shippingCost) || 0;

    // Calculate manual discount on subtotal (before tax)
    const manualDiscount =
      discountType === DiscountType.PERCENTAGE
        ? (subtotal * discountAmountNum) / 100
        : discountAmountNum;

    // Total discount = promotion discount + manual discount
    const finalDiscount = promotionDiscountAmount + manualDiscount;

    // Total = subtotal - (promotion_discount + manual_discount) + tax + shipping
    const total = subtotal - finalDiscount + totalTax + shippingCostNum;

    return {
      subtotal: Number(subtotal),
      totalTax: Number(totalTax),
      promotionDiscount: Number(promotionDiscountAmount),
      manualDiscount: Number(manualDiscount),
      finalDiscount: Number(finalDiscount),
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
      items: selectedItems.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        // Remove batch_id to let backend use FIFO automatically
      })),
      price_type: priceType,
      discount_type: discountType,
      discount_amount: totals.manualDiscount, // Send only manual discount
      applied_promotion_id: appliedPromotion?.id,
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
      setDiscountType(DiscountType.FLAT);
      setAppliedPromotion(null);
      setPromotionDiscountAmount(0);
      setSalePayments([
        {
          payment_method: PaymentMethod.CASH,
          amount: 0,
          reference: "",
          notes: "",
        },
      ]);
      form.setFieldsValue({
        customer_id: undefined,
        served_by_id: undefined,
        discount_amount: 0,
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
  }, [selectedItems, discountAmount, shippingCost, discountType]);

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
      title: "Total",
      key: "line_total",
      render: (record: SaleItem) =>
        `$${(Number(record.line_total) || 0).toFixed(2)}`,
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
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Card
        className="!rounded-none !border-none"
        bodyStyle={{
          padding: "12px 12px 16px 12px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          height: "100vh",
        }}
      >
        <CustomerModal
          open={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          onCreateCustomer={async (customer) => {
            try {
              const newCustomer = await post(
                endpoints.createCustomer,
                customer,
              );
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
                        <Tag color={promotion.scope === "BRAND" ? "blue" : promotion.scope === "BUNDLE" ? "purple" : "green"}>
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

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            maxHeight: "100%",
          }}
        >
          {/* Compact Header */}
          <div
            style={{
              padding: "6px 10px",
              marginBottom: 12,
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography.Title
              level={4}
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              Point of Sale
            </Typography.Title>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {selectedItems.length > 0 && (
                <Badge
                  count={`${selectedItems.length} items`}
                  style={{
                    fontSize: 14,
                    height: 28,
                    lineHeight: "28px",
                    borderRadius: 14,
                    padding: "0 12px",
                  }}
                />
              )}
              <Button
                type="primary"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/")}
              >
                Back
              </Button>
            </div>
          </div>

          <Form
            form={form}
            onFinish={onFinish}
            layout="vertical"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxHeight: "100%",
              height: "100%",
            }}
          >
            <Row
              gutter={12}
              style={{ flex: 1, minHeight: 0, maxHeight: "100%" }}
            >
              {/* Left Column - Controls & Product Selection */}
              <Col
                xs={24}
                lg={10}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  maxHeight: "100%",
                }}
              >
                {/* Top Controls - Branch, Customer, Price Type */}
                <Card
                  style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  }}
                  bodyStyle={{ padding: 12 }}
                >
                  <Row gutter={[24, 12]}>
                    <Col span={6}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            Branch
                          </span>
                        }
                        name="branch_id"
                        rules={[{ required: true, message: "Select branch" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          placeholder="Select branch"
                          onChange={(value) => {
                            handleBranchChange(value);
                            // Remove focus after selection
                            setTimeout(() => {
                              const activeElement =
                                document.activeElement as HTMLElement;
                              if (activeElement && activeElement.blur) {
                                activeElement.blur();
                              }
                            }, 0);
                          }}
                          loading={loading}
                          // size="large"
                        >
                          {userBranches.map((branch) => (
                            <Option key={branch.id} value={branch.id}>
                              {branch.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            Customer
                          </span>
                        }
                        name="customer_id"
                        style={{ marginBottom: 0 }}
                      >
                        <div style={{ display: "flex", gap: 2 }}>
                          <Select
                            placeholder="Walk-in customer"
                            showSearch
                            allowClear
                            optionFilterProp="children"
                            value={selectedCustomer?.id}
                            onChange={(value) => {
                              const customer = customers.find(
                                (c) => c.id === value,
                              );
                              setSelectedCustomer(customer || null);
                              form.setFieldsValue({
                                customer_id: value,
                              });
                              // Remove focus after selection
                              setTimeout(() => {
                                const activeElement =
                                  document.activeElement as HTMLElement;
                                if (activeElement && activeElement.blur) {
                                  activeElement.blur();
                                }
                              }, 0);
                            }}
                            style={{ flex: 1 }}
                            //   size="large"
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
                              onClick={() => setCustomerModalOpen(true)}
                              // size="large"
                              style={{
                                borderColor: "#52c41a",
                                color: "#52c41a",
                              }}
                            />
                          </Tooltip>
                        </div>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            Served By
                          </span>
                        }
                        name="served_by_id"
                        style={{ marginBottom: 0 }}
                      >
                        <div style={{ display: "flex", gap: 2 }}>
                          <Select
                            placeholder="Select staff"
                            showSearch
                            allowClear
                            optionFilterProp="children"
                            value={selectedServedByUser?.id}
                            onChange={(value) => {
                              const user = servedByUsers.find(
                                (u) => u.id === value,
                              );
                              setSelectedServedByUser(user || null);
                              form.setFieldsValue({
                                served_by_id: value,
                              });
                              // Remove focus after selection
                              setTimeout(() => {
                                const activeElement =
                                  document.activeElement as HTMLElement;
                                if (activeElement && activeElement.blur) {
                                  activeElement.blur();
                                }
                              }, 0);
                            }}
                            style={{ flex: 1 }}
                            //   size="large"
                          >
                            {servedByUsers.map((user) => (
                              <Option key={user.id} value={user.id}>
                                {user.name}
                              </Option>
                            ))}
                          </Select>
                          {/* <Tooltip title="Add Staff">
                            <Button
                              icon={<PlusOutlined />}
                              onClick={() => setCustomerModalOpen(true)}
                              // size="large"
                              style={{
                                borderColor: "#52c41a",
                                color: "#52c41a",
                              }}
                            />
                          </Tooltip> */}
                        </div>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            Pricing
                          </span>
                        }
                        style={{ marginBottom: 0 }}
                      >
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
                            priceType === PriceType.WHOLESALE
                              ? "primary"
                              : "default"
                          }
                          // size="large"
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

                {/* Product Search - Prominent */}
                <Card
                  style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  }}
                  bodyStyle={{ padding: 12 }}
                >
                  <div
                    style={{
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ShoppingCartOutlined style={{ fontSize: 16 }} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      Add Products
                    </span>
                  </div>
                  <Select
                    placeholder={
                      <>
                        <SearchOutlined /> Search product name, SKU or scan
                        barcode...
                      </>
                    }
                    showSearch
                    allowClear
                    style={{ width: "100%" }}
                    optionFilterProp="children"
                    value={null}
                    //   size="large"
                    onChange={(value) => {
                      if (value) {
                        const selectedVariant = filteredVariants.find(
                          (v) => v.id === value,
                        );
                        if (selectedVariant) {
                          addToSale(selectedVariant);
                        }
                      }
                      // Remove focus after selection
                      setTimeout(() => {
                        const activeElement =
                          document.activeElement as HTMLElement;
                        if (activeElement && activeElement.blur) {
                          activeElement.blur();
                        }
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
                            gap: 12,
                            padding: "6px 0",
                          }}
                        >
                          {variant.image ? (
                            <img
                              src={variant.image}
                              alt={variant.name}
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: "cover",
                                borderRadius: 8,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,

                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <ShoppingCartOutlined />
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                marginBottom: 3,
                                fontSize: 14,
                              }}
                            >
                              {variant.product_name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                marginBottom: 2,
                              }}
                            >
                              {variant.name}
                              {variant.sku && ` • SKU: ${variant.sku}`}
                            </div>
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 700,
                              }}
                            >
                              $
                              {priceType === PriceType.WHOLESALE
                                ? variant.wholesale_price ||
                                  variant.regular_price
                                : variant.regular_price}
                            </div>
                          </div>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Card>

                {/* Discounts & Payments */}
                <Card
                  style={{
                    borderRadius: 12,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    marginBottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    minHeight: 0,
                  }}
                  bodyStyle={{
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <Typography.Title
                    level={5}
                    style={{
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <TagOutlined />
                    Additional Charges
                  </Typography.Title>
                  {appliedPromotion ? (
                    <div style={{ marginBottom: 10, flexShrink: 0 }}>
                      <Space>
                        <Tag color="green">Applied: {appliedPromotion.name}</Tag>
                        <Button type="link" size="small" onClick={clearAppliedPromotion}>
                          Remove Promotion
                        </Button>
                      </Space>
                    </div>
                  ) : null}
                  <div style={{ flexShrink: 0 }}>
                    <Row gutter={[8, 10]}>
                      <Col span={12}>
                        <Form.Item
                          label={
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              Discount Type
                            </span>
                          }
                          style={{ marginBottom: 0 }}
                        >
                          <Radio.Group
                            value={discountType}
                            onChange={(e) => setDiscountType(e.target.value)}
                            buttonStyle="solid"
                            style={{ width: "100%" }}
                            size="middle"
                          >
                            <Radio.Button
                              value={DiscountType.FLAT}
                              style={{
                                width: "50%",
                                textAlign: "center",
                              }}
                            >
                              <MoneyCollectOutlined className="" /> Fixed
                            </Radio.Button>
                            <Radio.Button
                              value={DiscountType.PERCENTAGE}
                              style={{
                                width: "50%",
                                textAlign: "center",
                              }}
                            >
                              <PercentageOutlined className="mr-2" /> Percent
                            </Radio.Button>
                          </Radio.Group>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          label={
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              Discount
                            </span>
                          }
                          name="discount_amount"
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={0}
                            style={{ width: "100%" }}
                            placeholder="0"
                            size="middle"
                            prefix={
                              discountType === DiscountType.PERCENTAGE
                                ? "%"
                                : "$"
                            }
                            onPressEnter={(e) =>
                              (e.target as HTMLInputElement).blur()
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          label={
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              Shipping
                            </span>
                          }
                          name="shipping_cost"
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={0}
                            style={{ width: "100%" }}
                            placeholder="0"
                            size="middle"
                            prefix="$"
                            onPressEnter={(e) =>
                              (e.target as HTMLInputElement).blur()
                            }
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>

                  <Divider style={{ margin: "10px 0", flexShrink: 0 }} />

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        <CreditCardOutlined className="mr-2" /> Payments
                      </Typography.Title>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          const remainingAmount = Math.max(
                            0,
                            totals.total -
                              salePayments.reduce(
                                (sum, p) => sum + p.amount,
                                0,
                              ),
                          );
                          const newPayment: SalePayment = {
                            payment_method: PaymentMethod.CASH,
                            amount:
                              remainingAmount > 0
                                ? remainingAmount
                                : totals.total,
                            reference: "",
                            notes: "",
                          };
                          setSalePayments([...salePayments, newPayment]);
                        }}
                      >
                        Add
                      </Button>
                    </div>

                    <Space
                      direction="vertical"
                      size={6}
                      style={{
                        flex: 1,
                        minHeight: 0,
                        maxHeight: "250px",
                        overflowY: "auto",
                        overflowX: "hidden",
                      }}
                    >
                      {salePayments.map((payment, index) => (
                        <Card
                          key={index}
                          size="small"
                          style={{
                            borderRadius: 8,
                          }}
                          bodyStyle={{ padding: 8 }}
                        >
                          <Row gutter={6} align="middle">
                            <Col span={6}>
                              <Select
                                size="small"
                                value={payment.payment_method}
                                onChange={(value) => {
                                  const updatedPayments = [...salePayments];
                                  updatedPayments[index].payment_method = value;
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
                                <Option value={PaymentMethod.DEPOSIT}>
                                  <SaveOutlined className="mr-2" /> Deposit
                                </Option>
                                <Option value={PaymentMethod.CREDIT}>
                                  <WalletOutlined className="mr-2" /> Credit
                                </Option>
                                <Option value={PaymentMethod.EXCHANGE}>
                                  <SwapOutlined className="mr-2" /> Exchange
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
                            <Col span={5}>
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
                            <Col span={5}>
                              <Input
                                size="small"
                                value={payment.notes}
                                onChange={(e) => {
                                  const updatedPayments = [...salePayments];
                                  updatedPayments[index].notes = e.target.value;
                                  setSalePayments(updatedPayments);
                                }}
                                onPressEnter={(e) =>
                                  (e.target as HTMLInputElement).blur()
                                }
                                placeholder="Notes"
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
                                    const updatedPayments = salePayments.filter(
                                      (_, i) => i !== index,
                                    );
                                    setSalePayments(updatedPayments);
                                  }}
                                />
                              </Tooltip>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                    </Space>
                  </div>
                </Card>
                {/* Action Buttons */}
                <Card
                  style={{
                    borderRadius: 12,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    marginTop: "auto",
                    flexShrink: 0,
                  }}
                  bodyStyle={{ padding: 12 }}
                >
                  <Form.Item
                    label={
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        <FileTextOutlined className="mr-2" /> Sale Notes
                      </span>
                    }
                    name="notes"
                    style={{ marginBottom: 10 }}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Add any notes about this sale..."
                      style={{ borderRadius: 8 }}
                      autoSize={{ minRows: 3, maxRows: 3 }}
                    />
                  </Form.Item>

                  <Row gutter={8}>
                    <Col span={8}>
                      <Button
                        //   onClick={() => navigate("/sales")}
                        size="large"
                        block
                        //   style={{ height: 48, fontWeight: 600 }}
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
                        //   style={{
                        //     height: 48,
                        //     fontSize: 16,
                        //     fontWeight: 700,
                        //     border: "none",
                        //   }}
                      >
                        Complete Sale
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </Col>

              {/* Right Column - HIGHLIGHTED Sale Items & Total */}
              <Col
                xs={24}
                lg={14}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  maxHeight: "100%",
                }}
              >
                {/* Sale Items - FOCUSED */}
                <Card
                  style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
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
                  {/* Header with gradient */}
                  <div
                    style={{
                      padding: "10px 16px",
                      borderRadius: "10px 10px 0 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography.Title
                      level={5}
                      style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <ShoppingCartOutlined style={{ fontSize: 18 }} />
                      Cart Items
                    </Typography.Title>
                    {selectedItems.length > 0 && (
                      <Badge
                        count={selectedItems.length}
                        style={{
                          backgroundColor: "#52c41a",
                          fontSize: 14,
                          height: 24,
                          lineHeight: "24px",
                          boxShadow: "0 2px 8px rgba(82, 196, 26, 0.3)",
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      padding: 12,
                      flex: 1,
                      minHeight: 0,
                      maxHeight: "300px",
                      display: "flex",
                      flexDirection: "column",
                      overflowY: "auto",
                      overflowX: "hidden",
                    }}
                  >
                    {selectedItems.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "60px 20px",
                          color: "#bfbfbf",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <ShoppingCartOutlined
                          style={{
                            fontSize: 64,
                            marginBottom: 16,
                            opacity: 0.3,
                          }}
                        />
                        <div style={{ fontSize: 16, fontWeight: 500 }}>
                          No items in cart
                        </div>
                        <div style={{ fontSize: 13, marginTop: 8 }}>
                          Search and add products to start
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          maxHeight: "100%",
                          overflowY: "auto",
                          overflowX: "hidden",
                        }}
                      >
                        <Table
                          columns={saleItemColumns}
                          dataSource={selectedItems}
                          rowKey={(record) => record.variant_id}
                          size="small"
                          pagination={false}
                          showHeader={true}
                          bordered={false}
                          style={{
                            background: "transparent",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </Card>

                {/* Total Section - HIGHLY FOCUSED */}
                <Card
                  style={{
                    borderRadius: 12,
                    boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
                    border: "none",
                    marginBottom: 0,
                    flexShrink: 0,
                  }}
                  bodyStyle={{ padding: "12px 16px 16px 16px" }}
                >
                  {/* Main Total Display */}
                  <div
                    style={{
                      borderRadius: 12,
                      padding: "8px 12px",
                      marginBottom: 8,
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                        }}
                      >
                        TOTAL AMOUNT
                      </Text>
                      <Text
                        style={{
                          fontSize: 42,
                          fontWeight: 800,
                          letterSpacing: "-1px",
                          textShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}
                      >
                        ${Math.ceil(Number(totals.total) || 0).toFixed(0)}
                      </Text>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <Space
                    direction="vertical"
                    style={{ width: "100%" }}
                    size={4}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                        }}
                      >
                        Subtotal:
                      </Text>
                      <Text strong style={{ fontSize: 16 }}>
                        ${(Number(totals.subtotal) || 0).toFixed(2)}
                      </Text>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                        }}
                      >
                        Tax:
                      </Text>
                      <Text style={{ fontSize: 15 }}>
                        ${(Number(totals.totalTax) || 0).toFixed(2)}
                      </Text>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background:
                          totals.finalDiscount > 0
                            ? "rgba(255, 214, 102, 0.2)"
                            : "rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        border:
                          totals.finalDiscount > 0
                            ? "1px solid rgba(255, 214, 102, 0.3)"
                            : "none",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: totals.finalDiscount > 0 ? 600 : 400,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {totals.finalDiscount > 0 ? (
                          <DollarOutlined className="mr-2" />
                        ) : (
                          ""
                        )}
                        Discount:
                      </Text>
                      <Text
                        strong
                        style={{
                          fontSize: 15,
                        }}
                      >
                        -${(Number(totals.finalDiscount) || 0).toFixed(2)}
                      </Text>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                        }}
                      >
                        {totals.shippingCost > 0 ? (
                          <CarOutlined className="mr-2" />
                        ) : null}
                        Shipping:
                      </Text>
                      <Text style={{ fontSize: 15 }}>
                        ${(Number(totals.shippingCost) || 0).toFixed(2)}
                      </Text>
                    </div>

                    <Divider
                      style={{
                        margin: "4px 0",
                      }}
                    />

                    {/* Change Display */}
                    <div
                      style={{
                        padding: "8px 12px",
                        background:
                          Math.max(
                            0,
                            salePayments.reduce((sum, p) => sum + p.amount, 0) -
                              totals.total,
                          ) >= 0
                            ? "rgba(149, 222, 100, 0.25)"
                            : "rgba(255, 120, 117, 0.25)",
                        borderRadius: 10,
                        border:
                          Math.max(
                            0,
                            salePayments.reduce((sum, p) => sum + p.amount, 0) -
                              totals.total,
                          ) >= 0
                            ? "2px solid rgba(149, 222, 100, 0.5)"
                            : "2px solid rgba(255, 120, 117, 0.5)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text strong style={{ fontSize: 16 }}>
                          <MoneyCollectOutlined className="mr-2" /> Change:
                        </Text>
                        <Text
                          strong
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                          }}
                        >
                          $
                          {Math.floor(
                            Math.max(
                              0,
                              salePayments.reduce(
                                (sum, p) => sum + p.amount,
                                0,
                              ) - totals.total,
                            ),
                          ).toFixed(0)}
                        </Text>
                      </div>
                    </div>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Form>
        </div>
      </Card>

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
