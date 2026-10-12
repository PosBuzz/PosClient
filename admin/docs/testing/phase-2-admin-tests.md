# Phase A2: Admin Tests

**Depends on:** A1, B5 (contracts). **Location:** next to source, `*.test.ts(x)`.

---

## 1. HTTP layer
`src/api/axiosInstance.ts`: replicate **CO-API-001…011** as `AD-API-001…011` with admin endpoints
(`/auth/admin-refresh-token`, `/auth/csrf-token`). The two files are near copies, so the same
behavior must hold. Write the test table **once** in a helper module per app; each app imports its
own instance.
| ID | Extra admin case |
|---|---|
| AD-API-020 | `src/api/http.ts#post`: the `code === 409` branch is unreachable because axios rejects non-2xx by default. Characterization: a 409 response **rejects** with the axios error (not `resp_data`). Log a QUESTION: callers may expect `resp_data` on 409 |
| AD-API-021 | `get/post/patch/deleteApi` return types: `get`/`post` return `data`; `patch`/`deleteApi` return the **full response**. Pin that, since callers depend on the difference |
| AD-API-022 | `endpoints.downloadBillingInvoice`/`downloadBillingHistoryPDF` are absolute URLs built from `baseUrlWithPrefix`. Test the prefix logic: base `http://x` → `http://x/api/v1/...`; base `http://x/api/v1/` → `http://x/api/v1/...` (trailing slash stripped) |

## 2. Auth & routing
| ID | Case |
|---|---|
| AD-AUTH-001…004 | admin `authStore`: login/logout/checkAuth/getCsrfToken (mirror CO-AUTH-001…005 where applicable) |
| AD-ROUTE-001 | every route under `/` requires auth (walk `routes` like CO-ROUTE-001; admin routes don't use permission gates, so verify that and pin it) |
| AD-ROUTE-002 | `/test` route is **public** and renders a leftover form (`pages/test`, "ZapForm"). Characterization + QUESTION: remove it? The test fails when it's removed, which forces an update |

## 3. Flows (MSW + contracts, request bodies recorded to `contracts/requests/admin-*.json`)
| ID | Page | Flow | Assert |
|---|---|---|---|
| AD-FLOW-PLAN-001 | plans | create plan with name, price, a subset of permissions | body recorded `admin-plan-create.json`; permission checkboxes list **exactly** the `ConsumerPermission` values (fixture from the backend's plan-permissions endpoint) |
| AD-FLOW-PLAN-002 | plans | edit plan: remove a permission | body recorded `admin-plan-update.json` |
| AD-FLOW-CONS-001 | consumers | create consumer: subdomain availability check (`check-subdomain`) debounced; taken subdomain shows an error and blocks submit | |
| AD-FLOW-CONS-002 | consumers | create → body recorded `admin-consumer-create.json` |
| AD-FLOW-CONS-003 | consumers | soft delete with confirm → request sent; list refreshes |
| AD-FLOW-CONS-004 | consumers | data import modal: preview → confirm → requests to `data-imports/preview` then `data-imports` with the selected source/target |
| AD-FLOW-BILL-001 | billings | create billing entry → body recorded `admin-billing-create.json`; PDF/Excel download buttons hit the right URLs |
| AD-FLOW-ROLE-001 | roles | create role with admin permissions → body recorded |
| AD-FLOW-USER-001 | users | create user / change password |
| AD-FLOW-SUP-001 | support | open ticket, post message, status change |
| AD-FLOW-BKP-001 | backup&restore | backup button calls `/admin/backup`; restore requires a file + confirm. **Never** hits a real backend |
| AD-FLOW-LOGIN-001 | login | csrf → login → redirect home; wrong creds message |
| AD-SMOKE-* | home, account&security | renders without console errors |

`src/test/smoke-coverage.test.ts`: every directory in `src/pages` except `portfolio` has a test.

## 4. Coverage gate
`src/api/**` ≥ 90% lines; `src/stores/**` ≥ 90%; pages global ≥ 50% lines.

## Exit criteria
- [ ] IDs green; `contracts/requests/admin-*.json` committed (X1 replays them on the backend).
