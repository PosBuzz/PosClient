import { DashboardOutlined, SettingOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useDarkMode from "./hooks/useDarkMode";
import { useAuthStore } from "./stores/authStore";
import { Permissions } from "./constants/permissions";
import { GrUserAdmin } from "react-icons/gr";

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
      label: <span title="Settings">Settings</span>,
      key: "/settings",
      icon: <SettingOutlined />,
      children: [
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
