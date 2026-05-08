export const queryKeys = {
  adjustments: "adjustments",
  branches: "branches",
  branchOptions: "branch-options",
  brands: "brands",
  batch: "batch",
  batches: "batches",
  categories: "categories",
  inventorySummary: "inventory-summary",
  stockByVariant: "stock-by-variant",
  expiringBatches: "expiring-batches",
  variantStock: "variant-stock",
  lowStockItems: "low-stock-items",
  movementHistory: "movement-history",
  planPermissions: "plan-permissions",
  product: "product",
  products: "products",
  productsForInventory: "products-for-inventory",
  productVariants: "product-variants",
  receiptSettings: "receipt-settings",
  receiptSettingDefaults: "receipt-setting-defaults",
  roles: "roles",
  rules: "rules",
  sales: "sales",
  sale: "sale",
  salesStats: "sales-stats",
  userSalesStats: "user-sales-stats",
  variantSalesStats: "variant-sales-stats",
  productsForSale: "products-for-sale",
  promotions: "promotions",
  customers: "customers",
  customer: "customer",
  tags: "tags",
  transfers: "transfers",
  units: "units",
  users: "users",
  vendors: "vendors",
  returns: "returns",
  return: "return",
  dailyTarget: "daily-target-report",
  eod: "eod-report",
  dashboardAnalytics: "dashboard-analytics",
  quotations: "quotations",
  quotation: "quotation",
  partialPayments: "partial-payments",
  saleForPayment: "sale-for-payment",
};

// Stale time configurations for different data types
export const staleTimeConfig = {
  // Static/semi-static data (rarely changes)
  static: 15 * 60 * 1000, // 15 minutes
  // Dynamic data (changes frequently)
  dynamic: 2 * 60 * 1000, // 2 minutes
  // Real-time data (changes very frequently)
  realTime: 30 * 1000, // 30 seconds
  // Background data (can be slightly stale)
  background: 30 * 60 * 1000, // 30 minutes
};

// Query-specific stale time mappings
export const queryStaleTimeMap = {
  // Static data
  [queryKeys.branches]: staleTimeConfig.static,
  [queryKeys.branchOptions]: staleTimeConfig.static,
  [queryKeys.categories]: staleTimeConfig.static,
  [queryKeys.brands]: staleTimeConfig.static,
  [queryKeys.units]: staleTimeConfig.static,
  [queryKeys.tags]: staleTimeConfig.static,
  [queryKeys.roles]: staleTimeConfig.static,
  [queryKeys.vendors]: staleTimeConfig.static,
  [queryKeys.planPermissions]: staleTimeConfig.static,
  [queryKeys.receiptSettingDefaults]: staleTimeConfig.static,

  // Dynamic data
  [queryKeys.products]: staleTimeConfig.dynamic,
  [queryKeys.productVariants]: staleTimeConfig.dynamic,
  [queryKeys.productsForInventory]: staleTimeConfig.dynamic,
  [queryKeys.customers]: staleTimeConfig.dynamic,
  [queryKeys.customer]: staleTimeConfig.dynamic,
  [queryKeys.users]: staleTimeConfig.dynamic,
  [queryKeys.sales]: staleTimeConfig.dynamic,
  [queryKeys.promotions]: staleTimeConfig.dynamic,
  [queryKeys.sale]: staleTimeConfig.dynamic,
  [queryKeys.returns]: staleTimeConfig.dynamic,
  [queryKeys.return]: staleTimeConfig.dynamic,
  [queryKeys.productsForSale]: staleTimeConfig.dynamic,
  [queryKeys.product]: staleTimeConfig.dynamic,
  [queryKeys.batches]: staleTimeConfig.dynamic,
  [queryKeys.batch]: staleTimeConfig.dynamic,
  [queryKeys.adjustments]: staleTimeConfig.dynamic,
  [queryKeys.transfers]: staleTimeConfig.dynamic,
  [queryKeys.rules]: staleTimeConfig.dynamic,
  [queryKeys.quotations]: staleTimeConfig.dynamic,
  [queryKeys.quotation]: staleTimeConfig.dynamic,
  [queryKeys.partialPayments]: staleTimeConfig.dynamic,
  [queryKeys.saleForPayment]: staleTimeConfig.dynamic,
  [queryKeys.receiptSettings]: staleTimeConfig.dynamic,

  // Real-time data
  [queryKeys.inventorySummary]: staleTimeConfig.realTime,
  [queryKeys.stockByVariant]: staleTimeConfig.realTime,
  [queryKeys.variantStock]: staleTimeConfig.realTime,
  [queryKeys.lowStockItems]: staleTimeConfig.realTime,
  [queryKeys.salesStats]: staleTimeConfig.realTime,
  [queryKeys.eod]: staleTimeConfig.realTime,
  [queryKeys.dailyTarget]: staleTimeConfig.realTime,
  [queryKeys.dashboardAnalytics]: staleTimeConfig.realTime,
  [queryKeys.userSalesStats]: staleTimeConfig.realTime,
  [queryKeys.variantSalesStats]: staleTimeConfig.realTime,

  // Background data
  [queryKeys.movementHistory]: staleTimeConfig.background,
  [queryKeys.expiringBatches]: staleTimeConfig.background,
};
