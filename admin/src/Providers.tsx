// src/ThemeWrapper.tsx
import "@ant-design/v5-patch-for-react-19";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, theme } from "antd";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthLoader } from "./components/AuthLoader";
import { MessageProvider } from "./components/MessageProvider";
import useDarkMode from "./hooks/useDarkMode";
import useInitTheme from "./hooks/useInitTheme";
import "./index.css";
import dayjs from "dayjs";

import isBetween from "dayjs/plugin/isBetween";
import { ModalProvider } from "./components/ModalProvider";
dayjs.extend(isBetween);

// Configure QueryClient with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale time - data is considered fresh for 5 minutes
      staleTime: 60 * 60 * 1000, // 5 minutes
      // Cache time - data stays in cache for 10 minutes after becoming unused
      gcTime: 90 * 60 * 1000, // 10 minutes (previously cacheTime)
      // Retry failed requests 1 times with exponential backoff
      retry: 1,
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default (can be overridden per query)
      refetchOnReconnect: false,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
    },
    mutations: {
      // Never auto-retry: mutations create sales, returns, payments and stock
      // movements. A request that failed client-side (timeout, 5xx after
      // commit) may already be saved, and a silent resend would duplicate it.
      retry: 0,
    },
  },
});

const Providers = () => {
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
            <MessageProvider>
              <ModalProvider>
                <AuthLoader />
                <App />
              </ModalProvider>
            </MessageProvider>
          </BrowserRouter>
        </HelmetProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
};

export default Providers;
