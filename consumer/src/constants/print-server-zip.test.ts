import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { PRINT_SERVER_DOWNLOAD_URL } from "./printer.constants";

// The app serves its own copy of the installer. It must be the release built
// in PrintingFromWebToPOSPrinter/Distribution, or shops would download a stale one.
const served = resolve(
  __dirname,
  "../../public",
  PRINT_SERVER_DOWNLOAD_URL.slice(1),
);
const release = resolve(
  __dirname,
  "../../../PrintingFromWebToPOSPrinter/Distribution/PosBuzz-Print-Server.zip",
);

it("[CO-PSDL-002] the downloadable zip is the current print server release", () => {
  expect(existsSync(served)).toBe(true);
  expect(existsSync(release)).toBe(true);
  expect(readFileSync(served).equals(readFileSync(release))).toBe(true);
  // a zip, and without a developer's settings file inside
  expect(readFileSync(served).subarray(0, 2).toString()).toBe("PK");
  expect(readFileSync(served).includes("store-config.txt")).toBe(false);
});
