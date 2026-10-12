import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../test/msw/server";
import { API, ok } from "../test/msw/api";
import { endpoints } from "./endpoints";

// isRefreshing / failedQueue live at module level, so every test gets a fresh copy of both modules
async function load() {
  vi.resetModules();
  const [{ default: client }, { useAuthStore }] = await Promise.all([
    import("./axiosInstance"),
    import("../stores/authStore"),
  ]);
  return { client, store: useAuthStore };
}
const csrfError = () =>
  HttpResponse.json({ message: "invalid csrf token" }, { status: 403 });
const unauthorized = () =>
  HttpResponse.json({ message: "Unauthorized" }, { status: 401 });

describe("axiosInstance", () => {
  const realLocation = window.location;
  beforeEach(() => {
    // The code under test reads window.location.pathname and assigns window.location.href
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/sales",
        href: "http://localhost:3000/sales",
        origin: "http://localhost:3000",
      },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("[CO-API-001] every request carries the stored CSRF token and credentials", async () => {
    const { client, store } = await load();
    store.setState({ csrfToken: "t1" });
    let seen: string | null = null;
    server.use(
      http.post(`${API}/thing`, ({ request }) => {
        seen = request.headers.get("x-csrf-token");
        return ok({ ok: true });
      }),
    );
    await client.post("/thing", {});
    expect(seen).toBe("t1");
    expect(client.defaults.withCredentials).toBe(true);
  });

  it("[CO-API-002] without a token the header is absent", async () => {
    const { client } = await load();
    let seen: string | null = "unset";
    server.use(
      http.get(`${API}/thing`, ({ request }) => {
        seen = request.headers.get("x-csrf-token");
        return ok({});
      }),
    );
    await client.get("/thing");
    expect(seen).toBeNull();
  });

  it("[CO-API-003] a stale CSRF token is replaced once and the request retried once", async () => {
    const { client, store } = await load();
    store.setState({ csrfToken: "stale" });
    let csrfFetches = 0;
    const tokens: Array<string | null> = [];
    server.use(
      http.get(`${API}${endpoints.csrfToken}`, () => {
        csrfFetches++;
        return ok({ csrfToken: "fresh" });
      }),
      http.post(`${API}/thing`, ({ request }) => {
        tokens.push(request.headers.get("x-csrf-token"));
        return request.headers.get("x-csrf-token") === "fresh"
          ? ok({ saved: true })
          : csrfError();
      }),
    );
    const response = await client.post("/thing", {});
    expect(response.data).toEqual({ saved: true });
    expect(csrfFetches).toBe(1);
    expect(tokens).toEqual(["stale", "fresh"]);
    expect(store.getState().csrfToken).toBe("fresh");
  });

  it("[CO-API-004] a 403 with another message is not retried", async () => {
    const { client } = await load();
    let calls = 0;
    server.use(
      http.post(`${API}/thing`, () => {
        calls++;
        return HttpResponse.json(
          { message: "Forbidden resource" },
          { status: 403 },
        );
      }),
    );
    await expect(client.post("/thing", {})).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(calls).toBe(1);
  });

  it("[CO-API-012] a server that keeps rejecting the CSRF token does not make the client loop forever", async () => {
    const { client } = await load();
    let csrfFetches = 0;
    let posts = 0;
    server.use(
      http.get(`${API}${endpoints.csrfToken}`, () => {
        csrfFetches++;
        return ok({ csrfToken: `fresh-${csrfFetches}` });
      }),
      http.post(`${API}/thing`, () => {
        posts++;
        return posts > 20 ? ok({}) : csrfError();
      }),
    );
    await expect(client.post("/thing", {})).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(posts).toBeLessThanOrEqual(2);
    expect(csrfFetches).toBeLessThanOrEqual(1);
  });

  it("[CO-API-005] a 401 refreshes the session once and the request is retried", async () => {
    const { client } = await load();
    let refreshes = 0;
    let calls = 0;
    server.use(
      http.get(`${API}/thing`, () =>
        ++calls === 1 ? unauthorized() : ok({ data: 1 }),
      ),
      http.post(`${API}${endpoints.refreshToken}`, () => {
        refreshes++;
        return ok({});
      }),
    );
    expect((await client.get("/thing")).data).toEqual({ data: 1 });
    expect(refreshes).toBe(1);
  });

  it("[CO-API-006] three parallel 401s share one refresh and all three are retried", async () => {
    const { client } = await load();
    let refreshes = 0;
    const attempts: Record<string, number> = { a: 0, b: 0, c: 0 };
    server.use(
      http.get(`${API}/:name`, ({ params }) => {
        const name = params.name as string;
        return ++attempts[name] === 1 ? unauthorized() : ok({ name });
      }),
      http.post(`${API}${endpoints.refreshToken}`, async () => {
        refreshes++;
        await new Promise((r) => setTimeout(r, 30));
        return ok({});
      }),
    );
    const results = await Promise.all(
      ["a", "b", "c"].map((n) => client.get(`/${n}`)),
    );
    expect(results.map((r) => r.data.name)).toEqual(["a", "b", "c"]);
    expect(refreshes).toBe(1);
    expect(attempts).toEqual({ a: 2, b: 2, c: 2 });
  });

  it("[CO-API-007] a refresh rejected for its CSRF token recovers a new one and retries the refresh", async () => {
    const { client, store } = await load();
    store.setState({ csrfToken: "stale" });
    let refreshAttempts = 0;
    let calls = 0;
    server.use(
      http.get(`${API}/thing`, () =>
        ++calls === 1 ? unauthorized() : ok({ done: true }),
      ),
      http.get(`${API}${endpoints.csrfToken}`, () =>
        ok({ csrfToken: "fresh" }),
      ),
      http.post(`${API}${endpoints.refreshToken}`, ({ request }) => {
        refreshAttempts++;
        return request.headers.get("x-csrf-token") === "fresh"
          ? ok({})
          : csrfError();
      }),
    );
    expect((await client.get("/thing")).data).toEqual({ done: true });
    expect(refreshAttempts).toBe(2);
  });

  it("[CO-API-008] a refresh that fails logs the user out and goes to /login; queued requests reject", async () => {
    const { client, store } = await load();
    store.setState({ isAuthenticated: true, user: { id: 1 } as never });
    server.use(
      http.get(`${API}/:name`, () => unauthorized()),
      http.post(`${API}${endpoints.refreshToken}`, async () => {
        await new Promise((r) => setTimeout(r, 30));
        return unauthorized();
      }),
    );
    const settled = await Promise.allSettled([
      client.get("/a"),
      client.get("/b"),
    ]);
    expect(settled.map((s) => s.status)).toEqual(["rejected", "rejected"]);
    expect(store.getState()).toMatchObject({
      isAuthenticated: false,
      user: null,
    });
    expect(window.location.href).toBe("/login");
  });

  it("[CO-API-009] already on /login, a failed refresh does not redirect again", async () => {
    const { client } = await load();
    window.location.pathname = "/login";
    window.location.href = "http://localhost:3000/login";
    server.use(
      http.get(`${API}/thing`, () => unauthorized()),
      http.post(`${API}${endpoints.refreshToken}`, () => unauthorized()),
    );
    await expect(client.get("/thing")).rejects.toBeDefined();
    expect(window.location.href).toBe("http://localhost:3000/login");
  });

  it("[CO-API-010] a retried request that is 401 again does not refresh a second time", async () => {
    const { client } = await load();
    let refreshes = 0;
    server.use(
      http.get(`${API}/thing`, () => unauthorized()),
      http.post(`${API}${endpoints.refreshToken}`, () => {
        refreshes++;
        return ok({});
      }),
    );
    await expect(client.get("/thing")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refreshes).toBe(1);
  });

  it("[CO-API-011] the refresh lock resets after success and after failure", async () => {
    const { client } = await load();
    let refreshes = 0;
    let phase: "ok" | "fail" = "ok";
    const calls: Record<string, number> = {};
    server.use(
      http.get(`${API}/:name`, ({ params }) => {
        const n = (calls[params.name as string] =
          (calls[params.name as string] ?? 0) + 1);
        return n === 1 ? unauthorized() : ok({ n });
      }),
      http.post(`${API}${endpoints.refreshToken}`, () => {
        refreshes++;
        return phase === "ok" ? ok({}) : unauthorized();
      }),
    );
    await client.get("/first");
    expect(refreshes).toBe(1);
    phase = "fail";
    await expect(client.get("/second")).rejects.toBeDefined();
    expect(refreshes).toBe(2);
    expect(window.location.href).toBe("/login");
    window.location.href = "http://localhost:3000/sales"; // a real navigation would have replaced the page
    phase = "ok";
    await client.get("/third");
    expect(refreshes).toBe(3);
  });

  it("[CO-API-013] a wrong password at login is shown to the user, not turned into a refresh", async () => {
    const { client } = await load();
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
    await expect(
      client.post(endpoints.login, { email: "a", password: "b" }),
    ).rejects.toMatchObject({
      response: { data: { message: "Invalid email or password" } },
    });
    expect(refreshes).toBe(0);
  });
});
