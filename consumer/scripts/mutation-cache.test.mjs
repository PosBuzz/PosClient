import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  mutationFingerprint,
  invalidateMutationCache,
} from "./mutation-cache.mjs";

test("[CO-MUT-001] changed tests, dependencies and shared fixtures invalidate opaque command-runner results", () => {
  const parent = mkdtempSync(join(tmpdir(), "posbuzz-mutation-cache-"));
  const root = join(parent, "consumer");
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(parent, "contracts"));
  const inputs = [
    join(root, "src/math.test.ts"),
    join(root, "src/helper.ts"),
    join(parent, "contracts/totals.json"),
    join(root, "package-lock.json"),
  ];
  const report = join(root, "report.json");
  try {
    for (const input of inputs) writeFileSync(input, "original");
    let fingerprint = mutationFingerprint(root);
    writeFileSync(report, "cached");
    invalidateMutationCache(report, fingerprint)();
    assert.equal(existsSync(report), false); // No fingerprint means no trusted result.
    writeFileSync(report, "cached");
    invalidateMutationCache(report, fingerprint)();
    assert.equal(existsSync(report), true);
    for (const input of inputs) {
      writeFileSync(input, "changed");
      const next = mutationFingerprint(root);
      assert.notEqual(next, fingerprint);
      invalidateMutationCache(report, next)();
      assert.equal(existsSync(report), false);
      writeFileSync(report, "cached");
      fingerprint = next;
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
