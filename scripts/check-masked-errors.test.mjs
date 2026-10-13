import assert from "node:assert/strict";
import test from "node:test";
import { findMaskedErrors, scanText } from "./check-masked-errors.mjs";

const masked = `
async function find() {
  try {
    if (!row) throw new NotFoundException('Vendor not found');
  } catch (error) {
    throw new HttpException('Failed to find vendor', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}`;

test("[X-ERR-001] a catch that turns a 404 into a 500 is reported with its line", () => {
  assert.deepEqual(scanText(masked, "vendor.service.ts"), ["vendor.service.ts:5"]);
});

test("[X-ERR-001] a catch with the isClientError passthrough is accepted", () => {
  const fixed = masked.replace("throw new HttpException", "if (isClientError(error)) throw error;\n    throw new HttpException");
  assert.deepEqual(scanText(fixed, "vendor.service.ts"), []);
});

test("[X-ERR-001] the real backend source has no masked client errors", () => {
  assert.deepEqual(findMaskedErrors(), []);
});
