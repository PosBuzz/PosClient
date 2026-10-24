import {
  BookOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Layout, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import CacheInvalidationButton from "./components/CacheInvalidationButton";
import ThemeDropdown from "./components/ThemeDropdown";
import useDarkMode from "./hooks/useDarkMode";
import SideBar from "./Sidebar";
import { useAuthStore } from "./stores/authStore";

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const navigate = useNavigate();

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
    <Layout className="h-screen max-h-screen overflow-hidden">
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
        {/* Logo Area - Fixed at top, won't scroll away */}
        <div
          style={{
            height: 65,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "0 12px",
            flexShrink: 0,
          }}
        >
          <img
            src="/favicon.ico"
            alt="PosBuzz logo"
            className="h-9 w-9 object-contain"
          />
        </div>

        <div className="sidebar-scroll-container">
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
          <div className="flex items-center min-w-0 gap-2">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
              className="w-16 h-16 text-lg"
            />
            <h2 className="m-0 text-lg hidden md:block truncate">
              Admin Panel
            </h2>
          </div>
          <div className="flex">
            <CacheInvalidationButton />
            <ThemeDropdown />
            <Tooltip title="User Guide (PDF)">
              <Button
                type="text"
                data-testid="user-guide-link"
                icon={<BookOutlined />}
                href="/manual/PosBuzz-Admin-Manual.pdf"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download the Admin Panel Manual"
              />
            </Tooltip>
            <Tooltip title="Account and Security">
              <Button
                type="text"
                icon={<UserOutlined />}
                onClick={() => navigate("/account&security")}
              />
            </Tooltip>
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
