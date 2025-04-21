import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from "@ant-design/icons";
import { Button, ConfigProvider, Layout, theme, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import ThemeDropdown from "./components/ThemeDropdown";
import { useAuth } from "./contexts/AuthContext";
import SideBar from "./Sidebar";

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>();

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

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        components: {
          Layout: {
            siderBg: isDarkMode ? "#001529" : "#fff",
            headerBg: isDarkMode ? "#001529" : "#fff",
          },
          Menu: {
            itemBg: isDarkMode ? "#001529" : "#fff",
            itemHoverColor: isDarkMode ? "#1677ff" : "#1677ff",
            itemSelectedColor: isDarkMode ? "#fff" : "#1677ff",
            itemSelectedBg: isDarkMode ? "#1677ff" : "rgba(0, 0, 0, 0.04)",
          },
        },
      }}
    >
      <Layout className="max-h-screen">
        {/* Sidebar - Fixed position */}
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          breakpoint="md"
          theme={isDarkMode ? "dark" : "light"}
          className={`h-screen fixed left-0 top-0 bottom-0 overflow-auto ${
            isMobile && !collapsed ? "z-50 shadow-lg" : ""
          }`}
          style={{
            zIndex: 999,
            display: isMobile && collapsed ? "none" : "block",
          }}
        >
          <div className="text-center py-4">
            <h1
              className={`transition-all duration-300 ${
                collapsed ? "text-lg" : "text-xl"
              }`}
              style={{ color: isDarkMode ? "#fff" : "#000" }}
            >
              {collapsed ? "PB" : "PosBuzz"}
            </h1>
          </div>

          <SideBar />
        </Sider>

        {/* Main Content Area - Adjusted for sidebar */}
        <Layout className={`transition-all duration-300`}>
          {/* Header - Fixed at the top of content area */}
          <Header
            style={{
              position: "sticky",
              top: 0,
              width: "100%",
              zIndex: 10,
              padding: "0 16px",
            }}
            className="shadow-sm flex items-center justify-between"
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
            <div className="flex">
              <ThemeDropdown
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
              />
              <Tooltip title="Logout">
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={logout}
                />
              </Tooltip>
            </div>
          </Header>

          {/* Overlay for mobile when sidebar is open */}
          {isMobile && !collapsed && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setCollapsed(true)}
            />
          )}

          {/* Page Content - Scrollable */}
          <Content
            className="p-4 md:p-6 overflow-auto"
            style={{
              height: "calc(100vh - 64px)",
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default AppLayout;
