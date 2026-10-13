import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../api/endpoints";
import { API, ok } from "../test/msw/api";
import { authUser, fixtures } from "../test/msw/contracts";
import { server } from "../test/msw/server";
import { useAuthStore } from "./authStore";

describe("auth store", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  const state = () => useAuthStore.getState();

  it("[AD-AUTH-001] login posts the credentials and marks the session authenticated", async () => {
    let sent: unknown;
    server.use(
      http.post(`${API}${endpoints.login}`, async ({ request }) => {
        sent = await request.json();
        return ok({ message: "Login successful" });
      }),
    );
    await state().login("a@b.test", "secret");
    expect(sent).toEqual({ email: "a@b.test", password: "secret" });
    expect(state().isAuthenticated).toBe(true);
  });

  it("[AD-AUTH-002] a failed login changes nothing and the error reaches the caller", async () => {
    server.use(
      http.post(`${API}${endpoints.login}`, () =>
        HttpResponse.json(
          { message: "Invalid email or password" },
          { status: 401 },
        ),
      ),
    );
    await expect(state().login("a@b.test", "bad")).rejects.toMatchObject({
      response: { data: { message: "Invalid email or password" } },
    });
    expect(state().isAuthenticated).toBe(false);
  });

  it("[AD-AUTH-003] checkAuth loads the user; a failure leaves the visitor signed out and stops loading", async () => {
    const pending = state().checkAuth();
    expect(state().isAuthLoading).toBe(true);
    await pending;
    expect(state()).toMatchObject({
      isAuthenticated: true,
      isAuthLoading: false,
      user: expect.objectContaining({ email: authUser.email }),
    });
    useAuthStore.setState({ user: null, isAuthenticated: false });
    server.use(
      http.get(
        `${API}${endpoints.getMe}`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await state().checkAuth();
    expect(state()).toMatchObject({
      isAuthenticated: false,
      user: null,
      isAuthLoading: false,
    });
  });

  it("[AD-AUTH-004] logout posts to the server and clears the user", async () => {
    let called = 0;
    server.use(
      http.post(`${API}${endpoints.logout}`, () => {
        called++;
        return ok({});
      }),
    );
    useAuthStore.setState({ isAuthenticated: true, user: authUser });
    await state().logout();
    expect(called).toBe(1);
    expect(state()).toMatchObject({ isAuthenticated: false, user: null });
  });

  it("[AD-AUTH-005] getCsrfToken stores the token; a missing token or a failure leaves it alone", async () => {
    await state().getCsrfToken();
    expect(state().csrfToken).toBe(fixtures.csrf.csrfToken);
    useAuthStore.setState({ csrfToken: "keep" });
    server.use(http.get(`${API}${endpoints.csrfToken}`, () => ok({})));
    await state().getCsrfToken();
    expect(state().csrfToken).toBe("keep");
    server.use(
      http.get(
        `${API}${endpoints.csrfToken}`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await expect(state().getCsrfToken()).resolves.toBeUndefined();
    expect(state().csrfToken).toBe("keep");
  });
});
