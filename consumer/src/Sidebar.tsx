import { DashboardOutlined, UserOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import React, { useEffect, useState } from "react";
import { GrUserAdmin } from "react-icons/gr";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import useDarkMode from "./hooks/useDarkMode";
import { Permissions } from "./constants/permissions";

const SideBar: React.FC = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const isDarkMode = useDarkMode();

  const { user } = useAuth();

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
  const menuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: <span title="Dashboard">Dashboard</span>,
    },
    // {
    //   label: <span title="Settings">Settings</span>,
    //   key: "/settings",
    //   icon: <GrUserAdmin />,
    //   children: [
    //     {
    //       label: <span title="Account and Security">Account & Security</span>,
    //       key: "/account&security",
    //       permissions: [Permissions.profile],
    //     },
    //   ],
    //   permissions: [Permissions.profile],
    // },
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
