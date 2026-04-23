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
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Promotion,
  PromotionValidationResponse,
} from "../../types/promotion.types";
import {
  Customer,
  DiscountType,
  PriceType,
  ProductVariantForSale,
  SaleFormData,
  SaleItem,
} from "../../types/sale.types";
import { evaluatePromotionLocally } from "../../utils/promotion-validation";
import { setPageTitle } from "../../utils/setPageTitle";

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
  const [averageDiscountType, setAverageDiscountType] = useState<DiscountType>(
    DiscountType.FLAT,
  );
  const [loading, setLoading] = useState(false);
  const [promotionDrawerOpen, setPromotionDrawerOpen] = useState(false);
  const [appliedPromotions, setAppliedPromotions] = useState<Promotion[]>([]);
  const [dismissedAutoPromotionIds, setDismissedAutoPromotionIds] = useState<
    number[]
  >([]);
  const [applyingPromotionId, setApplyingPromotionId] = useState<number | null>(
    null,
  );
  const [promotionEligibilityMap, setPromotionEligibilityMap] = useState<
    Record<number, { is_eligible: boolean; reason?: string }>
  >({});
  const isHydratingFromCopyRef = useRef(false);
  const hasManualCartMutationRef = useRef(!copyFromId);

  useEffect(() => {
    hasManualCartMutationRef.current = !copyFromId;
  }, [copyFromId]);

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
    queryKey: [queryKeys.users, selectedBranch],
    queryFn: async () => {
      const data = await get(endpoints.user, { branch_id: selectedBranch });
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
    queryFn: () =>
      promotionApi.getActivePromotions(selectedBranch || undefined),
    enabled: !!selectedBranch,
    staleTime: queryStaleTimeMap[queryKeys.promotions],
  });

  // Load quotation to copy if copy_from is provided
  const copyFromQuotationQuery = useQuery({
    queryKey: [queryKeys.quotation, parseInt(copyFromId || "0")],
    queryFn: () => salesApi.getQuotation(parseInt(copyFromId!)),
    enabled: !!copyFromId,
    staleTime: 0, // Don't cache when copying
  });

  // Set default branch from user's branches
  useEffect(() => {
    if (userBranches.length > 0 && !selectedBranch) {
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
          addToQuotation(variant);
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
      for (let i = 0; i < qtyToAdd; i += 1) {
        nextItems = (() => {
          const existingItem = nextItems.find(
            (item) => item.variant_id === highestPriceVariant.id,
          );
          const price = getVariantPriceForSale(highestPriceVariant);
          if (existingItem) {
            const newQuantity = existingItem.quantity + 1;
            const { line_total, tax_amount } = calculateTaxAndTotal(
              price,
              newQuantity,
              Number(highestPriceVariant.tax_percentage) || 0,
              highestPriceVariant.tax_method || "EXCLUSIVE",
            );
            return nextItems.map((item) =>
              item.variant_id === highestPriceVariant.id
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
            1,
            Number(highestPriceVariant.tax_percentage) || 0,
            highestPriceVariant.tax_method || "EXCLUSIVE",
          );
          const newItem: SaleItem = {
            variant_id: highestPriceVariant.id,
            variant_name: highestPriceVariant.name,
            variant_sku: highestPriceVariant.sku,
            quantity: 1,
            unit_price: Number(price) || 0,
            average_discount_amount: 0,
            special_discount_amount: 0,
            promotion_discount_amount: 0,
            tax_amount: Number(tax_amount) || 0,
            line_total: Number(line_total) || 0,
            product_name: highestPriceVariant.product_name,
            regular_price: Number(highestPriceVariant.regular_price) || 0,
            wholesale_price:
              Number(highestPriceVariant.wholesale_price) || undefined,
            image: highestPriceVariant.image,
            unit_name: highestPriceVariant.unit_name,
            tax_percentage: Number(highestPriceVariant.tax_percentage) || 0,
            tax_method: highestPriceVariant.tax_method || "EXCLUSIVE",
          };
          return [...nextItems, newItem];
        })();
      }
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
      for (let i = 0; i < qtyToAdd; i += 1) {
        const existingItem = nextItems.find(
          (item) => item.variant_id === highestPriceVariant.id,
        );
        const price = getVariantPriceForSale(highestPriceVariant);
        if (existingItem) {
          const newQuantity = existingItem.quantity + 1;
          const { line_total, tax_amount } = calculateTaxAndTotal(
            price,
            newQuantity,
            Number(highestPriceVariant.tax_percentage) || 0,
            highestPriceVariant.tax_method || "EXCLUSIVE",
          );
          nextItems = nextItems.map((item) =>
            item.variant_id === highestPriceVariant.id
              ? {
                  ...item,
                  quantity: newQuantity,
                  unit_price: Number(price) || 0,
                  tax_amount: Number(tax_amount) || 0,
                  line_total: Number(line_total) || 0,
                }
              : item,
          );
        } else {
          const { line_total, tax_amount } = calculateTaxAndTotal(
            price,
            1,
            Number(highestPriceVariant.tax_percentage) || 0,
            highestPriceVariant.tax_method || "EXCLUSIVE",
          );
          const newItem: SaleItem = {
            variant_id: highestPriceVariant.id,
            variant_name: highestPriceVariant.name,
            variant_sku: highestPriceVariant.sku,
            quantity: 1,
            unit_price: Number(price) || 0,
            average_discount_amount: 0,
            special_discount_amount: 0,
            promotion_discount_amount: 0,
            tax_amount: Number(tax_amount) || 0,
            line_total: Number(line_total) || 0,
            product_name: highestPriceVariant.product_name,
            regular_price: Number(highestPriceVariant.regular_price) || 0,
            wholesale_price:
              Number(highestPriceVariant.wholesale_price) || undefined,
            image: highestPriceVariant.image,
            unit_name: highestPriceVariant.unit_name,
            tax_percentage: Number(highestPriceVariant.tax_percentage) || 0,
            tax_method: highestPriceVariant.tax_method || "EXCLUSIVE",
          };
          nextItems = [...nextItems, newItem];
        }
      }
      changed = true;
    }

    if (
      !changed &&
      (reasonText.includes("required product") ||
        reasonText.includes("bundle") ||
        reasonText.includes("no matching brand"))
    ) {
      addToQuotation(highestPriceVariant);
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
      for (let i = 0; i < qtyToAdd; i += 1) {
        addToQuotation(highestPriceVariant);
      }
      changed = true;
    }

    return { items: nextItems, changed };
  };

  // Auto-apply promotions when cart changes (same behavior as add-sale)
  useEffect(() => {
    const tryAutoApplyPromotions = async () => {
      if (isHydratingFromCopyRef.current) {
        return;
      }

      if (copyFromId && !hasManualCartMutationRef.current) {
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
    if (isHydratingFromCopyRef.current) {
      return;
    }

    if (appliedPromotions.length === 0) {
      return;
    }

    if (!selectedBranch || selectedItems.length === 0) {
      setAppliedPromotions([]);
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
    if (copyFromQuotationQuery.data && selectedBranch) {
      isHydratingFromCopyRef.current = true;
      const quotation = copyFromQuotationQuery.data;

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

      // Set form values
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

      // Set states
      setPriceType(quotation.price_type as PriceType);
      setAverageDiscountType(
        (quotation.discount_type as DiscountType) || DiscountType.FLAT,
      );
      setSelectedBranch(quotation.branch_id);

      if (quotation.customer) {
        setSelectedCustomer(quotation.customer);
      }

      if (quotation.served_by) {
        setSelectedServedByUser(quotation.served_by);
      }

      // Set items
      const items = quotation.items.map((item: any) => {
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
          currentVariant?.tax_method || item.variant?.product?.tax_method || "EXCLUSIVE",
        ).toUpperCase();
        const { line_total, tax_amount } = calculateTaxAndTotal(
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
          promotion_discount_amount:
            Number(item.promotion_discount_amount || 0),
          applied_promotion_id: item.applied_promotion_id || undefined,
          tax_amount: Number(tax_amount) || 0,
          line_total: Number(line_total) || 0,
          product_name:
            item.variant?.product_name || item.variant?.product?.name || "",
          regular_price: regularPrice,
          wholesale_price: wholesalePrice,
          image: item.variant?.image,
          unit_name: item.variant?.unit_name || item.variant?.sale_unit?.name || "",
          tax_percentage: taxPercentage,
          tax_method: taxMethod,
        };
      });
      setSelectedItems(items);

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
    messageApi,
  ]);

  const handleBranchChange = (branchId: number) => {
    hasManualCartMutationRef.current = true;
    setSelectedBranch(branchId);
    setSelectedItems([]); // Clear items when branch changes
    setAppliedPromotions([]);
    setDismissedAutoPromotionIds([]);
    setAverageDiscountType(DiscountType.FLAT);
    form.setFieldsValue({ branch_id: branchId, average_discount_amount: 0 });
  };

  const calculateTaxAndTotal = (
    price: number,
    quantity: number,
    taxPercentage: number,
    taxMethod: string,
  ) => {
    const baseAmount = quantity * price;
    let taxAmount: number;
    let lineTotal: number;
    let taxableAmount: number;

    const validTaxPercentage = Number(taxPercentage) || 0;
    const normalizedTaxMethod = String(taxMethod || "EXCLUSIVE")
      .trim()
      .toUpperCase();
    const isInclusiveTax = normalizedTaxMethod.startsWith("INC");

    if (isInclusiveTax) {
      lineTotal = baseAmount;
      taxAmount = (baseAmount * validTaxPercentage) / 100;
      taxableAmount = baseAmount - taxAmount;
    } else {
      taxAmount = (baseAmount * validTaxPercentage) / 100;
      lineTotal = baseAmount + taxAmount;
      taxableAmount = baseAmount;
    }

    return {
      line_total: Number(lineTotal) || 0,
      tax_amount: Number(taxAmount) || 0,
      taxable_amount: Number(taxableAmount) || 0,
    };
  };

  const addToQuotation = (variant: ProductVariantForSale) => {
    hasManualCartMutationRef.current = true;
    const existingItem = selectedItems.find(
      (item) => item.variant_id === variant.id,
    );

    const price =
      priceType === PriceType.WHOLESALE
        ? Number(variant.wholesale_price) || Number(variant.regular_price)
        : Number(variant.regular_price);

    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;
      const { line_total, tax_amount } = calculateTaxAndTotal(
        price,
        newQuantity,
        Number(variant.tax_percentage) || 0,
        variant.tax_method || "EXCLUSIVE",
      );

      setSelectedItems((items) =>
        items.map((item) =>
          item.variant_id === variant.id
            ? {
                ...item,
                quantity: newQuantity,
                unit_price: Number(price) || 0,
                tax_amount: Number(tax_amount) || 0,
                line_total: Number(line_total) || 0,
              }
            : item,
        ),
      );
    } else {
      const { line_total, tax_amount } = calculateTaxAndTotal(
        price,
        1,
        Number(variant.tax_percentage) || 0,
        variant.tax_method || "EXCLUSIVE",
      );

      const newItem: SaleItem = {
        variant_id: variant.id,
        variant_name: variant.name,
        variant_sku: variant.sku,
        quantity: 1,
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
        tax_method: variant.tax_method || "EXCLUSIVE",
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const updateItemQuantity = (variantId: number, quantity: number) => {
    hasManualCartMutationRef.current = true;
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }

    setSelectedItems((items) =>
      items.map((item) => {
        if (item.variant_id === variantId) {
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
    hasManualCartMutationRef.current = true;
    setSelectedItems((items) =>
      items.filter((item) => item.variant_id !== variantId),
    );
  };

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

    setAppliedPromotions((prev) =>
      prev.filter((item) => item.id !== promotionId),
    );
  };

  const applyPromotionToCurrentQuotation = (promotion: Promotion) => {
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

  const updateItemSpecialDiscount = (variantId: number, amount: number) => {
    hasManualCartMutationRef.current = true;
    setSelectedItems((items) =>
      items.map((item) =>
        item.variant_id === variantId
          ? {
              ...item,
              special_discount_amount: Math.max(0, Number(amount) || 0),
            }
          : item,
      ),
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

    const subtotal = selectedItems.reduce((sum, item) => {
      return sum + getItemBaseAmount(item);
    }, 0);

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

    const finalDiscount =
      promotionDiscountAmount + averageDiscount + specialDiscount;

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
      };

      const totalDiscount = averageShare + specialShare + promotionShare;
      const netLineTotal = round2(Number(item.line_total) - totalDiscount);
      const soldUnitPrice = round2(netLineTotal / Number(item.quantity || 1));

      return {
        ...item,
        unit_price: item.unit_price,
        sold_unit_price: soldUnitPrice,
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
      sale_type: "quotation", // This is a quotation
      payment_status: "due", // Quotations are not paid
      received_amount: 0,
      payments: [], // No payments for quotations
    };

    try {
      setLoading(true);
      const createdQuotation = await salesApi.createQuotation(quotationData);

      // Invalidate quotations cache
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
            onChange={(value) => {
              if (value) {
                const selectedVariant = filteredVariants.find(
                  (v) => v.id === value,
                );
                if (selectedVariant) {
                  addToQuotation(selectedVariant);
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
