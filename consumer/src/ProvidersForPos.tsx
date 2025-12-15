import "@ant-design/v5-patch-for-react-19";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, Layout, theme } from "antd";
import { AuthLoader } from "./components/AuthLoader";
import { MessageProvider } from "./components/MessageProvider";
import { ModalProvider } from "./components/ModalProvider";
import useDarkMode from "./hooks/useDarkMode";
import useInitTheme from "./hooks/useInitTheme";
import "./index.css";

// Configure QueryClient with optimized settings
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Default stale time - data is considered fresh for 5 minutes
			staleTime: 5 * 60 * 1000, // 5 minutes
			// Cache time - data stays in cache for 10 minutes after becoming unused
			gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
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
			// Retry failed mutations once
			retry: 1,
		},
	},
});

const ProvidersForPos = ({ children }: any) => {
	useInitTheme();
	const isDarkMode = useDarkMode();

	return (
		<ConfigProvider
			theme={{
				algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
				token: {
					// Global brand tokens (keep existing background colors)
					colorPrimary: "#111827",
					colorInfo: "#111827",
					borderRadius: 8,
					borderRadiusLG: 10,
					fontFamily:
						'-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
				},
				components: {
					Layout: {
						headerBg: isDarkMode ? "#020617" : "#ffffff",
						bodyBg: isDarkMode ? "#020617" : "#f3f4f6",
					},
					Button: {
						borderRadius: 999,
						controlHeight: 40,
						paddingInline: 18,
						fontWeight: 600,
					},
					Table: {
						headerBg: isDarkMode ? "#020617" : "#f9fafb",
						headerColor: isDarkMode ? "#e5e7eb" : "#4b5563",
						borderColor: isDarkMode ? "#1f2937" : "#e5e7eb",
						rowHoverBg: isDarkMode ? "#020617" : "#f9fafb",
					},
					Input: {
						borderRadius: 8,
					},
					Select: {
						borderRadius: 8,
						controlHeight: 40,
					},
					Radio: {
						colorPrimary: "#111827",
					},
				},
			}}
		>
			<QueryClientProvider client={queryClient}>
				<HelmetProvider>
					<MessageProvider>
						<ModalProvider>
							<AuthLoader />
							<Layout className={`transition-all duration-300`}>
								<Layout.Content
									className="p-4 md:p-6 overflow-auto"
									style={{
										height: "calc(100vh)",
									}}
								>
									{children}
								</Layout.Content>
							</Layout>
						</ModalProvider>
					</MessageProvider>
				</HelmetProvider>
			</QueryClientProvider>
		</ConfigProvider>
	);
};

export default ProvidersForPos;
