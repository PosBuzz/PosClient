import { UserOutlined } from "@ant-design/icons";
import { Menu } from "antd";
import React, { useEffect, useState } from "react";
import { GrUserAdmin } from "react-icons/gr";
import { MdSubscriptions } from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";

const SideBar: React.FC = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

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

  const menuItems = [
    {
      label: <span title="Organizer Section">Organizer</span>,
      key: "/user",
      icon: <GrUserAdmin />,
      children: [
        {
          label: <span title="Roles">Roles</span>,
          key: "/roles",
        },
        {
          label: <span title="Users">Users</span>,
          key: "/users",
        },
      ],
    },
    {
      key: "/plans",
      icon: <UserOutlined />,
      label: <span title="Plans Section">Plans</span>,
    },
    {
      key: "/consumers",
      icon: <UserOutlined />,
      label: <span title="Consumers Section">Consumers</span>,
    },
    {
      key: "/billings",
      icon: <MdSubscriptions />,
      label: <span title="Billing and Subscription Details">Billing & Subscriptions</span>,
    },
  ];

  return (
    <Menu
      onClick={({ key }) => {
        navigate(key);
      }}
      theme="dark"
      mode="inline"
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onOpenChange={onOpenChange}
      items={menuItems}
    />
  );
};

export default SideBar;
