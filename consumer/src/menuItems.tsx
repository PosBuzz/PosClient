import {
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  ProductOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import React from "react";
import { MdOutlineInventory } from "react-icons/md";
import { Permissions } from "./constants/permissions";

// Define menu items with required permissions
export interface MenuItem {
  key: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  children?: MenuItem[];
  permissions?: string[];
}

export const MENU_ITEMS: MenuItem[] = [
  {
    key: "/",
    icon: <DashboardOutlined />,
    label: <span title="Dashboard">Dashboard</span>,
  },
  {
    label: <span title="Products">Products</span>,
    key: "/products-menu",
    icon: <ProductOutlined />,
    children: [
      {
        label: <span title="Add Product">Add Product</span>,
        key: "/products/add",
        permissions: [Permissions.add_product],
      },
      {
        label: <span title="All Products">View Products</span>,
        key: "/products",
        permissions: [Permissions.view_product],
      },
      {
        label: <span title="Variant Sales Stats">Sales Stats</span>,
        key: "/product-variant-sales-stats",
        permissions: [Permissions.business_insights],
      },
      {
        label: <span title="Product Audit">Product Audit</span>,
        key: "/product-audit",
        permissions: [Permissions.product_audit],
      },
      {
        label: <span title="Categories">Categories</span>,
        key: "/categories",
        permissions: [Permissions.edit_product, Permissions.add_product],
      },
      {
        label: <span title="Brands">Brands</span>,
        key: "/brands",
        permissions: [Permissions.edit_product, Permissions.add_product],
      },
      {
        label: <span title="Tags">Tags</span>,
        key: "/tags",
        permissions: [Permissions.edit_product, Permissions.add_product],
      },
      {
        label: <span title="Units">Units</span>,
        key: "/units",
        permissions: [Permissions.edit_product, Permissions.add_product],
      },
      {
        label: <span title="Barcode Printing">Barcode Printing</span>,
        key: "/barcode-printing",
        permissions: [Permissions.add_product],
      },
    ],
  },
  {
    label: <span title="Inventory">Inventory</span>,
    key: "/inventory",
    icon: <MdOutlineInventory />,
    children: [
      {
        label: <span title="Add Inventory">Add Inventory</span>,
        key: "/inventory/batches/add",
        permissions: [Permissions.inventory_batches],
      },
      {
        label: <span title="View Inventory">View Inventory</span>,
        key: "/inventory/batches",
        permissions: [Permissions.inventory_batches],
      },
      {
        label: <span title="Add Transfer">Add Transfer</span>,
        key: "/inventory/transfers/add",
        permissions: [Permissions.inventory_transfer],
      },
      {
        label: <span title="Inventory Transfer">Inventory Transfer</span>,
        key: "/inventory/transfers",
        permissions: [Permissions.inventory_transfer],
      },
      {
        label: <span title="Add Adjustment">Add Adjustment</span>,
        key: "/inventory/adjustments/add",
        permissions: [Permissions.inventory_adjustment],
      },
      {
        label: <span title="Inventory Adjustment">Inventory Adjustment</span>,
        key: "/inventory/adjustments",
        permissions: [Permissions.inventory_adjustment],
      },
      {
        label: <span title="Stock Overview">Stock Overview</span>,
        key: "/inventory/stock-by-variant",
        permissions: [Permissions.inventory_batches],
      },
      {
        label: <span title="Expiring Items">Expiring Items</span>,
        key: "/inventory/expiring",
        permissions: [Permissions.inventory_batches],
      },
      {
        label: <span title="Low Stock">Low Stock</span>,
        key: "/inventory/low-stock",
        permissions: [Permissions.inventory_batches],
      },
      {
        label: <span title="Vendors">Vendors</span>,
        key: "/vendors",
        permissions: [Permissions.vendors, Permissions.inventory_batches],
      },
      {
        label: <span title="Purchase Payments">Purchase Payments</span>,
        key: "/purchase-payments",
        permissions: [Permissions.inventory_batches],
      },
    ],
  },
  {
    label: <span title="Sales">Sales</span>,
    key: "/sales-menu",
    icon: <ShoppingCartOutlined />,
    children: [
      {
        label: <span title="New Sale">New Sale</span>,
        key: "/sales/new",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="View Sales">View Sales</span>,
        key: "/sales",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="New Quotation">New Quotation</span>,
        key: "/add-quotation",
        permissions: [Permissions.quotations],
      },
      {
        label: <span title="View Quotations">View Quotations</span>,
        key: "/quotations",
        permissions: [Permissions.quotations],
      },
      {
        label: <span title="Create Return">Create Return</span>,
        key: "/returns/new",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="View Returns">View Returns</span>,
        key: "/returns",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="Discount & Promotions">Disc. & Promo</span>,
        key: "/promotions",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="Due Payments">Due Payments</span>,
        key: "/partial-payments",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="Online Orders">Online Orders</span>,
        key: "/online-orders",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="Pending Deliveries">Pending Deliveries</span>,
        key: "/pending-deliveries",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="Daily Sales Target">Sales Target</span>,
        key: "/daily-target",
        permissions: [Permissions.business_insights],
      },

      {
        label: <span title="User Sales Stats">User Sales Stats</span>,
        key: "/user-sales-stats",
        permissions: [Permissions.business_insights],
      },
    ],
  },
  {
    label: <span title="Operational Costs">Operational Costs</span>,
    key: "/operational-costs",
    icon: <DollarOutlined />,
    permissions: [Permissions.business_insights],
  },
  {
    label: (
      <span title="Daily and Monthly Business Report">Business Report</span>
    ),
    key: "/business-report",
    icon: <FileTextOutlined />,
    permissions: [Permissions.business_insights],
  },
  {
    label: <span title="Customers">Customers</span>,
    key: "/customers-menu",
    icon: <UserOutlined />,
    children: [
      {
        label: <span title="Customers">Customers</span>,
        key: "/customers",
        permissions: [Permissions.customers],
      },
      {
        label: <span title="Reward Points">Reward Points</span>,
        key: "/reward-points",
        permissions: [Permissions.customers],
      },
    ],
  },
  {
    label: <span title="Settings">Settings</span>,
    key: "/settings",
    icon: <SettingOutlined />,
    children: [
      {
        label: <span title="Company Profile">Company Profile</span>,
        key: "/profile",
        permissions: [Permissions.companyProfile],
      },
      {
        label: <span title="Branches">Branches</span>,
        key: "/branches",
        permissions: [Permissions.branches],
      },
      {
        label: <span title="Printer Settings">Printer Settings</span>,
        key: "/printer-settings",
        permissions: [Permissions.receipt_settings],
      },
      {
        label: <span title="Rewards">Rewards</span>,
        key: "/rewards-settings",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="POS Layout">POS Layout</span>,
        key: "/pos-layout-settings",
        permissions: [Permissions.sales],
      },
      {
        label: <span title="Roles">Roles</span>,
        key: "/roles",
        permissions: [Permissions.users],
      },
      {
        label: <span title="Users">Users</span>,
        key: "/users",
        permissions: [Permissions.users],
      },
    ],
    permissions: [Permissions.users],
  },
  {
    key: "/support",
    icon: <CustomerServiceOutlined />,
    label: <span title="Support">Support</span>,
    permissions: [Permissions.support],
  },
];

/** A menu entry is shown when the user holds ANY of its permissions; parents with no visible child disappear. */
export const visibleMenuItems = (
  items: MenuItem[],
  permissions: string[] | undefined,
) => {
  const hasPermission = (required: string[] = []) =>
    !required.length || required.some((perm) => permissions?.includes(perm));
  return items
    .filter((item) => hasPermission(item.permissions))
    .map((item) => ({
      ...item,
      children: item.children
        ? item.children.filter((child) => hasPermission(child.permissions))
        : undefined,
    }))
    .filter((item) => !item.children || item.children.length > 0);
};
