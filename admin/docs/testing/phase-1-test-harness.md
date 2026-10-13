# Phase A1: Admin Test Harness

**Do exactly what consumer Phase C1 does** (`consumer/docs/testing/phase-1-test-harness.md`), with
these differences:

| C1 step | Admin difference |
|---|---|
| Step 1 install | Same packages, minus `fast-check` (admin has no math worth property-testing). |
| Step 2 `vitest.config.ts` | Same file. `env.VITE_API_BASE_URL` = `"http://api.test"`. **Note:** admin's `endpoints.ts` appends `/api/v1` itself when the base URL lacks it (`baseUrlWithPrefix`), but `axiosInstance` uses the raw base URL. Read `admin/src/api/axiosInstance.ts` to see which base it uses, then set `VITE_API_BASE_URL` to whatever production uses (check `admin/.env*` / Dockerfile build args) and record it in `DECISIONS.md`. AD-HARN-004 pins the resulting request URL. |
| Step 3 tsconfig | Same (`tsconfig.test.json` + exclude tests from app config + reference). |
| Step 4 setup | Same polyfills. Reset `useAuthStore` (admin's own store). |
| Step 5 MSW | `src/test/msw/handlers.ts` defaults: `csrf-token`, `getMe` → contract `auth-admin.json` (add that endpoint to B5 §6's contract list: `GET /auth/admin`), `admin-consumers.json`, `admin-plans.json`. |
| Step 6 render helper | Mirror `admin/src/Providers.tsx`. Same QueryClient test options. |
| Step 7 smoke | IDs `AD-HARN-001…003` mirror CO-HARN-001…003. **AD-HARN-004:** `get(endpoints.plan)` hits exactly `http://api.test/api/v1/admin/plans` (catches base-URL/prefix mistakes). |
| Step 8 CI | Add the `admin-tests` job (copy `consumer-tests`, change the directory). |

Shared code: **do not** create a shared package between consumer and admin for test helpers. The
duplication is small, and a shared workspace would change the build. Copy the helpers and add a
header comment `// Mirrors consumer/src/test/<file> — keep in sync`.

## Exit criteria
- [x] AD-HARN-001…004 green; `npm run build` still works; CI job green on 80112bb (D-052/D-053).
