import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("[X-TYPE-002] admin type-check literals match the backend response files", () => {
  expect(() =>
    execFileSync(
      process.execPath,
      [
        resolve(
          __dirname,
          "../../../scripts/contracts/generate-response-types.mjs",
        ),
        "--check",
        "--app",
        "admin",
      ],
      { stdio: "pipe" },
    ),
  ).not.toThrow();
});
