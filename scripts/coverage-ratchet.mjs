#!/usr/bin/env node
// Coverage can only move up: fail when a metric drops more than 0.5 points below the committed
// baseline, and ask for a baseline update when it rises by more than 1 point.
// Usage: node scripts/coverage-ratchet.mjs [--update] [--app backend|consumer|admin]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "docs/testing/coverage-baseline.json");
const METRICS = ["lines", "statements", "functions", "branches"];
const DROP = 0.5;
const RISE = 1;

export function compare(baseline, current) {
  const failures = [];
  const improvements = [];
  for (const metric of METRICS) {
    const before = baseline?.[metric];
    const now = current[metric];
    if (before === undefined) continue;
    if (now < before - DROP) failures.push(`${metric}: ${now.toFixed(2)}% is below the baseline ${before.toFixed(2)}%`);
    else if (now > before + RISE) improvements.push(`${metric}: ${now.toFixed(2)}% is above the baseline ${before.toFixed(2)}%`);
  }
  return { failures, improvements };
}

function readSummary(app) {
  const path = join(root, app, "coverage/coverage-summary.json");
  if (!existsSync(path)) throw new Error(`${path} is missing; run the ${app} coverage first`);
  const total = JSON.parse(readFileSync(path, "utf8")).total;
  return Object.fromEntries(METRICS.map((metric) => [metric, total[metric].pct]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const update = args.includes("--update");
  const only = args.includes("--app") ? [args[args.indexOf("--app") + 1]] : ["backend", "consumer", "admin"];
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  let failed = false;
  for (const app of only) {
    const current = readSummary(app);
    if (update) {
      baseline[app] = Object.fromEntries(METRICS.map((metric) => [metric, Number(current[metric].toFixed(2))]));
      console.log(`${app}: baseline set`, baseline[app]);
      continue;
    }
    const { failures, improvements } = compare(baseline[app], current);
    for (const line of failures) console.error(`${app} ${line}`);
    for (const line of improvements) console.log(`${app} ${line}. Run node scripts/coverage-ratchet.mjs --update and commit docs/testing/coverage-baseline.json`);
    if (failures.length) failed = true;
    else console.log(`${app}: coverage holds against the baseline`);
  }
  if (update) writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  process.exit(failed ? 1 : 0);
}
