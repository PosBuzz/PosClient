import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Button, Layout, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import CacheInvalidationButton from "./components/CacheInvalidationButton";
import ThemeDropdown from "./components/ThemeDropdown";
import useDarkMode from "./hooks/useDarkMode";
import SideBar from "./Sidebar";
import { useAuthStore } from "./stores/authStore";

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const { logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isDarkMode = useDarkMode();

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
    <Layout className="max-h-screen">
      {/* Sidebar - Fixed position */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="md"
        theme={isDarkMode ? "dark" : "light"}
        className={`h-screen fixed left-0 top-0 bottom-0 flex flex-col ${
          isMobile && !collapsed ? "z-50 shadow-lg!" : ""
        }`}
        style={{
          zIndex: 999,
          display: isMobile && collapsed ? "none" : "block",
        }}
      >
        <div className="flex h-[65px] shrink-0 items-center justify-center px-3">
          <img
            src="/favicon.ico"
            alt="PosBuzz logo"
            className="h-9 w-9 object-contain"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <SideBar />
        </div>
        <div className="shrink-0 px-3 py-3 text-center text-xs opacity-70 truncate select-none border-t border-white/5">
          {collapsed ? "PB" : "Powered by PosBuzz"}
        </div>
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
            <h2 className="m-0 text-lg hidden md:block">Admin Panel</h2>
          </div>
          <div className="flex">
            <CacheInvalidationButton />
            <ThemeDropdown />
            <Tooltip title="Logout">
              <Button type="text" icon={<LogoutOutlined />} onClick={logout} />
            </Tooltip>
          </div>
        </Header>

        {/* Overlay for mobile when sidebar is open */}
        {isMobile && !collapsed && (
          <div
            className={`fixed inset-0 ${
              isDarkMode ? "bg-black" : "bg-gray-100"
            } bg-opacity-50 z-40`}
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
  );
};

export default AppLayout;
