// Mirrors consumer/src/test/smoke-coverage.test.ts — keep in sync
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

function hasPageTest(directory: string): boolean {
  return readdirSync(directory, { withFileTypes: true }).some((entry) =>
    entry.isDirectory()
      ? hasPageTest(resolve(directory, entry.name))
      : entry.name.endsWith(".test.tsx"),
  );
}

it("[AD-SMOKE-COVERAGE-001] every admin page directory except portfolio has a page test", () => {
  const pages = resolve(__dirname, "../pages");
  const missing = readdirSync(pages, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "portfolio")
    .filter((entry) => !hasPageTest(resolve(pages, entry.name)))
    .map((entry) => entry.name);
  expect(
    missing,
    "A new page must add a real render/flow test beside its source",
  ).toEqual([]);
});
