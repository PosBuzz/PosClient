#!/usr/bin/env node
// X-ERR-001/002: a catch block that turns errors into a 500 must let intentional 4xx errors through.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(root, "backend/package.json"))("typescript");
const allowlistPath = join(root, "scripts/masked-errors-allowlist.json");
const allowlist = existsSync(allowlistPath) ? JSON.parse(readFileSync(allowlistPath, "utf8")) : [];

const CLIENT_EXCEPTION = /new (?:BadRequest|NotFound|Forbidden|Conflict|Unauthorized)Exception\b/;
const SERVER_ERROR = /INTERNAL_SERVER_ERROR|InternalServerErrorException/;
const PASSTHROUGH = /isClientError\(|instanceof (?:HttpException|\w*Exception)\b/;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".spec.ts") ? [path] : [];
  });
}

export function scanText(text, label) {
  if (!SERVER_ERROR.test(text) || !CLIENT_EXCEPTION.test(text)) return [];
  const found = [];
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isTryStatement(node) && node.catchClause) {
      const tryText = node.tryBlock.getText();
      const catchText = node.catchClause.block.getText();
      if (CLIENT_EXCEPTION.test(tryText) && SERVER_ERROR.test(catchText) && !PASSTHROUGH.test(catchText)) {
        found.push(`${label}:${source.getLineAndCharacterOfPosition(node.catchClause.getStart()).line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

export function findMaskedErrors() {
  return sourceFiles(join(root, "backend/src")).flatMap((file) =>
    scanText(readFileSync(file, "utf8"), relative(root, file)),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = findMaskedErrors();
  const allowed = new Set(allowlist.map((entry) => entry.site));
  const unexpected = violations.filter((site) => !allowed.has(site));
  const stale = allowlist.filter((entry) => !violations.includes(entry.site));
  for (const site of unexpected) console.error(`Masked 4xx: ${site} (catch must start with isClientError passthrough)`);
  for (const entry of stale) console.error(`Stale allowlist entry (site no longer violates): ${entry.site}`);
  if (unexpected.length || stale.length) process.exit(1);
  console.log(`No masked client errors (${allowlist.length} allowlisted).`);
}
