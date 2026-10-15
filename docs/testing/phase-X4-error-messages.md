# Phase X4: Error Messages End-to-End (backend says it clearly, frontend shows it)

**Goal:** when something goes wrong, the user sees a message that says **what** happened and, when
possible, **what to do**. Tests prove this end to end:
1. Every backend error response has a consistent shape with a human-readable `message`.
2. Expected failures (validation, not found, insufficient stock, wrong password) return **4xx with a
   specific message**, never a generic 500.
3. Internals (Prisma error text, table names, stack traces, SQL) never reach the client.
4. The frontend shows the server's message (or a deliberate translation of it), never a hard-coded
   "Failed to …" that hides the real reason, and never raw arrays or field paths.

**Depends on:** B1 (harness), B5 (route manifest), C1/A1 (harnesses). Run it after B5 and C4.

## 0. Audit findings this phase must turn green (measured 2026-10-12)
| ID | Finding | Evidence |
|---|---|---|
| KI-013 | **14 backend catch blocks mask readable 4xx errors as 500 "Failed to …"**, e.g. redeeming too many points → 500 "Failed to redeem points" instead of 400 "Insufficient points balance"; vendor not found → 500 "Failed to find vendor". | `branch.service.ts:190`, `category.service.ts:70`, `sales.service.ts:1416,2635,3198`, `brand.service.ts:72`, `rewards.service.ts:144,337`, `inventory.service.ts:385,491,788`, `inventory-adjustment.service.ts:273`, `return.service.ts:880`, `vendor.service.ts:62`. Line numbers are as of 2026-10-12 on `fix/known-issues`; re-run the scanner in §2.1 rather than trusting them |
| KI-014 | **The frontends drop the server's message in many error handlers.** Consumer: 60 of 161 `messageApi.error` calls pass a fixed string, about 28 of them inside `catch`/`onError` where a server message exists. Admin: 21 of 28. | e.g. `add-sales/index.tsx:865` "Failed to create customer", `AiDescriptionGenerator.tsx:43`, `online-orders/index.tsx:80` |
| KI-015 | **Validation errors aren't human-readable.** `ValidationPipe` returns `message: string[]` such as `"items.0.quantity must not be less than 1"`. The frontends pass that array straight into `messageApi.error(...)`, which renders the strings run together with no separator. | `main.ts`/`app.setup.ts` ValidationPipe; no `Array.isArray(message)` handling anywhere in `consumer/src` or `admin/src` |
| KI-016 | **Prisma filters leak internals.** `prisma-client-exception*.filter.ts` put the raw Prisma message (model/field names, query fragments) in `error`, and the `message` is technical ("Unique constraint failed", "Foreign key constraint failed P2025"). | `prisma-client-exception.filter.ts:21`, `prisma-client-validation-exception.filter.ts:19,28` |

**Status (2026-10-13): KI-013…016 fixes are applied on `fix/known-issues`.** Backend scenarios verified over HTTP against Postgres 17; frontend handlers statically verified. The table above describes the original defects. The permanent suites below are still planned: write repaired cases as normal passing tests. See KNOWN-ISSUES verification notes and D-011/D-013.

---

## 1. The error contract (write it down first: `docs/testing/error-contract.md`)
Every non-2xx JSON response from `/api/v1/**` must have this shape:
```json
{ "statusCode": 400, "message": "Quantity must be at least 1 (line 1).", "error": "Bad Request" }
```
| Rule | Detail |
|---|---|
| R1 `message` is a **string** | Not an array. Up to three prioritized field errors are joined with semicolons, with a count of further problems; the optional `errors` array contains one readable message per field (D-013). |
| R2 `message` is human-readable | No field paths like `items.0.quantity`, no class/enum names like `PaymentMethodEnum`, no `P2002`, no "undefined"/"null", no stack text. Starts with a capital letter. ≤ 200 characters. |
| R3 Status matches cause | Bad input → 400. Wrong login → 401. Allowed-but-not-permitted → 403. Missing or other tenant's resource → 404. Duplicate (unique constraint) → 409. Unexpected → 500. |
| R4 No internals in any field | No raw Prisma message, internal model/table identifier, SQL, file path or stack. User labels such as "product" are allowed. Machine property paths are allowed only in `errors[].field` (D-013). |
| R5 500s are generic and logged | 500 bodies say "Something went wrong. Please try again." (or the existing "Failed to …" text), and the real cause is in the server log. |
| R6 Known failure messages are stable | Messages the UI depends on (stock, price changed, subscription inactive, invalid credentials) are pinned by tests; changing their wording is a reviewed change. |

## 2. Backend tests (`backend/test/e2e/errors/`)

### 2.1 Static scanner: no masked 4xx (`scripts/check-masked-errors.mjs`, run in CI)
Port the scanner used in the audit into a committed script:
- For every `catch (e) { … }` in `src/**/*.ts` (not specs) whose body throws a 500
  (`INTERNAL_SERVER_ERROR` / `InternalServerErrorException`) **and** whose `try` block contains a
  `throw new (BadRequest|NotFound|Forbidden|Conflict|Unauthorized)Exception`, the catch must start with
  `if (isClientError(error)) throw error;` (or an equivalent HttpException/Prisma passthrough).
- Output: `file:line` per violation. Exit 1 if any are found that aren't listed in
  `scripts/masked-errors-allowlist.json` (empty for the repaired sites; do not add exceptions for fixed defects).
| ID | Assert |
|---|---|
| X-ERR-001 | Scanner exits 0 (CI step in `backend-unit`) |
| X-ERR-002 | Allowlist entries all still exist; a fixed entry left in the list fails (same pattern as BE-ROUTE-016) |

### 2.2 Every thrown 4xx message is human-readable (unit, static)
`src/common/errors/messages.spec.ts`: collect every string literal or template passed to
`new (BadRequest|NotFound|Forbidden|Conflict|Unauthorized)Exception(...)` across `src/` (regex over
source files, like X-ENDP-003) and check R2 on each:
| ID | Assert |
|---|---|
| X-ERR-010 | No message is empty or missing (allowed exception: `DevelopmentOnlyGuard`'s bare 404, which deliberately hides routes) |
| X-ERR-011 | No message contains `\b\w+\.\d+\.\w+\b` (field paths), `Enum`, `P20\d\d`, `undefined`, `null`, `[object Object]` |
| X-ERR-012 | Template messages that interpolate ids give the user something actionable: keep a reviewed snapshot (`toMatchSnapshot`) of all messages so wording changes show up in review |

### 2.3 Runtime contract over every route (extends B5 robustness sweeps)
Reuse the B5 manifest and the BE-ROB-001…003 request generators. For **every** collected error response:
| ID | Assert |
|---|---|
| X-ERR-020 | Body matches the R1 shape (`statusCode` number, `message` **string**) |
| X-ERR-021 | R2 holds for `message` |
| X-ERR-022 | R4: `JSON.stringify(body)` has no `prisma`, `Invalid \`prisma.`, `PrismaClient`, `at /`, `.ts:`, `SELECT `, `INSERT `, table names from `Prisma.dmmf.datamodel.models[].dbName` |
| X-ERR-023 | `{}` bodies on create routes → **400** (not 500) |

### 2.4 Specific scenarios (one test each; message pinned with `toBe`)
| ID | Scenario | Status | Message (pinned) |
|---|---|---|---|
| X-ERR-030 | Login unknown email / wrong password (tenant and super-admin) | 401 | "Invalid email or password" Pass: fixed 2026-10-12 |
| X-ERR-031 | Login correct password, expired subscription | 403 | "Your subscription is not active. Please renew it or contact support to continue." Pass: |
| X-ERR-032 | Sale with qty > stock | 400 | starts with "Insufficient stock for" |
| X-ERR-033 | Sale with stale price (KI-005) | 400 | starts with "Price of variant" … "Refresh the product list and try again." |
| X-ERR-034 | Redeem more points than balance | **400** "Insufficient points balance" (KI-013 fixed, HTTP verified) |
| X-ERR-035 | GET another tenant's vendor/branch/category/brand by id | **404** "… not found" (KI-013 fixed; unknown vendor HTTP verified, cross-tenant matrix still planned) |
| X-ERR-036 | Create product with duplicate name (P2002) | **409** "A product with this name already exists." (KI-016 fixed, HTTP verified) |
| X-ERR-037 | Delete a branch that still has stock/sales (P2003) | **409** human text, e.g. "This branch has sales or stock and can't be deleted" (KI-016) |
| X-ERR-038 | `quantity: 0` on a sale line | 400, message is a string mentioning quantity, without `items.0.` (KI-015) |
| X-ERR-039 | Missing CSRF header | 403. The UI retries automatically (CO-API-003), so the user never sees "invalid csrf token". Pin both behaviors |
| X-ERR-040 | Force an unexpected error (stub a service method to throw `new Error('db exploded')`) | 500, generic message, body has no "db exploded", the server log has it (spy on `Logger.error`) |

## 3. Frontend tests (consumer `C6`, admin `A3`; jsdom + MSW, harness from C1/A1)

### 3.1 One shared extractor
Test the existing helper in each app (KI-014/015 fixed):
`src/utils/api-error.ts` → `getErrorMessage(err: unknown, fallback: string): string`
- `err.response.data.message` string → that string.
- Array → string elements joined with "; " (legacy response compatibility).
- Network error (no response) → "Can't reach the server. Check your connection and try again."
- 5xx without a message → `fallback`.
- Never returns `[object Object]`, an empty string, or a field path.
| ID | Assert |
|---|---|
| CO-ERR-001…008 | each branch above, plus a timeout (`ECONNABORTED`) → "The request timed out. Please try again." |
| AD-ERR-001…008 | same in admin |

### 3.2 Static check: no handler hides the server message
`src/test/error-handlers.test.ts` scans `src/**/*.tsx?` (excluding tests):
| ID | Assert |
|---|---|
| CO-ERR-010 | Inside every `catch (…) {}` block and every `onError:` callback, a `messageApi?.error(` / `message.error(` / `notification.error(` call must use `getErrorMessage(...)`. A literal-only call in those contexts fails. Literal-only calls **outside** catch/onError (client-side validation such as "Please add at least one item to the sale") are fine |
| CO-ERR-011 | Allowlist file `src/test/error-handlers.allowlist.json` with a reason per entry (e.g. the PDF preview where the server returns a binary body). Starts with the KI-014 offenders and must shrink |
| AD-ERR-010/011 | same for admin |

### 3.3 Rendering: the message the server sent is what the user sees
Use the C4/A2 flow harness. For each flow, MSW returns an error with a **distinctive** message and the
test asserts it appears in the antd message container (`await screen.findByText(msg)`):
| ID | Flow | Server response | User must see |
|---|---|---|---|
| CO-ERR-020 | POS checkout | 400 "Insufficient stock for variant 7. Available: 1, Requested: 2" | that exact text; cart kept |
| CO-ERR-021 | POS checkout | 400 "Price of variant 7 has changed (now 120.00). Refresh the product list and try again." | that text |
| CO-ERR-022 | POS checkout | 400 `message: ["quantity must not be less than 1"]` (array) | a single readable string, no run-together text |
| CO-ERR-023 | POS checkout | network error | "Can't reach the server…" |
| CO-ERR-024 | POS checkout | 500 "Failed to create sale" | "Failed to create sale" (fallback), not "[object Object]" |
| CO-ERR-025 | Create return | 400 "Total payment amount must exactly match selected return value. Expected $35.00, got $30.00" | that text |
| CO-ERR-026 | Make partial payment | 400 "Total payment amount (500) exceeds remaining amount (300)" | that text |
| CO-ERR-027 | Customer drawer (create customer from POS/add-sales) | 409 "A customer with this phone number already exists" | that text (today: "Failed to create customer", KI-014) |
| CO-ERR-028 | Inventory adjustment | 400 "Insufficient available quantity in batch…" | that text |
| CO-ERR-029 | Login | 401 "Invalid email or password" | that text, user stays on the login page, **no** refresh-token request is sent (interceptor fix 2026-10-12) |
| CO-ERR-030 | Login | 403 subscription message | that text |
| CO-ERR-031 | Any page | 403 from `PermissionsGuard` (Nest's generic `message: "Forbidden resource"`) | "You don't have permission to do this." (`getErrorMessage` maps that generic text to a friendly one) |
| CO-ERR-032 | AI description | 500 | readable fallback, the button re-enabled |
| AD-ERR-020…026 | admin: create consumer (duplicate subdomain 409), plan delete in use (409), billing create 400, user create duplicate email 409, login 401/403, network error | server text shown |

### 3.4 Cross-layer: real backend messages render
In X2 (Playwright), add:
| ID | Journey |
|---|---|
| E2E-J12 | Wrong password on the real stack → login page shows "Invalid email or password"; no redirect loop; network panel shows exactly one `login-user` request and **no** `client-refresh-token` request |
| E2E-J13 | Sell more than stock → the real 400 message appears on screen |
| E2E-J14 | Create a duplicate product name → readable 409 text on screen (KI-016) |

## 4. CI
- `check-masked-errors.mjs` → step in `backend-unit`.
- X-ERR-0xx Jest tests → `backend-integration` (e2e part).
- CO-/AD-ERR tests → existing `consumer-tests` / `admin-tests` jobs.

## Exit criteria
- [ ] Error contract written; all X-ERR, CO-ERR, AD-ERR IDs exist.
- [ ] KI-013…016 regression cases are normal passing tests; fixed sites have no failing markers or stale allowlists.
- [ ] A deliberately introduced `throw new BadRequestException('Out of stock')` inside a non-passthrough catch makes X-ERR-001 fail (manual proof in the PR).
