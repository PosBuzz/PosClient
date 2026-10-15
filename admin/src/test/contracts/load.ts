// Mirrors consumer/src/test/contracts/load.ts — keep in sync
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../contracts");

/** A response body the backend's own tests generated (contracts/responses/<name>.json). */
export function responseContract<T = any>(name: string): T {
  return JSON.parse(
    readFileSync(resolve(ROOT, "responses", `${name}.json`), "utf8"),
  );
}
export const REQUESTS_DIR = resolve(ROOT, "requests");
