import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

// The command runner reports one opaque test; Stryker cannot discover changed test files.
// Hash all test inputs ourselves, including source dependencies and shared fixtures.
export function mutationFingerprint(root) {
  const hash = createHash("sha256");
  const visit = (path) => {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name));
    } else {
      hash.update(relative(root, path));
      hash.update("\0");
      hash.update(readFileSync(path));
      hash.update("\0");
    }
  };
  for (const input of [
    "src",
    "../contracts",
    "scripts",
    "package.json",
    "package-lock.json",
    "stryker.config.mjs",
    "vitest.config.ts",
    "tsconfig.json",
    "tsconfig.test.json",
  ])
    visit(join(root, input));
  return hash.digest("hex");
}

export function invalidateMutationCache(report, fingerprint) {
  const stamp = `${report}.inputs`;
  const unchanged =
    existsSync(stamp) && readFileSync(stamp, "utf8") === fingerprint;
  if (!unchanged) rmSync(report, { force: true });
  return () => writeFileSync(stamp, fingerprint);
}
