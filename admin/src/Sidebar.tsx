import { DashboardOutlined, UserOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import React, { useEffect, useState } from "react";
import { GrUserAdmin } from "react-icons/gr";
import { MdSubscriptions } from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminPermission } from "./constants/adminPermissions";
import useDarkMode from "./hooks/useDarkMode";
import { useAuthStore } from "./stores/authStore";

const SideBar: React.FC = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const isDarkMode = useDarkMode();

  const { user } = useAuthStore();
  

  useEffect(() => {
    const currentKey = location.pathname + location.search || "";
    setSelectedKeys([currentKey]);

    const parentKey = menuItems.find((item) =>
      item?.children?.some((child) => child.key === currentKey)
    )?.key;

    if (parentKey) {
      setOpenKeys([parentKey]);
    } else {
      setOpenKeys([]);
    }
  }, [location.pathname, location.search]);

  const onOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  // Define menu items with required permissions
  interface MenuItem {
    key: string;
    icon?: React.ReactNode;
    label: React.ReactNode;
    children?: MenuItem[];
    permissions?: string[];
  }

  const menuItems: MenuItem[] = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: <span title="Dashboard">Dashboard</span>,
    },
    {
      key: "/plans",
      icon: <UserOutlined />,
      label: <span title="Plans">Plans</span>,
      permissions: [AdminPermission.plans],
    },
    {
      key: "/consumers",
      icon: <UserOutlined />,
      label: <span title="Consumers">Consumers</span>,
      permissions: [AdminPermission.consumers],
    },
    {
      key: "/billings",
      icon: <MdSubscriptions />,
      label: (
        <span title="Billing and Subscription">Billing & Subscriptions</span>
      ),
      permissions: [AdminPermission.billing],
    },
    {
      label: <span title="Settings">Settings</span>,
      key: "/settings",
      icon: <GrUserAdmin />,
      children: [
        {
          label: <span title="Account and Security">Account & Security</span>,
          key: "/account&security",
          permissions: [AdminPermission.profile],
        },
        {
          label: <span title="Roles">Roles</span>,
          key: "/roles",
          permissions: [AdminPermission.users],
        },
        {
          label: <span title="Users">Users</span>,
          key: "/users",
          permissions: [AdminPermission.users],
        },
        {
          label: <span title="Backup & Restore">Backup & Restore</span>,
          key: "/backup&restore",
          permissions: [AdminPermission.backupRestore],
        },
      ],
      permissions: [AdminPermission.profile, AdminPermission.backupRestore],
    },
  ];

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
    }));

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
