// Mirrors consumer/src/test/render.tsx — keep in sync
import "@ant-design/v5-patch-for-react-19";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { ReactElement } from "react";
import { MessageProvider } from "../components/MessageProvider";
import { ModalProvider } from "../components/ModalProvider";
import { useAuthStore } from "../stores/authStore";
import { authUser, type AuthUser } from "./msw/contracts";
import { testQueryClient } from "./query-clients";

export function renderWithProviders(
  ui: ReactElement,
  opts: {
    route?: string;
    path?: string;
    user?: Partial<AuthUser> | null;
    permissions?: string[];
  } = {},
) {
  const user =
    opts.user === null
      ? null
      : {
          ...structuredClone(authUser),
          ...opts.user,
          permissions:
            opts.permissions ?? opts.user?.permissions ?? authUser.permissions,
        };
  useAuthStore.setState({
    user,
    isAuthenticated: user !== null,
    isAuthLoading: false,
  });
  const queryClient = testQueryClient();
  // Same order as Providers.tsx; MemoryRouter replaces BrowserRouter for isolation.
  const result = render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter initialEntries={[opts.route ?? "/"]}>
            <MessageProvider>
              <ModalProvider>
                <Routes>
                  <Route path={opts.path ?? "*"} element={ui} />
                </Routes>
              </ModalProvider>
            </MessageProvider>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>
    </ConfigProvider>,
  );
  return { user: userEvent.setup(), queryClient, ...result };
}
