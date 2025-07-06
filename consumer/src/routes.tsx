import { lazy } from "react";
import RequireAuth from "./components/RequireAuth";
import RequirePermission from "./components/RequirePermission";
import { Permissions } from "./constants/permissions";
import AppLayout from "./layout";

const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/dashboard"));
const AccountSecurity = lazy(() => import("./pages/account-security"));
const Roles = lazy(() => import("./pages/roles"));
const Users = lazy(() => import("./pages/users"));
const Products = lazy(() => import("./pages/products"));
const ViewProduct = lazy(() => import("./pages/view-product"));
const AddOrEditProduct = lazy(() => import("./pages/add-or-edit-product"));
const AddEditBatch = lazy(() => import("./pages/add-or-edit-inventory"));
const Inventory = lazy(() => import("./pages/inventory"));
const InventoryTransfers = lazy(() => import("./pages/inventory-transfers"));
const AddInventoryTransfers = lazy(
  () => import("./pages/create-inventory-transfer")
);
const InventoryAdjustments = lazy(
  () => import("./pages/inventory-adjustments")
);
const AddInventoryAdjustments = lazy(
  () => import("./pages/add-inventory-adjustment")
);
const InventoryStockByVariant = lazy(
  () => import("./pages/inventory-stock-by-variant")
);
const InventoryExpiring = lazy(() => import("./pages/inventory-expiring"));
const InventoryVariantStock = lazy(
  () => import("./pages/inventory-variant-stock")
);
const InventoryLowStock = lazy(() => import("./pages/inventory-low-stock"));
const InventoryMovementHistory = lazy(
  () => import("./pages/inventory-movement-history")
);
const Vendors = lazy(() => import("./pages/vendors"));
const Branches = lazy(() => import("./pages/branches"));
const Tags = lazy(() => import("./pages/tags"));
const Categories = lazy(() => import("./pages/categories"));
const Brands = lazy(() => import("./pages/brands"));
const Units = lazy(() => import("./pages/units"));
const Customers = lazy(() => import("./pages/customers"));
const Sales = lazy(() => import("./pages/sales"));
const AddSale = lazy(() => import("./pages/sales/add-new"));
const AddCompactSale = lazy(() => import("./pages/sales/add-compact"));
const SaleDetail = lazy(() => import("./pages/view-sales"));

export const routes = [
  {
    path: "*",
    element: <NotFound />,
  },
  {
    path: "/login",
    element: <Login />,
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
      {        path: "inventory/movement-history/:variantId",
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
        path: "sales/new",
        element: (
          <RequirePermission permission={Permissions.sales}>
            <AddSale />
          </RequirePermission>
        ),
      },
      {
        path: "sales/add",
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
      // {
      //   path: "sales/pos",
      //   element: (
      //     <RequirePermission permission={Permissions.branches}>
      //       <AddCompactSale />
      //     </RequirePermission>
      //   ),
      // },
    ],
  },
];
