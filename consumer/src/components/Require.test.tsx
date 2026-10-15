import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../stores/authStore";
import RequireAuth from "./RequireAuth";
import RequirePermission from "./RequirePermission";

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from;
  return <div>login from {from?.pathname ?? "nowhere"}</div>;
}

describe("route guards", () => {
  beforeEach(() =>
    useAuthStore.setState({
      isAuthenticated: false,
      isAuthLoading: false,
      user: null,
    }),
  );

  it("[CO-GUARD-001] an anonymous visitor is sent to /login remembering the page they wanted", () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/sales"
            element={
              <RequireAuth>
                <div>secret</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("login from /sales")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  const guarded = (permission?: string | string[]) => (
    <MemoryRouter initialEntries={["/area"]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route
          path="/area"
          element={
            <RequirePermission permission={permission}>
              <div>area</div>
            </RequirePermission>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  it("[CO-GUARD-002] while the user is still loading, a spinner shows and nothing is rendered or redirected", () => {
    const { container } = render(guarded("sales"));
    expect(container.querySelector(".ant-spin")).not.toBeNull();
    expect(screen.queryByText("area")).not.toBeInTheDocument();
    expect(screen.queryByText("home")).not.toBeInTheDocument();
  });

  it("[CO-GUARD-003] a user without a permissions list is redirected home, not crashed", () => {
    useAuthStore.setState({ user: { id: 1 } as never, isAuthenticated: true });
    render(guarded("sales"));
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("[CO-GUARD-004] any one of several permissions is enough, and none redirects", () => {
    useAuthStore.setState({
      user: { id: 1, permissions: ["quotations"] } as never,
      isAuthenticated: true,
    });
    const { unmount } = render(guarded(["sales", "quotations"]));
    expect(screen.getByText("area")).toBeInTheDocument();
    unmount();
    render(guarded(["sales", "users"]));
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("[CO-GUARD-005] no required permission lets any signed-in user in", () => {
    useAuthStore.setState({
      user: { id: 1, permissions: [] } as never,
      isAuthenticated: true,
    });
    render(guarded(undefined));
    expect(screen.getByText("area")).toBeInTheDocument();
  });
});
