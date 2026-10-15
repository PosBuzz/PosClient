import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
// Dates in tests are written in UTC; pin it so bare `vitest` matches `npm test`
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    maxWorkers: 1,
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
    env: { VITE_API_BASE_URL: "http://api.test/api/v1" },
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 50,
        "src/api/**": { lines: 90 },
        "src/stores/**": { lines: 90 },
        "src/pages/**": { lines: 50 },
      },
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      reporter: ["text-summary", "html", "json-summary"],
    },
  },
});
