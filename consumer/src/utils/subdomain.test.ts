import { afterEach, expect, it, vi } from "vitest";
import { isIPv4Host } from "./host.utils";
import { useAuthStore } from "../stores/authStore";
import { getSubdomain } from "./subdomain";
// Same host table as backend BE-SUB-001…008. X1 moves this to shared fixtures.
afterEach(() => vi.unstubAllGlobals());
it.each([
  ["acme.localhost", "acme"],
  ["acme.localhost:3000", "acme"],
  ["ACME.example.com", "acme"],
  ["example.com", null],
  ["localhost", null],
  ["www.example.com", null],
  ["api.example.com", null],
  ["admin.example.com", null],
  ["app.example.com", null],
  ["www.localhost", null],
  [".localhost", null],
  ["a.b.example.com", "a"],
  ["127.0.0.1", null],
  ["127.0.0.1:3000", null],
  ["::1", null],
  ["[::1]:3000", null],
])(
  "[CO-SUBD-001] host %s agrees with backend parsing",
  (hostname, expected) => {
    vi.stubGlobal("window", { location: { hostname } });
    expect(getSubdomain()).toBe(expected);
  },
);

it("[CO-SUBD-002] valid IPv4 hosts bypass auth-store tenant validation too", async () => {
  vi.stubGlobal("window", { location: { hostname: "127.0.0.1" } });
  await useAuthStore.getState().validateSubdomain();
  expect(useAuthStore.getState().subdomainValidation).toMatchObject({
    checked: true,
    exists: true,
    active: true,
    subdomain: null,
  });
  expect(isIPv4Host("255.255.255.255")).toBe(true);
  expect(isIPv4Host("999.0.0.1")).toBe(false);
  expect(isIPv4Host("tenant.example.com")).toBe(false);
});
