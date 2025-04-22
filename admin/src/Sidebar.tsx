import { UserOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import React, { useEffect, useState } from "react";
import { GrUserAdmin } from "react-icons/gr";
import { MdSubscriptions } from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import useDarkMode from "./hooks/useDarkMode";

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
      label: <span title="Employee">Employee</span>,
      key: "/user",
      icon: <GrUserAdmin />,
      children: [
        {
          label: <span title="Roles">Roles</span>,
          key: "/roles",
          permission: "users", // Required permission
        },
        {
          label: <span title="Users">Users</span>,
          key: "/users",
          permission: "users", // Required permission
        },
      ],
      permission: "users", // Required permission for parent
    },
    {
      key: "/plans",
      icon: <UserOutlined />,
      label: <span title="Plans">Plans</span>,
      permission: "plans", // Required permission
    },
    {
      key: "/consumers",
      icon: <UserOutlined />,
      label: <span title="Consumers">Consumers</span>,
      permission: "consumers", // Required permission
    },
    {
      key: "/billings",
      icon: <MdSubscriptions />,
      label: (
        <span title="Billing and Subscription">Billing & Subscriptions</span>
      ),
      permission: "billing", // Required permission
    },
    {
      label: <span title="Settings">Settings</span>,
      key: "/settings",
      icon: <GrUserAdmin />,
      children: [
        {
          label: <span title="Backup & Restore">Backup & Restore</span>,
          key: "/backup&restore",
          permission: "backup&restore",
        },
        {
          label: <span title="Users">Users</span>,
          key: "/users",
          permission: "users", // Required permission
        },
      ],
      permission: "users", // Required permission for parent
    },
  ];

  // Filter menu items based on user permissions
  const filteredMenuItems = menuItems
    .filter(
      (item) => !item.permission || user?.permissions?.includes(item.permission)
    )
    .map((item) => ({
      ...item,
      children: item.children
        ? item.children.filter(
            (child) =>
              !child.permission || user?.permissions?.includes(child.permission)
          )
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
