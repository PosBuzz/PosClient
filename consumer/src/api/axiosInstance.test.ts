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
  it("[CO-API-020] the refresh request itself carries the stored CSRF token, or none", async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.post(`${API}${endpoints.refreshToken}`, ({ request }) => {
        seen.push(request.headers.get("x-csrf-token"));
        return ok({});
      }),
    );
    for (const token of ["t9", null]) {
      const { client, store } = await load();
      store.setState({ csrfToken: token });
      let calls = 0;
      server.use(
        http.get(`${API}/thing`, () =>
          ++calls === 1 ? unauthorized() : ok({}),
        ),
      );
      await client.get("/thing");
    }
    expect(seen).toEqual(["t9", null]);
  });

  it("[CO-API-021] a failed refresh rejects queued requests without retrying them", async () => {
    const { client } = await load();
    const hits: Record<string, number> = { a: 0, b: 0 };
    server.use(
      http.get(`${API}/:name`, ({ params }) => {
        hits[params.name as string]++;
        return unauthorized();
      }),
      http.post(`${API}${endpoints.refreshToken}`, async () => {
        await new Promise((r) => setTimeout(r, 30));
        return HttpResponse.json({ message: "expired" }, { status: 401 });
      }),
    );
    const results = await Promise.allSettled([
      client.get("/a"),
      client.get("/b"),
    ]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    for (const result of results) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: { response: { data: { message: "expired" } } },
      });
    }
    expect(hits).toEqual({ a: 1, b: 1 });
  });

  it("[CO-API-022] a queued request that is refused again does not start another refresh", async () => {
    const { client } = await load();
    let refreshes = 0;
    server.use(
      http.get(`${API}/:name`, () => unauthorized()),
      http.post(`${API}${endpoints.refreshToken}`, async () => {
        refreshes++;
        await new Promise((r) => setTimeout(r, 30));
        return ok({});
      }),
    );
    const results = await Promise.allSettled(
      ["a", "b", "c"].map((n) => client.get(`/${n}`)),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshes).toBe(1);
  });

  it("[CO-API-023] a queued request is retried with the CSRF token rotated during the refresh", async () => {
    const { client, store } = await load();
    store.setState({ csrfToken: "old" });
    const retried: Array<string | null> = [];
    const attempts: Record<string, number> = { a: 0, b: 0 };
    server.use(
      http.get(`${API}/:name`, ({ params, request }) => {
        const name = params.name as string;
        if (++attempts[name] === 1) return unauthorized();
        retried.push(request.headers.get("x-csrf-token"));
        return ok({});
      }),
      http.post(`${API}${endpoints.refreshToken}`, async () => {
        await new Promise((r) => setTimeout(r, 30));
        store.setState({ csrfToken: "rotated" });
        return ok({});
      }),
    );
    await Promise.all([client.get("/a"), client.get("/b")]);
    expect(retried).toEqual(["rotated", "rotated"]);
  });

  it("[CO-API-024] a network failure or an empty error body is passed on, not turned into a TypeError", async () => {
    const { client } = await load();
    server.use(
      http.get(`${API}/down`, () => HttpResponse.error()),
      http.get(`${API}/nullbody`, () =>
        HttpResponse.json(null, { status: 403 }),
      ),
    );
    await expect(client.get("/down")).rejects.toMatchObject({
      code: "ERR_NETWORK",
    });
    await expect(client.get("/nullbody")).rejects.toMatchObject({
      response: { status: 403 },
    });
  });

  it("[CO-API-025] only a 403 with the CSRF message is retried", async () => {
    const { client } = await load();
    let calls = 0;
    server.use(
      http.get(`${API}/odd`, () => {
        calls++;
        return HttpResponse.json(
          { message: "invalid csrf token" },
          { status: 400 },
        );
      }),
    );
    await expect(client.get("/odd")).rejects.toMatchObject({
      response: { status: 400 },
    });
    expect(calls).toBe(1);
  });

  it("[CO-API-026] a CSRF endpoint that gives no token ends the retry with the original error", async () => {
    const { client } = await load();
    let calls = 0;
    server.use(
      http.get(`${API}/thing`, () => {
        calls++;
        return csrfError();
      }),
      http.get(`${API}${endpoints.csrfToken}`, () => HttpResponse.json(null)),
    );
    await expect(client.get("/thing")).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(calls).toBe(1);
  });

  it("[CO-API-027] a failing CSRF endpoint rejects with its own error", async () => {
    const { client } = await load();
    server.use(
      http.get(`${API}/thing`, () => csrfError()),
      http.get(`${API}${endpoints.csrfToken}`, () =>
        HttpResponse.json({ message: "down" }, { status: 500 }),
      ),
    );
    await expect(client.get("/thing")).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("[CO-API-028] a refresh whose CSRF recovery gives no token fails with the refresh error", async () => {
    const { client } = await load();
    let refreshes = 0;
    server.use(
      http.get(`${API}/thing`, () => unauthorized()),
      http.post(`${API}${endpoints.refreshToken}`, () => {
        refreshes++;
        return csrfError();
      }),
      http.get(`${API}${endpoints.csrfToken}`, () => HttpResponse.json({})),
    );
    await expect(client.get("/thing")).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(refreshes).toBe(1);
  });

  it("[CO-API-029] the retried request sends the new token in the x-csrf-token header", async () => {
    const { client, store } = await load();
    store.setState({ csrfToken: "stale" });
    const seen: Array<string | null> = [];
    server.use(
      http.get(`${API}/thing`, ({ request }) => {
        seen.push(request.headers.get("x-csrf-token"));
        return seen.length === 1 ? csrfError() : ok({});
      }),
      http.get(`${API}${endpoints.csrfToken}`, () =>
        ok({ csrfToken: "fresh" }),
      ),
    );
    await client.get("/thing");
    expect(seen).toEqual(["stale", "fresh"]);
  });

  it("[CO-API-030] adapter sees credentials on both clients and custom headers survive CSRF recovery", async () => {
    vi.resetModules();
    const { default: axios, AxiosError } = await import("axios");
    const instances: ReturnType<typeof axios.create>[] = [];
    const create = axios.create.bind(axios);
    const spy = vi.spyOn(axios, "create").mockImplementation((config) => {
      const instance = create(config);
      instances.push(instance);
      return instance;
    });
    try {
      const [{ default: client }, { useAuthStore: store }] = await Promise.all([
        import("./axiosInstance"),
        import("../stores/authStore"),
      ]);
      expect(instances).toHaveLength(2);
      store.setState({ csrfToken: "stale" });
      // A public interceptor can observe an auth-state change before the built-in injector.
      // Recovery must preserve the explicit fresh header already attached to this retry.
      client.interceptors.request.use((config) => {
        if (
          (config as typeof config & { _csrfRetried?: boolean })._csrfRetried
        ) {
          store.setState({ csrfToken: null });
        }
        return config;
      });
      let attempts = 0;
      const seen: Record<string, unknown>[] = [];
      client.defaults.adapter = async (config) => {
        expect(config.withCredentials).toBe(true);
        seen.push(config.headers.toJSON());
        const response = {
          config,
          status: attempts++ === 0 ? 403 : 200,
          statusText: "",
          headers: {},
          data: { message: "invalid csrf token" },
        };
        if (response.status === 403) {
          throw new AxiosError(
            "csrf",
            "ERR_BAD_REQUEST",
            config,
            undefined,
            response,
          );
        }
        return response;
      };
      instances[1].defaults.adapter = async (config) => {
        expect(config.withCredentials).toBe(true);
        return {
          config,
          status: 200,
          statusText: "OK",
          headers: {},
          data: { csrfToken: "fresh" },
        };
      };
      await client.post(
        "/thing",
        {},
        { headers: { "X-Correlation-ID": "request-1" } },
      );
      expect(seen).toHaveLength(2);
      expect(seen[1]).toMatchObject({
        "X-Correlation-ID": "request-1",
        "X-CSRF-TOKEN": "fresh",
      });
      expect(Object.keys(seen[1])).not.toContain("");
    } finally {
      spy.mockRestore();
    }
  });

  it("[CO-API-031] queued retries preserve the token attached at recovery even if auth state changes before injection", async () => {
    for (const refreshedToken of ["fresh", null]) {
      vi.resetModules();
      const { default: axios, AxiosError } = await import("axios");
      const instances: ReturnType<typeof axios.create>[] = [];
      const create = axios.create.bind(axios);
      const spy = vi.spyOn(axios, "create").mockImplementation((config) => {
        const instance = create(config);
        instances.push(instance);
        return instance;
      });
      try {
        const [{ default: client }, { useAuthStore: store }] =
          await Promise.all([
            import("./axiosInstance"),
            import("../stores/authStore"),
          ]);
        store.setState({ csrfToken: "old" });
        client.interceptors.request.use((config) => {
          if (
            config.url === "/b" &&
            (config as typeof config & { _retry?: boolean })._retry &&
            refreshedToken
          ) {
            store.setState({ csrfToken: null });
          }
          return config;
        });
        const retried: Record<string, unknown> = {};
        client.defaults.adapter = async (config) => {
          const response = {
            config,
            status: 200,
            statusText: "OK",
            headers: {},
            data: { name: config.url },
          };
          if (!(config as typeof config & { _retry?: boolean })._retry) {
            throw new AxiosError(
              "expired",
              "ERR_BAD_REQUEST",
              config,
              undefined,
              { ...response, status: 401 },
            );
          }
          retried[config.url!] = config.headers.get("X-CSRF-TOKEN");
          return response;
        };
        let refreshes = 0;
        instances[1].defaults.adapter = async (config) => {
          refreshes++;
          await new Promise((resolve) => setTimeout(resolve, 30));
          store.setState({ csrfToken: refreshedToken });
          return {
            config,
            status: 200,
            statusText: "OK",
            headers: {},
            data: {},
          };
        };
        expect(
          (await Promise.all([client.get("/a"), client.get("/b")])).map(
            (result) => result.data.name,
          ),
        ).toEqual(["/a", "/b"]);
        expect(refreshes).toBe(1);
        expect(retried["/b"]).toBe(refreshedToken ?? "old");
      } finally {
        spy.mockRestore();
      }
    }
  });
});
