import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { get } from "../api/crud-api";
import { endpoints } from "../api/endpoints";
import { promotionApi } from "../api/promotion-api";
import { salesApi } from "../api/sales-api";
import { queryKeys, queryStaleTimeMap } from "../constants/queryKeys";
import {
  Customer,
  DiscountType,
  PaymentMethod,
  PriceType,
  ProductVariantForSale,
  SaleItem,
  SalePayment,
} from "../types/sale.types";

type UserBranch = {
  id: number;
  name?: string;
};

type AuthUserLike = {
  branches?: UserBranch[];
} | null;

interface UseSaleManagerArgs {
  form: any;
  user: AuthUserLike;
}

// Manages the shared state, API queries, and initial form setup for the sale creation page.
export const useSaleManager = ({ form, user }: UseSaleManagerArgs) => {
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [servedByUsers, setServedByUsers] = useState<
    { id: number; name: string }[]
  >([]);
  const [filteredVariants, setFilteredVariants] = useState<
    ProductVariantForSale[]
  >([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedServedByUser, setSelectedServedByUser] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [averageDiscountType, setAverageDiscountType] = useState<DiscountType>(
    DiscountType.FLAT,
  );
  const [loading, setLoading] = useState(false);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([
    {
      payment_method: PaymentMethod.CASH,
      amount: 0,
      reference: "",
    },
  ]);

  const userBranches = user?.branches || [];

  const customersQuery = useQuery({
    queryKey: [queryKeys.customers, customerSearch],
    queryFn: async () => {
      const data = await get(endpoints.getCustomers, {
        ...(customerSearch ? { search: customerSearch } : {}),
        limit: 100,
      });
      return data.data || data;
    },
    staleTime: queryStaleTimeMap[queryKeys.customers],
  });

  const servedByUsersQuery = useQuery({
    queryKey: [queryKeys.users, selectedBranch],
    queryFn: async () => {
      const data = await get(endpoints.user, { branch_id: selectedBranch });
      return data.data || data;
    },
    enabled: !!selectedBranch,
    staleTime: queryStaleTimeMap[queryKeys.users],
  });

  const productsForSaleQuery = useQuery({
    queryKey: [queryKeys.productsForSale, selectedBranch, productSearch],
    queryFn: () =>
      salesApi.getProductsForSale(
        selectedBranch!,
        productSearch.trim() || undefined,
      ),
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
  }, [form, selectedBranch, userBranches]);

  useEffect(() => {
    if (customersQuery.data) {
      setCustomers(
        selectedCustomer &&
          !customersQuery.data.some(
            (customer: Customer) => customer.id === selectedCustomer.id,
          )
          ? [selectedCustomer, ...customersQuery.data]
          : customersQuery.data,
      );
    }
  }, [customersQuery.data, selectedCustomer]);

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

  const handleBranchChange = (branchId: number) => {
    setSelectedBranch(branchId);
    setSelectedItems([]);
    setProductSearch("");
    setAverageDiscountType(DiscountType.FLAT);
    form.setFieldsValue({ branch_id: branchId, average_discount_amount: 0 });
  };

  return {
    selectedItems,
    setSelectedItems,
    customers,
    setCustomers,
    setCustomerSearch,
    servedByUsers,
    setServedByUsers,
    filteredVariants,
    setFilteredVariants,
    productSearch,
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
    salePayments,
    setSalePayments,
    userBranches,
    customersQuery,
    servedByUsersQuery,
    productsForSaleQuery,
    activePromotionsQuery,
    handleBranchChange,
  };
};
