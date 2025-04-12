import {
  DashboardOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Menu } from "antd";
import React, { useEffect, useState } from "react";
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
      key: "/",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    {
      key: "/consumers",
      icon: <UserOutlined />,
      label: "Consumers",
    },
  ];
  // const menuItems = [
  //   {
  //     label: 'Dashboard',
  //     key: '/',
  //     icon: <DashboardFilled />,
  //   },
  //   {
  //     label: 'Teams',
  //     key: '/teams',
  //     icon: <TeamOutlined />,
  //   },
  //   {
  //     label: 'Organizer',
  //     key: '/organizer',
  //     icon: <FileWordFilled />,
  //     children: [
  //       {
  //         label: 'Registered Organizer',
  //         key: '/organizer?organizer-status=accepted',
  //       },
  //       {
  //         label: 'Organizer Requests',
  //         key: '/request-organizers?organizer-status=pending',
  //       },
  //     ],
  //   },
  // ];

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
