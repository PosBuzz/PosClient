import {
  DashboardOutlined,
  ProductOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Menu } from "antd";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Permissions } from "./constants/permissions";
import useDarkMode from "./hooks/useDarkMode";
import { useAuthStore } from "./stores/authStore";
import { MdOutlineInventory } from "react-icons/md";

// Define menu items with required permissions - MOVED OUTSIDE COMPONENT
interface MenuItem {
  key: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  children?: MenuItem[];
  permissions?: string[];
}

const SideBar: React.FC = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const isDarkMode = useDarkMode();

  const { user } = useAuthStore();

  const menuItems: MenuItem[] = [
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
          permissions: [Permissions.view_product],
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
      key: "/",
      icon: <DashboardOutlined />,
      label: <span title="Dashboard">Dashboard</span>,
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
          label: <span title="Stock by Variant">Stock by Variant</span>,
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
          label: <span title="Daily Sales Target">Sales Target</span>,
          key: "/daily-target",
          permissions: [Permissions.sales],
        },

        {
          label: <span title="User Sales Stats">User Sales Stats</span>,
          key: "/user-sales-stats",
          permissions: [Permissions.sales],
        },
        // {
        //   label: <span title="End of Day Report">End of Day Report</span>,
        //   key: "/eod",
        //   permissions: [Permissions.sales],
        // },
      ],
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
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    setSelectedKeys([currentPath]);

    // Find parent key with improved logic
    let parentKey: string | undefined;

    // Check if current path is a child of any parent menu item
    parentKey = menuItems.find((item) => {
      if (!item.children) return false;

      // Check if any child matches exactly
      const exactChildMatch = item.children.some(
        (child) => child.key === currentPath,
      );
      if (exactChildMatch) return true;

      // Check if current path starts with the parent path (for nested routes)
      if (item.key !== "/" && currentPath.startsWith(item.key)) {
        return true;
      }

      return false;
    })?.key;

    if (parentKey) {
      setOpenKeys([parentKey]);
    } else {
      setOpenKeys([]);
    }
  }, [location.pathname]);

  const onOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  const hasPermission = (required: string[] = []) => {
    if (!required.length) return true;
    return required.some((perm) => user?.permissions?.includes(perm));
  };

  const filteredMenuItems = menuItems
    .filter((item) => hasPermission(item.permissions))
    .map((item) => ({
      ...item,
      children: item.children
        ? item.children.filter((child) => hasPermission(child.permissions))
        : undefined,
    }))
    .filter((item) => !item.children || item.children.length > 0); // Remove parent items with no visible children

  return (
    <Menu
      onClick={({ key }) => {
        navigate(key);
      }}
      style={{ border: 0 }}
      mode="inline"
      theme={isDarkMode ? "dark" : "light"}
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onOpenChange={onOpenChange}
      items={filteredMenuItems}
    />
  );
};

export default SideBar;
