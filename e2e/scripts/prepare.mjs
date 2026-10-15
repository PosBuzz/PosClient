import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";

const e2e = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(e2e, "..");
const env = { ...process.env, ...parse(readFileSync(resolve(e2e, ".env.e2e"))) };
const db = new URL(env.DATABASE_URL);
if (db.hostname !== "localhost" || db.port !== "55433" || db.pathname !== "/posbuzz_e2e_test" || env.NODE_ENV !== "test") throw new Error("Refusing to prepare a non-E2E database");
// A new stack has a fresh throttle; clear only this harness's old reservations and lock.
rmSync(resolve(e2e, '.cache/login-budget.json'), {force: true});
rmSync(resolve(e2e, '.cache/login-budget.json.lock'), {force: true});
const run = (command, args, cwd, extra = {}) => execFileSync(command, args, {cwd, env:{...env,...extra},stdio:"inherit"});
run("docker", ["compose", "-f", "docker-compose.e2e.yml", "up", "-d", "--wait"], root);
for (const app of ["backend", "consumer", "admin"]) {
  const cwd = resolve(root, app);
  if (process.argv.includes("--install")) run("npm", ["ci"], cwd);
  if (app === "backend") {
    run("npx", ["prisma", "generate"], cwd);
    run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], cwd);
    run("npx", ["tsx", "prisma/seed.ts"], cwd);
  }
  run("npm", ["run", "build"], cwd, {VITE_API_BASE_URL:"http://localhost:8000/api/v1"});
}
