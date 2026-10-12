# Phase C3: Consumer API Layer, Auth Store, Route Guards, Hooks

**Goal:** the plumbing every screen depends on (HTTP client, CSRF/refresh recovery, auth state,
permission gating, cache invalidation, data hooks) is pinned, so a change there fails tests instead
of logging users out, double-submitting, or showing stale numbers.

**Depends on:** C1. **Location:** next to source as `*.test.ts(x)`.

---

## 1. `src/api/axiosInstance.ts` (`axiosInstance.test.ts`)
Use MSW handlers that **count calls** (closure counters) and assert request headers through
`request.headers.get("x-csrf-token")`. For `window.location` redirects, use
`vi.stubGlobal("location", { ...window.location, pathname: "/sales", href: "" })` and assert `href`.

| ID | Scenario | Assert |
|---|---|---|
| CO-API-001 | store has csrfToken `"t1"` | every request carries `X-CSRF-TOKEN: t1`; requests are sent with credentials (`withCredentials` on the instance) |
| CO-API-002 | no csrfToken | header absent |
| CO-API-003 | POST → 403 `{message:"invalid csrf token"}` once, then 200 | csrf-token endpoint called once; store updated; original request retried **once** with the new token; caller gets 200 |
| CO-API-004 | 403 with a **different** message | not retried; rejects |
| CO-API-005 | GET → 401, refresh → 200, retry → 200 | refresh called once; caller gets data |
| CO-API-006 | **3 parallel** requests all → 401 | refresh called **exactly once**; all 3 retried and resolved (queue) |
| CO-API-007 | refresh → 403 invalid csrf, then csrf-token → new token, refresh retried → 200 | `refreshAccessTokenWithCsrfRecovery` path; original resolves |
| CO-API-008 | refresh → 401 | `handleAuthFailure`: store `isAuthenticated=false`, `user=null`, `location.href = "/login"`; queued requests reject |
| CO-API-009 | already on `/login` and refresh fails | no redirect assignment |
| CO-API-010 | retried request → 401 again | **no** second refresh (no infinite loop): refresh count stays 1, caller rejects |
| CO-API-011 | `isRefreshing` resets after success and after failure (a later 401 triggers a fresh refresh) | |

**Module state:** `isRefreshing`/`failedQueue` are module-level. Between tests call
`vi.resetModules()` and re-import `axiosInstance` and `authStore` dynamically
(`await import("../api/axiosInstance")`) so state doesn't leak between tests.

## 2. React Query defaults (KI-010, fixed)
Pre-approved seam (C1 Step 6): `export const queryClientOptions` from `src/Providers.tsx`.
| ID | Assert |
|---|---|
| CO-API-020 | `queryClientOptions.defaultOptions.mutations.retry === 0` (regression guard for KI-010) |
| CO-API-021 | Behavioral proof: render the returns create mutation (or a minimal `useMutation` using `returnsApi.createReturn`) with a QueryClient built from `queryClientOptions`; MSW returns 500 → POST count must be 1 |
| CO-API-022 | Audit list: grep every `useMutation({` in `src/` (write the list into the test as a table: file → API call). Any mutation that sets its own `retry` > 0 on a non-idempotent POST is a regression of KI-010: fail the test. The test asserts the list equals the grep result at test time (read files with `fs` + regex), so a new mutation added later forces a decision |

## 3. API modules (`src/api/*.ts`)
For **each exported function** in `crud-api.ts`, `sales-api.ts`, `returns-api.ts`,
`inventory-api.ts`, `payments-api.ts`, `promotion-api.ts`, `purchase-payments-api.ts`,
`rewards.api.ts`, `product-api.ts`, `import-api.ts`, `operational-costs-api.ts`,
`receipt-settings-api.ts`, `support-api.ts`, `product-audit-api.ts`, `ai-api.ts`: one test that calls it
with representative args and asserts the HTTP **method**, **path** (built from `endpoints`), **query
params**, and **body** that MSW received. It also asserts that the return value is `response.data`
(or whatever the function unwraps; read `crud-api.ts`).

IDs `CO-APIM-<module>-NNN`. Create a small table-driven helper `expectRequest(fn, { method, path, query?, body? })`.

Why: these tests plus X1 endpoint parity make a backend route rename fail on **both** sides.

## 4. Print agent (`src/api/printing-agent-api.ts`)
Agent default URL `http://localhost:8080`, timeout 5000 ms (`src/constants/printer.constants.ts`).
MSW handlers on `http://localhost:8080/*`.
| ID | Case |
|---|---|
| CO-PRINT-001 | status OK → returns parsed status |
| CO-PRINT-002 | print success → `{success:true}`; request body equals the `AgentReceiptData` built by the caller (snapshot the body for a fixed sale) |
| CO-PRINT-003 | agent down (MSW `HttpResponse.error()`) → resolves/rejects per implementation with a user-facing message, and **does not throw uncaught** |
| CO-PRINT-004 | agent slow: use MSW `delay(6000)` with fake timers advanced → timeout path |
| CO-PRINT-005 | custom agent URL via the setter → used for subsequent calls |

## 5. Auth store (`src/stores/authStore.ts`)
| ID | Case |
|---|---|
| CO-AUTH-001 | `login` posts `{email,password}` to `endpoints.login` → `isAuthenticated=true` |
| CO-AUTH-002 | `login` failure → state unchanged, error propagates |
| CO-AUTH-003 | `checkAuth` success → `user` set, `isAuthLoading=false`; failure → unauthenticated + `isAuthLoading=false` |
| CO-AUTH-004 | `logout` → posts, clears user |
| CO-AUTH-005 | `getCsrfToken` stores the token |
| CO-AUTH-006 | `validateSubdomain`: one test per `set({...})` branch (no subdomain, not found, inactive, OK, network error). Read lines ~110–198 for the branches |

## 6. Route & menu gating
`routes.tsx` exports `routes` (an array consumed by `useRoutes` in `App.tsx`).
| ID | Case |
|---|---|
| CO-ROUTE-001 | Walk `routes` recursively. For every route whose element tree contains `RequirePermission`, extract `{ fullPath, permission }` by inspecting `element.props` (React elements are plain objects: `el.type === RequirePermission ? el.props.permission : recurse(el.props.children)`). Snapshot this list to `src/__snapshots__/route-permissions.json` via `toMatchFileSnapshot`. A permission change on any route shows up in review |
| CO-ROUTE-002 | Every `permission` in that list is a value of `Permissions` (`constants/permissions.ts`) |
| CO-ROUTE-003 | For each entry: render `<App/>` (or `useRoutes(routes)` in a `MemoryRouter`) at that path with a user lacking the permission → redirected to `/` (Home renders; mock dashboard API with the contract fixture). With the permission → the page's lazy component mounts (`await screen.findBy…` on any stable text, or mock the lazy import with `vi.mock("./pages/x", ...)` returning a marker component, which is faster and preferred) |
| CO-ROUTE-004 | `RequireAuth`: loading → `FullScreenLoader`; unauthenticated → `/login` with `state.from`; authenticated → children |
| CO-ROUTE-005 | `RequirePermission`: no user → loader; no permission prop → children |
| CO-MENU-001 | `Sidebar.tsx` menu: export the menu definition (seam #2: it is a module constant already, "MOVED OUTSIDE COMPONENT"). For each menu item, its `permissions` must be satisfiable, and for each item linking to a route, **the menu's permissions must equal the route's `RequirePermission`**. Otherwise a user sees a menu item that redirects them, or a page they can open by URL but not by menu. Mismatches → characterization list + QUESTION |
| CO-MENU-002 | Render the Sidebar for users with permission sets {none, sales only, all} and snapshot the visible labels |

## 7. Cache invalidation (`src/utils/invalidate-sales-reports.ts`)
| ID | Case |
|---|---|
| CO-CACHE-001 | Calls `invalidateQueries` for exactly `sales, sale, salesStats, dashboardAnalytics, eod, dailyTarget, userSalesStats, variantSalesStats` |
| CO-CACHE-002 | **Every mutation that changes sales/returns/payments calls `invalidateSalesReports`.** Static check like CO-API-022: grep `src/pages/**` for calls to `salesApi.createSale`, `returnsApi.createReturn`, payments `makePayment`, sale delete/restore, pending-delivery complete/cancel. Each containing file must also reference `invalidateSalesReports`. This is "change A, Z is stale" protection: a new sale-changing screen that forgets invalidation fails here |

## 8. Hooks
`renderHook` from `@testing-library/react` wrapped in the providers from `renderWithProviders`.
| ID | Hook | Case |
|---|---|---|
| CO-HOOK-001 | `useSaleManager` | initial state: CASH payment row, REGULAR price type, FLAT average discount; default branch = user's first branch (read code) |
| CO-HOOK-002 | `useSaleManager` | product search queries `salesApi` with branch id; customers query; served-by users |
| CO-HOOK-003 | `usePromotionManager` | auto-apply promotions (`auto_apply: true`) are applied when eligible; removal; re-evaluation when the cart changes; read the hook and add one test per effect/branch |
| CO-HOOK-004 | `useBarcodeScanner` | fast keystrokes + Enter → callback with the code; slow typing ignored; input focus rules. Use fake timers |
| CO-HOOK-005 | `useConfirmDelete` | confirm → callback; cancel → no call |

## Exit criteria
- [ ] All IDs present and green (or `fails` with KI).
- [ ] Coverage: `src/api/**` ≥ 90% lines, `src/stores/**` ≥ 90%, `src/hooks/**` ≥ 80%, `src/components/Require*.tsx` 100%. Add these to `coverage.thresholds`.
