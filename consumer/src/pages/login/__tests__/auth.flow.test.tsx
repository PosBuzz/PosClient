import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { Route, Routes } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { AuthLoader } from "../../../components/AuthLoader";
import RequireAuth from "../../../components/RequireAuth";
import { useAuthStore } from "../../../stores/authStore";
import { responseContract } from "../../../test/contracts/load";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import SubscriptionInactive from "../../SubscriptionInactive";
import Login from "../index";

const location = window.location;
afterEach(() =>
  Object.defineProperty(window, "location", {
    configurable: true,
    value: location,
  }),
);
const app = (
  <>
    <AuthLoader />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/private"
        element={
          <RequireAuth>
            <div>Requested private page</div>
          </RequireAuth>
        }
      />
      <Route path="/" element={<div>Home page</div>} />
      <Route path="/inactive" element={<SubscriptionInactive />} />
      <Route path="/404" element={<div>Unknown business</div>} />
    </Routes>
  </>
);

it("[CO-FLOW-AUTH-001] fetches CSRF, logs in, checks auth and returns to the requested page", async () => {
  let authenticated = false;
  const sequence: string[] = [];
  server.use(
    http.get(`${API}${endpoints.csrfToken}`, () => {
      sequence.push("csrf");
      return ok({ csrfToken: "flow-token" });
    }),
    http.get(`${API}${endpoints.getMe}`, () => {
      sequence.push("checkAuth");
      return authenticated
        ? ok(responseContract("auth-client"))
        : fail(401, "Unauthorized");
    }),
  );
  const login = captureRequests("post", endpoints.login, () => {
    sequence.push("login");
    authenticated = true;
    return ok({});
  });
  const { user } = renderWithProviders(app, { route: "/private", user: null });
  await screen.findByPlaceholderText("Enter your email");
  await waitFor(() => expect(sequence).toContain("checkAuth"));
  await user.type(
    screen.getByPlaceholderText("Enter your email"),
    "admin1@example.test",
  );
  await user.type(
    screen.getByPlaceholderText("Enter your password"),
    "secret-password",
  );
  await user.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByText("Requested private page");
  await waitFor(() => expect(useAuthStore.getState().user?.id).toBe(1));
  expect(login.calls).toHaveLength(1);
  expect(login.calls[0].body).toEqual({
    email: "admin1@example.test",
    password: "secret-password",
  });
  expect(login.calls[0].headers.get("X-CSRF-Token")).toBe("flow-token");
  expect(sequence.indexOf("csrf")).toBeLessThan(sequence.indexOf("login"));
  expect(sequence.slice(sequence.indexOf("login") + 1)).toContain("checkAuth");
});

it("[CO-FLOW-AUTH-002] displays wrong credentials and stays logged out", async () => {
  const login = captureRequests("post", endpoints.login, () =>
    fail(401, "Invalid credentials"),
  );
  const { user } = renderWithProviders(<Login />, { user: null });
  await user.type(
    screen.getByPlaceholderText("Enter your email"),
    "wrong@example.test",
  );
  await user.type(
    screen.getByPlaceholderText("Enter your password"),
    "wrong-password",
  );
  await user.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByText("Invalid credentials");
  expect(login.calls).toHaveLength(1);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
});

it("[CO-FLOW-AUTH-003] routes an inactive tenant to its subscription message and an unknown tenant to 404", async () => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...location,
      hostname: "tenant1.localhost",
      pathname: "/",
      href: "http://tenant1.localhost/",
      origin: "http://tenant1.localhost",
    },
  });
  server.use(
    http.get(`${API}${endpoints.validateSubdomain}`, () =>
      ok({
        exists: true,
        active: false,
        subdomain: "tenant1",
        message: "Subscription expired",
      }),
    ),
  );
  const first = renderWithProviders(app, { route: "/login", user: null });
  await screen.findByText(/Subscription Inactive/);
  first.unmount();
  useAuthStore.setState({
    csrfToken: null,
    subdomainValidation: {
      checked: false,
      exists: false,
      active: false,
      subdomain: null,
      message: null,
    },
  });
  server.use(
    http.get(`${API}${endpoints.validateSubdomain}`, () =>
      ok({ exists: false, active: false, subdomain: "tenant1" }),
    ),
  );
  renderWithProviders(app, { route: "/login", user: null });
  await screen.findByText("Unknown business");
});

it("[CO-ERR-029] a failed login shows the server message and sends no refresh-token request", async () => {
  captureRequests("post", endpoints.login, () =>
    fail(401, "Invalid email or password"),
  );
  const refresh = captureRequests("post", endpoints.refreshToken, { ok: true });
  const { user } = renderWithProviders(<Login />, { user: null });
  await user.type(
    screen.getByPlaceholderText("Enter your email"),
    "x@example.test",
  );
  await user.type(screen.getByPlaceholderText("Enter your password"), "wrong");
  await user.click(screen.getByRole("button", { name: "Login" }));
  expect(
    await screen.findByText("Invalid email or password"),
  ).toBeInTheDocument();
  expect(refresh.calls).toHaveLength(0);
});

it("[CO-ERR-030] an inactive subscription shows its message on the login page", async () => {
  const message =
    "Your subscription is not active. Please renew it or contact support to continue.";
  captureRequests("post", endpoints.login, () => fail(403, message));
  const { user } = renderWithProviders(<Login />, { user: null });
  await user.type(
    screen.getByPlaceholderText("Enter your email"),
    "x@example.test",
  );
  await user.type(screen.getByPlaceholderText("Enter your password"), "secret");
  await user.click(screen.getByRole("button", { name: "Login" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
});
