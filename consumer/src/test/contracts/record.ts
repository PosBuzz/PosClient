import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "vitest";
import { REQUESTS_DIR } from "./load";

type RequestContract = {
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  /** Path without the /api/v1 prefix, e.g. endpoints.createSale */
  path: string;
  auth: "client" | "admin";
  body: unknown;
  /** Totals the backend must reproduce, as 2-dp strings */
  expect?: Record<string, string>;
};

/**
 * Compares the request a page really sent with contracts/requests/<name>.json.
 * UPDATE_CONTRACTS=1 rewrites the file; the backend replays these files (X-REQ).
 */
export function expectRequestContract(name: string, contract: RequestContract) {
  const file = resolve(REQUESTS_DIR, `${name}.json`);
  const text = `${JSON.stringify(contract, null, 2)}\n`;
  if (process.env.UPDATE_CONTRACTS === "1") {
    mkdirSync(REQUESTS_DIR, { recursive: true });
    writeFileSync(file, text);
    return;
  }
  expect(
    existsSync(file),
    `contracts/requests/${name}.json is missing; run with UPDATE_CONTRACTS=1`,
  ).toBe(true);
  expect(JSON.parse(text)).toEqual(JSON.parse(readFileSync(file, "utf8")));
}

/** Reads a recorded request contract so another screen can be compared against it. */
export function requestContract(name: string): RequestContract {
  return JSON.parse(
    readFileSync(resolve(REQUESTS_DIR, `${name}.json`), "utf8"),
  );
}
