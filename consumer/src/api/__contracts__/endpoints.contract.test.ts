import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { endpoints } from "../endpoints";

type Route = { method: string; path: string; guards: string[] };
const routes: Route[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../contracts/routes.json"), "utf8"),
);

const resolved: Array<{ name: string; path: string }> = Object.entries(
  endpoints,
).map(([name, value]) => {
  const raw =
    typeof value === "function"
      ? (value as (...a: unknown[]) => string)(1, 1)
      : value;
  return { name, path: String(raw).split("?")[0] };
});

const toRegex = (template: string) =>
  new RegExp(`^${template.replace(/:\w+/g, "[^/]+")}$`);
const matches = (path: string) =>
  routes.filter((route) => toRegex(route.path).test(`/api/v1${path}`));

// Endpoints the app defines that the backend does not serve (dead code), with the reason.
const NOT_SERVED: Record<string, string> = {};

describe("consumer endpoints against the backend route manifest", () => {
  it("[X-ENDP-001] every endpoint the app can call exists on the backend", () => {
    const missing = resolved
      .filter(
        ({ name, path }) => !(name in NOT_SERVED) && matches(path).length === 0,
      )
      .map(({ name, path }) => `${name} -> ${path}`);
    expect(missing).toEqual([]);
  });

  it("[X-ENDP-001] the not-served list has no stale entries", () => {
    const names = new Set(resolved.map((r) => r.name));
    expect(Object.keys(NOT_SERVED).filter((n) => !names.has(n))).toEqual([]);
    expect(
      resolved
        .filter(
          ({ name, path }) => name in NOT_SERVED && matches(path).length > 0,
        )
        .map((r) => r.name),
    ).toEqual([]);
  });
});
