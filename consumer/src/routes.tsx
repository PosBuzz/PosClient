import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import RequirePermission from "./components/RequirePermission";
import { Permissions } from "./constants/permissions";
import AppLayout from "./layout";

const NotFound = lazy(() => import("./pages/NotFound"));
const SubscriptionInactive = lazy(() => import("./pages/SubscriptionInactive"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/dashboard"));
const AccountSecurity = lazy(() => import("./pages/account-security"));
const Profile = lazy(() => import("./pages/profile"));
const Roles = lazy(() => import("./pages/roles"));
const Users = lazy(() => import("./pages/users"));
const Products = lazy(() => import("./pages/products"));
const ViewProduct = lazy(() => import("./pages/view-product"));
const AddOrEditProduct = lazy(() => import("./pages/add-or-edit-product"));
const AddEditBatch = lazy(() => import("./pages/add-or-edit-inventory"));
const Inventory = lazy(() => import("./pages/inventory"));
const InventoryTransfers = lazy(() => import("./pages/inventory-transfers"));
const AddInventoryTransfers = lazy(
  () => import("./pages/create-inventory-transfer"),
);
const InventoryAdjustments = lazy(
  () => import("./pages/inventory-adjustments"),
);
const AddInventoryAdjustments = lazy(
  () => import("./pages/add-inventory-adjustment"),
);
const InventoryStockByVariant = lazy(
  () => import("./pages/inventory-stock-by-variant"),
);
const InventoryExpiring = lazy(() => import("./pages/inventory-expiring"));
const InventoryVariantStock = lazy(
  () => import("./pages/inventory-variant-stock"),
);
const InventoryLowStock = lazy(() => import("./pages/inventory-low-stock"));
const InventoryMovementHistory = lazy(
  () => import("./pages/inventory-movement-history"),
);
const Vendors = lazy(() => import("./pages/vendors"));
const ViewVendor = lazy(() => import("./pages/view-vendor"));
const Branches = lazy(() => import("./pages/branches"));
const Tags = lazy(() => import("./pages/tags"));
const Categories = lazy(() => import("./pages/categories"));
const Brands = lazy(() => import("./pages/brands"));
const Units = lazy(() => import("./pages/units"));
const Customers = lazy(() => import("./pages/customers"));
const Sales = lazy(() => import("./pages/sales"));
const Promotions = lazy(() => import("./pages/promotions"));
const AddSale = lazy(() => import("./pages/add-sales"));
const SaleDetail = lazy(() => import("./pages/view-sale"));
const UserSalesStats = lazy(() => import("./pages/user-sales-stats"));
const ViewUserSalesStats = lazy(
  () => import("./pages/user-sales-stats/view-user-sales-stats"),
);
const OnlineOrders = lazy(() => import("./pages/online-orders"));
const PendingDeliveries = lazy(() => import("./pages/pending-deliveries"));
const DailyTargetReport = lazy(() => import("./pages/daily-target"));
const BusinessReport = lazy(() => import("./pages/eod"));
const OperationalCosts = lazy(() => import("./pages/operational-costs"));
const POSPage = lazy(() => import("./pages/pos"));
const BarcodePrinting = lazy(() => import("./pages/barcode-printing"));
const Returns = lazy(() => import("./pages/returns"));
const CreateReturn = lazy(() => import("./pages/returns/create"));
const ViewReturn = lazy(() => import("./pages/view-return"));
const RewardsSettings = lazy(() => import("./pages/rewards-settings"));
const RewardPoints = lazy(() => import("./pages/customer-rewards"));
const Quotations = lazy(() => import("./pages/quotations"));
const AddQuotation = lazy(() => import("./pages/add-quotation"));
const ViewQuotation = lazy(() => import("./pages/view-quotation"));
const PartialPayments = lazy(() => import("./pages/partial-payments"));
const MakePayment = lazy(() => import("./pages/partial-payments/make-payment"));
const PurchasePayments = lazy(() => import("./pages/purchase-payments"));
const MakePurchasePayment = lazy(
  () => import("./pages/purchase-payments/make-payment"),
);
const ProductVariantSalesStats = lazy(
  () => import("./pages/product-variant-sales-stats"),
);
const ViewVariantSalesStats = lazy(
  () => import("./pages/product-variant-sales-stats/view-variant-sales-stats"),
);
const ProductAudit = lazy(() => import("./pages/product-audit"));
const ReceiptSettings = lazy(() => import("./pages/receipt-settings"));
const AddOrEditReceiptSettings = lazy(
  () => import("./pages/add-or-edit-receipt-settings"),
);

export const routes = [
  {
    path: "*",
    element: <NotFound />,
  },
  {
    path: "/404",
    element: <NotFound />,
  },
  {
    path: "/inactive",
    element: <SubscriptionInactive />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/pos",
    element: (
      <RequireAuth>
        <RequirePermission permission={Permissions.sales}>
          <POSPage />
        </RequirePermission>
      </RequireAuth>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      {
        path: "account&security",
        element: (
          <RequirePermission permission={Permissions.profile}>
            <AccountSecurity />
          </RequirePermission>
        ),
      },
      {
        path: "profile",
        element: (
          <RequirePermission permission={Permissions.companyProfile}>
            <Profile />
          </RequirePermission>
        ),
      },
      {
        path: "roles",
        element: (
          <RequirePermission permission={Permissions.users}>
            <Roles />
          </RequirePermission>
        ),
      },
      {
        path: "users",
        element: (
          <RequirePermission permission={Permissions.users}>
            <Users />
          </RequirePermission>
        ),
      },
      {
        path: "customers",
        element: (
          <RequirePermission permission={Permissions.customers}>
            <Customers />
          </RequirePermission>
        ),
      },
      {
        path: "branches",
        element: (
          <RequirePermission permission={Permissions.branches}>
            <Branches />
          </RequirePermission>
        ),
      },
      {
        path: "tags",
        element: (
          <RequirePermission permission={Permissions.branches}>
            <Tags />
          </RequirePermission>
        ),
      },
      {
        path: "categories",
        element: (
          <RequirePermission permission={Permissions.branches}>
            <Categories />
          </RequirePermission>
        ),
      },
      {
        path: "brands",
        element: (
          <RequirePermission permission={Permissions.branches}>
            <Brands />
          </RequirePermission>
        ),
      },
      {
        path: "units",
        element: (
          <RequirePermission permission={Permissions.branches}>
            <Units />
          </RequirePermission>
        ),
      },
      {
        path: "vendors",
        element: (
          <RequirePermission permission={Permissions.vendors}>
            <Vendors />
          </RequirePermission>
        ),
      },
      {
        path: "vendors/view/:id",
        element: (
          <RequirePermission permission={Permissions.vendors}>
            <ViewVendor />
          </RequirePermission>
        ),
      },
      {
        path: "products",
        element: (
          <RequirePermission permission={Permissions.view_product}>
            <Products />
          </RequirePermission>
        ),
      },
      {
        path: "products/view/:id",
        element: (
          <RequirePermission permission={Permissions.view_product}>
            <ViewProduct />
          </RequirePermission>
        ),
      },
      {
        path: "products/add",
        element: (
          <RequirePermission permission={Permissions.add_product}>
            <AddOrEditProduct />
          </RequirePermission>
        ),
      },
      {
        path: "products/edit/:id",
        element: (
          <RequirePermission permission={Permissions.edit_product}>
            <AddOrEditProduct />
          </RequirePermission>
        ),
      },
      // Inventory Management Routes
      {
        path: "inventory/batches",
        element: (
          <RequirePermission permission={Permissions.add_product}>
            <Inventory />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/batches/add",
        element: (
          <RequirePermission permission={Permissions.add_product}>
            <AddEditBatch />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/batches/edit/:id",
        element: (
          <RequirePermission permission={Permissions.edit_product}>
            <AddEditBatch />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/transfers",
        element: (
          <RequirePermission permission={Permissions.edit_product}>
            <InventoryTransfers />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/transfers/add",
        element: (
          <RequirePermission permission={Permissions.edit_product}>
            <AddInventoryTransfers />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/adjustments",
        element: (
          <RequirePermission permission={Permissions.edit_product}>
            <InventoryAdjustments />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/adjustments/add",
        element: (
          <RequirePermission permission={Permissions.edit_product}>
            <AddInventoryAdjustments />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/stock-by-variant",
        element: (
          <RequirePermission permission={Permissions.inventory_batches}>
            <InventoryStockByVariant />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/expiring",
        element: (
          <RequirePermission permission={Permissions.inventory_batches}>
            <InventoryExpiring />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/variants/:id/stock",
        element: (
          <RequirePermission permission={Permissions.inventory_batches}>
            <InventoryVariantStock />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/low-stock",
        element: (
          <RequirePermission permission={Permissions.inventory_batches}>
            <InventoryLowStock />
          </RequirePermission>
        ),
      },
      {
        path: "inventory/movement-history/:variantId",
        element: (
          <RequirePermission permission={Permissions.inventory_batches}>
            <InventoryMovementHistory />
          </RequirePermission>
        ),
      },
      // Sales Routes
      {
        path: "sales",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <Sales />
          </RequirePermission>
        ),
      },
      {
        path: "promotions",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <Promotions />
          </RequirePermission>
        ),
      },
      {
        path: "sales/new",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <AddSale />
          </RequirePermission>
        ),
      },
      {
        path: "sales/view/:id",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <SaleDetail />
          </RequirePermission>
        ),
      },
      {
        path: "user-sales-stats",
        element: (
          <RequirePermission permission={Permissions.business_insights}>
            <UserSalesStats />
          </RequirePermission>
        ),
      },
      {
        path: "user-sales-stats/:userId",
        element: (
          <RequirePermission permission={Permissions.business_insights}>
            <ViewUserSalesStats />
          </RequirePermission>
        ),
      },
      {
        path: "online-orders",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <OnlineOrders />
          </RequirePermission>
        ),
      },
      {
        path: "pending-deliveries",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <PendingDeliveries />
          </RequirePermission>
        ),
      },
      // Quotation Routes
      {
        path: "quotations",
        element: (
          <RequirePermission permission={Permissions.quotations}>
            <Quotations />
          </RequirePermission>
        ),
      },
      {
        path: "add-quotation",
        element: (
          <RequirePermission permission={Permissions.quotations}>
            <AddQuotation />
          </RequirePermission>
        ),
      },
      {
        path: "quotations/view/:id",
        element: (
          <RequirePermission permission={Permissions.quotations}>
            <ViewQuotation />
          </RequirePermission>
        ),
      },
      // Barcode Printing Route
      {
        path: "barcode-printing",
        element: (
          <RequirePermission permission={Permissions.add_product}>
            <BarcodePrinting />
          </RequirePermission>
        ),
      },
      // Product Variant Sales Stats Routes
      {
        path: "product-variant-sales-stats",
        element: (
          <RequirePermission permission={Permissions.business_insights}>
            <ProductVariantSalesStats />
          </RequirePermission>
        ),
      },
      {
        path: "product-variant-sales-stats/:variantId",
        element: (
          <RequirePermission permission={Permissions.business_insights}>
            <ViewVariantSalesStats />
          </RequirePermission>
        ),
      },
      {
        path: "daily-target",
        element: (
          <RequirePermission permission={Permissions.business_insights}>
            <DailyTargetReport />
          </RequirePermission>
        ),
      },
      {
        path: "business-report",
        element: (
          <RequirePermission permission={Permissions.business_insights}>
            <BusinessReport />
          </RequirePermission>
        ),
      },
      {
        path: "operational-costs",
        element: (
          <RequirePermission permission={Permissions.business_insights}>
            <OperationalCosts />
          </RequirePermission>
        ),
      },
      // Returns Routes
      {
        path: "returns",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <Returns />
          </RequirePermission>
        ),
      },
      {
        path: "returns/new",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <CreateReturn />
          </RequirePermission>
        ),
      },
      {
        path: "returns/view/:id",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <ViewReturn />
          </RequirePermission>
        ),
      },
      // Partial Payments Routes
      {
        path: "partial-payments",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <PartialPayments />
          </RequirePermission>
        ),
      },
      {
        path: "partial-payments/:id/pay",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <MakePayment />
          </RequirePermission>
        ),
      },
      // Purchase Payments Routes
      {
        path: "purchase-payments",
        element: (
          <RequirePermission permission={Permissions.inventory_batches}>
            <PurchasePayments />
          </RequirePermission>
        ),
      },
      {
        path: "purchase-payments/:id",
        element: (
          <RequirePermission permission={Permissions.inventory_batches}>
            <MakePurchasePayment />
          </RequirePermission>
        ),
      },
      {
        path: "rewards-settings",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <RewardsSettings />
          </RequirePermission>
        ),
      },
      {
        path: "reward-points",
        element: (
          <RequirePermission permission={Permissions.customers}>
            <RewardPoints />
          </RequirePermission>
        ),
      },
      {
        path: "product-audit",
        element: (
          <RequirePermission permission={Permissions.product_audit}>
            <ProductAudit />
          </RequirePermission>
        ),
      },
      {
        path: "printer-settings",
        element: (
          <RequirePermission permission={Permissions.receipt_settings}>
            <ReceiptSettings />
          </RequirePermission>
        ),
      },
      {
        path: "printer-settings/add",
        element: (
          <RequirePermission permission={Permissions.receipt_settings}>
            <AddOrEditReceiptSettings />
          </RequirePermission>
        ),
      },
      {
        path: "printer-settings/edit/:id",
        element: (
          <RequirePermission permission={Permissions.receipt_settings}>
            <AddOrEditReceiptSettings />
          </RequirePermission>
        ),
      },
    ],
  },
];
