import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
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
        "src/utils/calculate-totals.utils.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/utils/sale-item.utils.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/utils/promotion-validation.ts": {
          lines: 100,
          branches: 95,
          functions: 100,
          statements: 100,
        },
        "src/utils/promotion-helpers.utils.ts": { lines: 95, branches: 90 },
        "src/utils/formatters.ts": { lines: 100, branches: 100 },
      },
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/swUpdate.ts",
      ],
      reporter: ["text-summary", "html", "json-summary", "json"],
    },
  },
});
