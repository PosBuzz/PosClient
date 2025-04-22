// src/ThemeWrapper.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, theme } from "antd";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { AntdMessageProvider } from "./contexts/MessageContext";
import useDarkMode from "./hooks/useDarkMode";
import "@ant-design/v5-patch-for-react-19";
import "./index.css";
import useInitTheme from "./hooks/useInitTheme";

const queryClient = new QueryClient();

const Provider = () => {
  useInitTheme();
  const isDarkMode = useDarkMode();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        components: {
          Layout: {
            //   siderBg: isDarkMode ? "#001529" : "#fff",
            headerBg: isDarkMode ? "#001529" : "#fff",
          },
          // Menu: {
          //   itemBg: isDarkMode ? "#001529" : "#fff",
          //   itemHoverColor: "#1677ff",
          //   itemSelectedColor: isDarkMode ? "#fff" : "#1677ff",
          //   itemSelectedBg: isDarkMode ? "#1677ff" : "rgba(0, 0, 0, 0.04)",
          // },
          // Message: {
          //   colorText: isDarkMode ? "#fff" : "#000",
          //   contentBg: isDarkMode ? "#1F1F1F" : "#fff",
          //   colorBgElevated: isDarkMode ? "#1F1F1F" : "#fff",
          // },
          // Notification: {
          //   colorText: isDarkMode ? "#fff" : "#000",
          //   colorBgElevated: isDarkMode ? "#1F1F1F" : "#fff",
          // },
          // Modal: {
          //   headerBg: isDarkMode ? "#1F1F1F" : "#fff",
          //   contentBg: isDarkMode ? "#1F1F1F" : "#fff",
          //   titleColor: isDarkMode ? "#fff" : "#000",
          // },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <BrowserRouter>
            <AntdMessageProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </AntdMessageProvider>
          </BrowserRouter>
        </HelmetProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
};

export default Provider;
