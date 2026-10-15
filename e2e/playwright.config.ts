import { defineConfig, devices } from "@playwright/test";
import { stackEnv } from "./support/env";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: true,
  timeout: 90000,
  expect: {timeout:15000},
  reporter: [["list"], ["html", {open:"never"}]],
  use: {
    ...devices["Desktop Chrome"],
    trace:"retain-on-failure",video:"retain-on-failure",screenshot:"only-on-failure",
    timezoneId:"Asia/Dhaka",locale:"en-US",
  },
  projects: [{name:"chromium"}],
  webServer: [
    {command:"npm run start:prod --prefix ../backend",url:"http://localhost:8000/api/v1/health",reuseExistingServer:false,timeout:120000,env:stackEnv},
    {command:"npm run preview --prefix ../consumer -- --host 0.0.0.0",url:"http://localhost:3000",reuseExistingServer:false,timeout:120000},
    {command:"npm run preview --prefix ../admin -- --host 0.0.0.0",url:"http://localhost:3001",reuseExistingServer:false,timeout:120000},
  ],
});
