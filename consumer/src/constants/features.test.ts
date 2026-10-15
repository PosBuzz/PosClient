import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("[CO-FEAT-001] bulk import is hidden unless the build sets VITE_IMPORT_ENABLED=true", async () => {
  vi.stubEnv("VITE_IMPORT_ENABLED", "");
  vi.resetModules();
  expect((await import("./features")).IMPORT_ENABLED).toBe(false);

  vi.stubEnv("VITE_IMPORT_ENABLED", "true");
  vi.resetModules();
  expect((await import("./features")).IMPORT_ENABLED).toBe(true);
});
