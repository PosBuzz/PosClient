import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

export const stackEnv = parse(readFileSync(fileURLToPath(new URL("../.env.e2e", import.meta.url))));
const db = new URL(stackEnv.DATABASE_URL);
if (db.hostname !== "localhost" || db.port !== "55433" || db.pathname !== "/posbuzz_e2e_test") throw new Error("E2E must use its isolated localhost database");
export const API = "http://localhost:8000/api/v1";
export const CONSUMER = "http://consumer1.localhost:3000";
export const ADMIN = "http://localhost:3001";
