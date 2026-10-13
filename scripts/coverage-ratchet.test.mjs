import assert from "node:assert/strict";
import test from "node:test";
import { compare } from "./coverage-ratchet.mjs";

const base = { lines: 80, statements: 80, functions: 70, branches: 60 };

test("[X-COV-001] a drop of more than 0.5 points fails", () => {
  assert.equal(compare(base, { ...base, lines: 79.4 }).failures.length, 1);
});
test("[X-COV-001] a drop within 0.5 points passes", () => {
  assert.deepEqual(compare(base, { ...base, lines: 79.6 }).failures, []);
});
test("[X-COV-002] a rise of more than 1 point asks for a baseline update", () => {
  assert.equal(compare(base, { ...base, branches: 61.5 }).improvements.length, 1);
});
