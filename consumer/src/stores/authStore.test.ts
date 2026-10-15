import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../api/endpoints";
import { API, ok } from "../test/msw/api";
import { authUser, fixtures } from "../test/msw/contracts";
import { server } from "../test/msw/server";
import { useAuthStore } from "./authStore";

const realLocation = window.location;
const at = (hostname: string) =>
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hostname,
      pathname: "/",
      href: `http://${hostname}/`,
      origin: `http://${hostname}`,
    },
  });

describe("auth store", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() =>
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    }),
  );
  const state = () => useAuthStore.getState();

  it("[CO-AUTH-001] login posts the credentials and marks the session authenticated", async () => {
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

  it("[CO-AUTH-002] a failed login changes nothing and the error reaches the caller", async () => {
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

  it("[CO-AUTH-003] checkAuth loads the user; a failure leaves the visitor signed out and stops loading", async () => {
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

  it("[CO-AUTH-004] logout posts to the server and clears the user", async () => {
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

  it("[CO-AUTH-005] getCsrfToken stores the token; a missing token or a failure leaves it alone", async () => {
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

  describe("[CO-AUTH-006] validateSubdomain", () => {
    const validation = () => state().subdomainValidation;
    const skipped = {
      checked: true,
      exists: true,
      active: true,
      subdomain: null,
      message: "No subdomain validation required",
    };

    it.each([
      "localhost",
      "127.0.0.1",
      "app.localhost",
      "www.example.com",
      "api.example.com",
      "admin.example.com",
      "example.com",
    ])("host %s needs no tenant check", async (host) => {
      at(host);
      let asked = 0;
      server.use(
        http.get(`${API}${endpoints.validateSubdomain}`, () => {
          asked++;
          return ok({});
        }),
      );
      await state().validateSubdomain();
      expect(validation()).toEqual(skipped);
      expect(asked).toBe(0);
    });

    it.each([
      "acme.localhost",
      "ACME.localhost:3000",
      "acme.example.com",
      "acme.shops.example.com",
    ])("host %s is checked with the server", async (host) => {
      at(host);
      await state().validateSubdomain();
      expect(validation()).toEqual({
        checked: true,
        exists: true,
        active: true,
        subdomain: "testshop",
        message: "Business is active",
      });
    });

    it("an unknown business", async () => {
      at("ghost.example.com");
      server.use(
        http.get(`${API}${endpoints.validateSubdomain}`, () =>
          ok({ exists: false, active: false, message: "Business not found" }),
        ),
      );
      await state().validateSubdomain();
      expect(validation()).toEqual({
        checked: true,
        exists: false,
        active: false,
        subdomain: "ghost",
        message: "Business not found",
      });
    });

    it("an inactive business", async () => {
      at("lapsed.example.com");
      server.use(
        http.get(`${API}${endpoints.validateSubdomain}`, () =>
          ok({
            exists: true,
            active: false,
            subdomain: "lapsed",
            message: "Subscription inactive",
          }),
        ),
      );
      await state().validateSubdomain();
      expect(validation()).toEqual({
        checked: true,
        exists: true,
        active: false,
        subdomain: "lapsed",
        message: "Subscription inactive",
      });
    });

    it("an empty answer is treated as not found", async () => {
      at("odd.example.com");
      server.use(
        http.get(`${API}${endpoints.validateSubdomain}`, () =>
          HttpResponse.json({}),
        ),
      );
      await state().validateSubdomain();
      expect(validation()).toMatchObject({
        checked: true,
        exists: false,
        active: false,
        subdomain: "odd",
      });
    });

    it("a network or server failure is reported, not thrown", async () => {
      at("acme.example.com");
      server.use(
        http.get(`${API}${endpoints.validateSubdomain}`, () =>
          HttpResponse.error(),
        ),
      );
      await expect(state().validateSubdomain()).resolves.toBeUndefined();
      expect(validation()).toEqual({
        checked: true,
        exists: false,
        active: false,
        subdomain: null,
        message: "Error validating subdomain",
      });
    });
  });
});
