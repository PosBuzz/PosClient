import { useState, useEffect } from "react";
import { Layout, Menu, Button, theme } from "antd";
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  VideoCameraOutlined,
  UploadOutlined,
  DashboardOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Outlet } from "react-router-dom";

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Check if the screen is mobile size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const menuItems = [
    {
      key: "1",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    {
      key: "2",
      icon: <UserOutlined />,
      label: "Users",
    },
    {
      key: "3",
      icon: <VideoCameraOutlined />,
      label: "Media",
    },
    {
      key: "4",
      icon: <UploadOutlined />,
      label: "Upload",
    },
    {
      key: "5",
      icon: <SettingOutlined />,
      label: "Settings",
    },
  ];

  return (
    <Layout className="min-h-screen">
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="md"
        className={`overflow-auto h-screen fixed left-0 top-0 bottom-0 ${
          isMobile && !collapsed ? "fixed z-50 shadow-lg" : ""
        }`}
        style={{
          zIndex: 999,
          display: isMobile && collapsed ? "none" : "block",
        }}
      >
        <div className="text-center py-4">
          <h1
            className={`text-white transition-all duration-300 ${
              collapsed ? "text-lg" : "text-xl"
            }`}
          >
            {collapsed ? "App" : "MyApp"}
          </h1>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["1"]}
          items={menuItems}
        />
      </Sider>

      {/* Main Content Area */}
      <Layout className={`transition-all duration-300`}>
        {/* Header */}
        <Header
          style={{ background: colorBgContainer }}
          className="p-2! md:p-6! flex items-center justify-between shadow-sm sticky top-0 z-10"
        >
          <div className="flex items-center">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
              className="w-16 h-16 text-lg"
            />
            <h2 className="m-0 text-lg hidden md:block">Admin Dashboard</h2>
          </div>
          <div className="mr-6">
            <Button type="primary" icon={<UserOutlined />} className="mr-2">
              Profile
            </Button>
          </div>
        </Header>

        {/* Overlay for mobile when sidebar is open */}
        {isMobile && !collapsed && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setCollapsed(true)}
          />
        )}

        {/* Page Content */}
        <Content
          className="md:m-6 p-2 md:p-6"
          style={{
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
