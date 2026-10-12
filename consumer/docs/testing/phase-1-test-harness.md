# Phase C1: Consumer Test Harness

**Goal:** `npm test` runs Vitest in jsdom with Testing Library, MSW intercepting all HTTP, antd
rendering without crashing, and a `renderWithProviders` helper mirroring `src/Providers.tsx`.

**Depends on:** P0.

**Status (2026-10-13): complete; all 20 GitHub CI jobs passed.**

---

## Step 1: Install
```bash
cd consumer
npm i -D vitest@^5 @vitest/coverage-v8@^5 jsdom@^30 \
  @testing-library/react@^16 @testing-library/dom@^10 @testing-library/user-event@^14 @testing-library/jest-dom@^7 \
  msw@^2 fast-check@^4
```
Version check 2026-10-13: vitest 5.0.4 peer `vite ^6.4.0 || ^7 || ^8` (installed vite is 6.4.3 ); MSW 2.15.0
exports `http`, `HttpResponse`, `delay` from `msw` and `setupServer` from `msw/node`;
jest-dom 7 has the `@testing-library/jest-dom/vitest` entry. **If npm reports a peer conflict for vite**:
bump `vite` in package.json to `^6.4.0` (it is already resolved at 6.4.3 in the lockfile). If that
still fails, use `vitest@^3.2` + `@vitest/coverage-v8@^3.2` (FALLBACK, log it).

## Step 2: `vitest.config.ts` (separate from `vite.config.ts`)
Do **not** `mergeConfig` with `vite.config.ts`. `VitePWA` and the tailwind plugin are not wanted
in tests.
```ts
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
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx", "src/vite-env.d.ts", "src/swUpdate.ts"],
      reporter: ["text-summary", "html", "json-summary"],
    },
  },
});
```
Scripts:
```json
"test": "TZ=UTC vitest run",
"test:watch": "TZ=UTC vitest",
"test:cov": "TZ=UTC vitest run --coverage"
```

## Step 3: TypeScript for tests
1. `tsconfig.app.json`: add `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"]`.
2. Create `tsconfig.test.json`:
   ```json
   {
     "extends": "./tsconfig.app.json",
     "compilerOptions": {
       "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.test.tsbuildinfo",
       "types": ["vitest/globals", "@testing-library/jest-dom/vitest"],
       "noUnusedLocals": true
     },
     "include": ["src"],
     "exclude": []
   }
   ```
3. `tsconfig.json` `references`: add `{ "path": "./tsconfig.test.json" }`. Now `tsc -b` (the
   `typecheck` script and `build`) typechecks tests too.
   - If `vite build` breaks because `tsc -b` now builds test files with errors, fix the test
     files. Don't remove the reference.

## Step 4: `src/test/setup.ts`
```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";
import { useAuthStore } from "../stores/authStore";

// antd needs these in jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }),
});
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver = RO;
const realGCS = window.getComputedStyle;
window.getComputedStyle = (elt: Element) => realGCS(elt); // drop pseudo-element arg (jsdom "Not implemented")
window.scrollTo = () => {};
HTMLCanvasElement.prototype.getContext = () => null as any; // recharts / barcode

const initialAuth = useAuthStore.getState();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  useAuthStore.setState(initialAuth, true);
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => server.close());
```
`onUnhandledRequest: "error"` is deliberate: any request the test didn't plan for fails the test,
so new API calls can't slip in unnoticed.

**If antd still crashes** in jsdom on an API not listed (the error names it), stub that API here
and log it. If several unrelated jsdom gaps appear, try `environment: "happy-dom"` (install
`happy-dom`) as the FALLBACK in DECISION-PLAYBOOK §3.

## Step 5: MSW
```
src/test/msw/
  server.ts        // export const server = setupServer(...defaultHandlers)
  handlers.ts      // defaultHandlers: csrf-token, getMe (authenticated admin user with all permissions), validateSubdomain
  api.ts           // export const API = "http://api.test/api/v1"; helpers: ok(body), fail(status, message)
  contracts.ts     // loads ../../../../contracts/responses/*.json (from B5) → typed fixtures (C4)
```
Handler pattern:
```ts
http.get(`${API}/auth/client`, () => HttpResponse.json(fixtures.authClient))
```
Use the paths from `src/api/endpoints.ts`. **Never hardcode a path string in a test.** Import
`endpoints` so a renamed endpoint breaks the handler at compile time.

`contracts.ts` imports JSON from the repo-root `contracts/` folder. Vite's JSON import supports
paths outside the project root in Vitest. If it doesn't, add
`server: { fs: { allow: [".."] } }` to `vitest.config.ts` `test` options, or read with
`fs.readFileSync` (tests run in Node). Until B5 lands, `contracts.ts` exports hand-written
fixtures marked `// TEMP until B5 contracts/responses exists`. C4 replaces them.

## Step 6: `src/test/render.tsx`
```tsx
export function renderWithProviders(ui: React.ReactElement, opts?: {
  route?: string;                // initial URL, default "/"
  path?: string;                 // route pattern to mount ui under, e.g. "/sales/view/:id"
  user?: Partial<AuthUser> | null; // sets useAuthStore {isAuthenticated, isAuthLoading:false, user}
  permissions?: string[];        // shorthand for user.permissions
}) { ... }
```
It wraps with: outer `ConfigProvider`, then `QueryClientProvider` (a **new** `QueryClient` per test with
`{ queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } }`), `HelmetProvider`, `MemoryRouter` + `Routes`/`Route`, `MessageProvider`, `ModalProvider` (same order as
`src/Providers.tsx`; read that file and mirror it). Return `{ user: userEvent.setup(), queryClient, ...renderResult }`.

> Note: the test QueryClient disables mutation retries, so it does **not** reproduce the
> production default. C3's CO-API-020 imports the real `queryClient` options to pin it (KI-010 regression guard).
> To make it importable, the seam is allowed: export the QueryClient options object from
> `Providers.tsx` (`export const queryClientOptions = {...}`) without changing values.

## Step 7: Smoke tests
| ID | Test |
|---|---|
| CO-HARN-001 | `src/test/harness.test.tsx`: renders an antd `Button`, `Select`, `Modal` (open), `Table` and `DatePicker` with `renderWithProviders`, no console errors (spy `console.error`, expect not called) |
| CO-HARN-002 | An unmocked request (`axiosInstance.get('/nope')`) makes the test fail (assert via `expect(...).rejects`, and confirm MSW logs the error) |
| CO-HARN-003 | `useAuthStore` state is reset between tests (set in test A, read in test B) |
| CO-HARN-004 | `import.meta.env.VITE_API_BASE_URL === "http://api.test/api/v1"` |

## Step 8: CI job
```yaml
  consumer-tests:
    name: Consumer tests
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: consumer } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm, cache-dependency-path: consumer/package-lock.json }
      - run: npm ci
      - run: npm run test:cov
```

## Exit criteria
- [x] CO-HARN-001…006 green 3× in a row; build succeeds; typecheck covers test files.
- [x] Consumer CI job is green on implementation `634c2ee`: [CI run 38301291165](https://github.com/PosBuzz/PosClient/actions/runs/38301291165) passed all 20 jobs.


## Implementation and verification (2026-10-13)
- Installed Vitest/coverage 5.0.4, jsdom 30.1.2, Testing Library and fast-check 4.10.2. MSW 3.0.3 requires TypeScript >=5.9, so use the documented MSW 2 fallback (2.15.0 supports the existing TypeScript 5.7). No forced peer resolution or compiler upgrade.
- Vitest 5 uses suite options `{ concurrent: false }` rather than `describe.sequential`; the auth reset checks remain ordered. All test files and Vitest config are typechecked; noUnusedLocals/noUnusedParameters remain enabled.
- The helper follows the real provider order: ConfigProvider → QueryClientProvider → HelmetProvider → MemoryRouter → MessageProvider → ModalProvider. It disables motion in tests because jsdom doesn't finish CSS animations; visibility assertions and real control interaction remain intact. No production provider behavior changes. QueryClient option extraction remains a permitted C3 seam, not needed for C1.
- Cleanup resets auth/message/modal stores, clears every owned QueryClient and browser storage, unmounts React trees, and resets handlers. Unknown MSW requests fail instead of reaching real services. Default handlers use endpoint constants and temporary typed auth/CSRF/subdomain fixtures; B5/C4 replace fixtures with contracts.
- Seven tests cover CO-HARN-001…006 (003 has paired reset checks); all pass three times with coverage reporting. Consumer build and test-aware typecheck pass; full dependency audit is zero. Fresh npm ci preserves the lockfile hash and passes test:cov; all-app typechecks pass. Generated coverage assets are excluded from lint, preserving all source rules.
- Added consumer-tests CI with immutable lockfile verification and test:cov; root test:all includes consumer tests. Coverage floors begin in C2.
