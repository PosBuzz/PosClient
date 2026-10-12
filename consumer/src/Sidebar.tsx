import { Menu } from "antd";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useDarkMode from "./hooks/useDarkMode";
import { useAuthStore } from "./stores/authStore";
import { MENU_ITEMS, visibleMenuItems } from "./menuItems";

const SideBar: React.FC = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const isDarkMode = useDarkMode();

  const { user } = useAuthStore();

  useEffect(() => {
    const currentPath = location.pathname;
    setSelectedKeys([currentPath]);

    // Find parent key with improved logic: the parent whose child matches,
    // or whose path prefixes the current one
    const parentKey = MENU_ITEMS.find((item) => {
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

  const filteredMenuItems = visibleMenuItems(MENU_ITEMS, user?.permissions);

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
