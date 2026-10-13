import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { AuthLoader } from "../../../components/AuthLoader";
import { authUser } from "../../../test/msw/contracts";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[AD-FLOW-LOGIN-001] fetches CSRF, logs in, loads auth and redirects home", async () => {
  const order: string[] = [];
  let loggedIn = false;
  server.use(
    http.get(`${API}${endpoints.csrfToken}`, () => {
      order.push("csrf");
      return ok({ csrfToken: "login-csrf" });
    }),
    http.get(`${API}${endpoints.getMe}`, () => {
      order.push("auth");
      return loggedIn
        ? ok({ user: authUser })
        : new HttpResponse(null, { status: 500 });
    }),
    http.post(`${API}${endpoints.login}`, async ({ request }) => {
      order.push("login");
      expect(request.headers.get("x-csrf-token")).toBe("login-csrf");
      expect(await request.json()).toEqual({
        email: "admin@example.test",
        password: "PosBuzz!234",
      });
      loggedIn = true;
      return ok({});
    }),
  );
  const { user } = renderWithProviders(
    <>
      <AuthLoader />
      <Routes>
        <Route path="/login" element={<Page />} />
        <Route path="/" element={<span>Admin home</span>} />
      </Routes>
    </>,
    { route: "/login", user: null },
  );
  await waitFor(() => expect(order).toContain("auth"));
  await user.type(screen.getByLabelText("Email"), "admin@example.test");
  await user.type(screen.getByLabelText("Password"), "PosBuzz!234");
  await user.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByText("Admin home");
  expect(order).toEqual(["csrf", "auth", "login", "auth"]);
});

it("[AD-FLOW-LOGIN-002] wrong credentials show the server message without refreshing", async () => {
  let refreshes = 0;
  server.use(
    http.post(`${API}${endpoints.login}`, () =>
      HttpResponse.json(
        { message: "Invalid email or password" },
        { status: 401 },
      ),
    ),
    http.post(`${API}${endpoints.refreshToken}`, () => {
      refreshes++;
      return ok({});
    }),
  );
  const { user } = renderWithProviders(<Page />, {
    user: null,
    route: "/login",
  });
  await user.type(screen.getByLabelText("Email"), "admin@example.test");
  await user.type(screen.getByLabelText("Password"), "bad");
  await user.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByText("Invalid email or password");
  expect(refreshes).toBe(0);
  expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
});
