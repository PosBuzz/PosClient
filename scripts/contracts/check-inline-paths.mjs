// X-ENDP-003: API paths must live in endpoints.ts. Any other literal that looks like an API path
// must be listed (with a reason) in scripts/contracts/allowed-inline-paths.json.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PREFIXES = ["/consumer/", "/admin/", "/auth/", "/public/", "/receipt-settings", "/ai/"];
const allowedFile = resolve(root, "scripts/contracts/allowed-inline-paths.json");
const allowed = existsSync(allowedFile) ? JSON.parse(readFileSync(allowedFile, "utf8")) : [];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const literal = /(['"`])(\/(?:consumer|admin|auth|public|ai)\/[^'"`\s]*|\/receipt-settings[^'"`\s]*)\1/g;
const hits = [];
for (const app of ["consumer", "admin"]) {
  for (const file of walk(resolve(root, app, "src"))) {
    if (!/\.(ts|tsx)$/.test(file) || /\.test\.|__contracts__|\/test\//.test(file)) continue;
    if (/\/endpoints\.ts$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    text.split("\n").forEach((line, index) => {
      for (const m of line.matchAll(literal)) {
        if (!PREFIXES.some((p) => m[2].startsWith(p))) continue;
        hits.push({ file: relative(root, file), line: index + 1, value: m[2] });
      }
    });
  }
}
const unlisted = hits.filter(
  (h) => !allowed.some((a) => a.file === h.file && a.value === h.value),
);
const stale = allowed.filter(
  (a) => !hits.some((h) => h.file === a.file && h.value === a.value),
);
unlisted.forEach((h) => console.error(`X-ENDP-003 FAIL ${h.file}:${h.line} hardcoded API path ${h.value}`));
stale.forEach((a) => console.error(`X-ENDP-003 FAIL stale allowlist entry ${a.file} ${a.value}`));
if (unlisted.length || stale.length) process.exit(1);
console.log(`X-ENDP-003 ok (${hits.length} allowed inline paths)`);
