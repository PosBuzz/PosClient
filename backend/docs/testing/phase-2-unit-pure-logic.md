# Phase B2: Backend Pure-Logic Unit Tests

**Goal:** cover every piece of backend logic that needs no I/O: math, parsing, DTO validation
and error mapping. These tests are fast (< 10 s total), run on every `npm test`, and are the main
mutation-testing targets in B7.

**Depends on:** B1 (only for the `prisma-client-exception` moduleNameMapper fix). **Location:**
next to the source as `*.spec.ts` (existing convention). **Runner:** `npm test`.

Add `fast-check` for property tests: `npm i -D fast-check@^4`.

---

## 1. Promotion math (`src/consumer/promotions/services/promotions.service.ts`)

`calculateDiscount`, `calculateEffectiveQuantity` and `calculateBaseWithQuantityLimit` are `private`
but pure. **Pre-approved seam #2:** move them **verbatim** into a new file
`src/consumer/promotions/promotion-math.ts` as exported functions, and have the service call them.
Make no other change. Commit `refactor(testability): extract promotion math`. The service's
private methods become one-line delegations (or the call sites call the functions directly; pick
one and keep the diff minimal). This also lets X1 import the exact functions.

File: `src/consumer/promotions/promotion-math.spec.ts`

| ID | Case | Expected |
|---|---|---|
| BE-PROMO-001 | PERCENTAGE 10% of base 200, qty 2, no cap | 20 |
| BE-PROMO-002 | FIXED 15 per unit, qty 3, base 1000 | 45 (fixed is **per eligible unit**) |
| BE-PROMO-003 | FIXED 50 per unit, qty 3, base 100 | 100 (clamped to base) |
| BE-PROMO-004 | PERCENTAGE 50%, base 400, cap 100 | 100 |
| BE-PROMO-005 | cap = 0 / null / undefined | cap ignored |
| BE-PROMO-006 | base 0 or qty 0 | 0 |
| BE-PROMO-007 | `calculateEffectiveQuantity` with limit null/0/negative | total qty |
| BE-PROMO-008 | `calculateEffectiveQuantity` qty 7, limit 5 | 5 |
| BE-PROMO-009 | `calculateBaseWithQuantityLimit` with total qty ≤ limit | full base |
| BE-PROMO-010 | items A(2 units, subtotal 100), B(3 units, subtotal 60), limit 3 | 2×50 + 1×20 = 120 (most expensive per-unit first) |
| BE-PROMO-011 | item with qty 0 inside the list | no division by zero, contributes 0 |
| BE-PROMO-P01 | **property:** for any valid inputs, `0 ≤ discount ≤ base` | always |
| BE-PROMO-P02 | **property:** with a cap > 0, `discount ≤ cap` | always |
| BE-PROMO-P03 | **property:** `calculateBaseWithQuantityLimit(items, L) ≤ sum(subtotals)`, and it is monotonic non-decreasing in L | always |
| BE-PROMO-P04 | **property:** PERCENTAGE discount is monotonic in `discountValue` | always |

Property test template:
```ts
import fc from 'fast-check';
it('[BE-PROMO-P01] discount is within [0, base]', () => {
  fc.assert(fc.property(
    fc.constantFrom('PERCENTAGE', 'FIXED'),
    fc.double({ min: 0, max: 100, noNaN: true }),
    fc.double({ min: 0, max: 1e6, noNaN: true }),
    fc.integer({ min: 0, max: 1000 }),
    fc.option(fc.double({ min: 0, max: 1e6, noNaN: true }), { nil: null }),
    (type, value, base, qty, cap) => {
      const d = calculateDiscount(type, value, base, qty, cap);
      return d >= 0 && d <= base;
    }), { seed: 12345, numRuns: 1000 });
});
```
Use the string literals the service actually compares against. Check `PromotionDiscountType` in
the promotions folder for the exact enum values.

## 2. Purchase validation (`src/consumer/inventory/utils/validate-purchase.util.ts`)
An existing spec has 30 lines. Read the util, then extend the spec so that **every branch** (each
`if`/`throw`) has a test. IDs `BE-PURCH-001…`, one per branch. Run
`npx jest --coverage --collectCoverageFrom=src/consumer/inventory/utils/*.ts` and get to 100%
branches for that file.

## 3. Batch location util (`src/consumer/inventory/utils/batch-location.util.ts`)
Same approach: one test per branch, IDs `BE-LOC-001…`, 100% branches.

## 4. Subdomain parsing (`src/common/services/subdomain-util.service.ts`)
This is security-relevant because `ClientAuthGuard` uses it for tenant binding. Instantiate the service
directly (`new SubdomainUtilService(...)`; check its constructor).

| ID | Input to `extractSubdomainFromHost` | Expected |
|---|---|---|
| BE-SUB-001 | `acme.localhost` | `acme` |
| BE-SUB-002 | `acme.localhost:3000` | `acme` |
| BE-SUB-003 | `ACME.example.com` | `acme` (lower-cased) |
| BE-SUB-004 | `example.com` | null |
| BE-SUB-005 | `localhost` | null |
| BE-SUB-006 | each excluded subdomain (`www`, `api`, `admin`, `app`; read `excludedSubdomains` for the real list) `.example.com` | null |
| BE-SUB-007 | `a.b.example.com` | `a` (characterization: confirm intent, since multi-level hosts take the first label) |
| BE-SUB-008 | `127.0.0.1` | characterization: record the actual result. **If it returns `127`, that is a KNOWN-ISSUE** (an IP host would be treated as tenant "127"): add a KI |
| BE-SUB-009 | `extractSubdomainFromUrl('https://acme.example.com/path')` | `acme` |
| BE-SUB-010 | `extractSubdomainFromUrl('not a url')` | null, no throw |
| BE-SUB-011 | `extractSubdomainFromRequest`: origin wins over referer, and referer over host | priority order |

## 5. Prisma exception filter (`prisma-client-exception/prisma-client-exception.filter.ts`)
The existing spec is 7 lines (only "is defined"). Replace its body:

| ID | Prisma code | Expected response |
|---|---|---|
| BE-PEF-001 | P2002 | 409, `message: 'Unique constraint failed'` |
| BE-PEF-002 | P2003 | 409, `'Foreign key constraint failed'` |
| BE-PEF-003 | P2025 | 409, `'Foreign key constraint failed P2025'` (characterization: P2025 is "record not found", and 404 would be conventional. Log a QUESTION) |
| BE-PEF-004 | P2018 | 409 |
| BE-PEF-005 | P9999 (unknown) | delegates to `BaseExceptionFilter.catch` (spy on the prototype) |
| BE-PEF-006 | message containing `\n` | newlines stripped in `error` |

Build the exception with `new Prisma.PrismaClientKnownRequestError('msg\nline', { code: 'P2002', clientVersion: 'test' })`.
Build `ArgumentsHost` as a minimal object whose `switchToHttp().getResponse()` returns
`{ status: jest.fn().mockReturnThis(), json: jest.fn() }`.

## 6. DTO validation (`class-validator`)
Global `ValidationPipe({ transform: true })`. Note: **no `whitelist`**, so unknown properties pass
through. A DTO change silently changes what the API accepts. Pin it.

Helper `test/helpers/validate-dto.ts` (usable from `src/**/*.spec.ts` through a relative import):
```ts
export async function errorsFor<T extends object>(cls: new () => T, plain: object) {
  const inst = plainToInstance(cls, plain);
  const errs = await validate(inst as object);
  return errs.flatMap(function flat(e): string[] {
    return [...Object.keys(e.constraints ?? {}).map(k => `${e.property}.${k}`),
            ...(e.children ?? []).flatMap(c => flat(c).map(s => `${e.property}.${s}`))];
  });
}
```

`src/consumer/sales/dto/create-sale.dto.spec.ts`:
| ID | Case | Expected |
|---|---|---|
| BE-DTO-001 | minimal valid sale (branch_id, 1 item) | no errors |
| BE-DTO-002 | item `quantity: 0` | `items.0.quantity.min` |
| BE-DTO-003 | item `unit_price: -1` / `line_total: -1` / each discount `-1` | `min` error for each field |
| BE-DTO-004 | payment `amount: 0` | `payments.0.amount.min` (min is 0.01) |
| BE-DTO-005 | `items: []` | characterization. **A sale with zero items should be rejected**: if it validates, write the correct expectation with `it.failing`, file a KI (no `@ArrayMinSize(1)`), and check BE-SALE-022 in B3 for what the service does |
| BE-DTO-006 | payment_method `CARD`/`BANK_TRANSFER`/`MFS` without `payment_type` | `payment_type.isEnum` |
| BE-DTO-007 | payment_method `CASH` without `payment_type` | valid |
| BE-DTO-008 | unknown `sale_type` / `price_type` / `online_order_status` | isEnum error |
| BE-DTO-009 | string numbers (`"5"`) for `quantity` | record behavior (with `transform: true` and no `enableImplicitConversion`, `"5"` fails `isInt`). Pin it |

Write a similar spec, IDs `BE-DTO-1xx`, for each of these DTOs (money/stock-affecting only):
- `returns/dto/*` (create return)
- `inventory/dto/create-inventory-batch.dto.ts`, `create-inventory-transfer.dto.ts`, `inventory-adjustment.dto.ts`
- `payments/dto/make-payment.dto.ts`
- `purchase-payments/dto/*`
- `promotions/dto/*` (create/update)
- `rewards/dto/*`
For each: one valid case, plus one invalid case **per decorator constraint** on numeric/enum fields.
Use IDs `BE-DTO-1xx` (returns), `2xx` (inventory), `3xx` (payments), `4xx` (purchase payments),
`5xx` (promotions), `6xx` (rewards).

## 7. Other pure helpers
| ID | Target | Test |
|---|---|---|
| BE-UTIL-001 | `src/common/utils/error.util.ts` | `errorMessage`/`errorStack` with Error, string, object, undefined |
| BE-UTIL-002 | `src/common/utils/cache-invalidation.util.ts` | read it; one test per exported function/branch |
| BE-UTIL-003 | `admin/consumer/services/consumer-purge.scope.ts` | already has a spec. Check it covers every table listed; add a test that **every Prisma model with a `consumer_id` field** appears in the purge scope (read the model list from `Prisma.dmmf.datamodel.models`). This makes the test fail when someone adds a tenant table and forgets the purge. |

BE-UTIL-003 is a **"change A → fail Z"** guard. Copy its idea wherever a list must mirror the schema.

## 8. Coverage gate for this phase
Add to the unit `jest` config in `package.json`:
```json
"coverageThreshold": {
  "./src/consumer/promotions/promotion-math.ts": { "branches": 100, "lines": 100 },
  "./src/consumer/inventory/utils/": { "branches": 100, "lines": 100 },
  "./src/common/services/subdomain-util.service.ts": { "branches": 95, "lines": 95 },
  "./prisma-client-exception/": { "branches": 100, "lines": 100 }
}
```
Paths in `coverageThreshold` are resolved against `rootDir` (`src`). If Jest reports
"coverage data not found" for a path, adjust that path to be relative to `rootDir` and log it
(the `prisma-client-exception` folder sits outside `src`, so add
`"collectCoverageFrom": ["**/*.(t|j)s", "../prisma-client-exception/**/*.ts"]` or drop that key and
log it). Change the CI step from `npm test -- --ci` to `npm test -- --ci --coverage`.

## Exit criteria
- [ ] All IDs above exist and pass (or are `failing` with a KI).
- [ ] `npm test -- --coverage` meets the thresholds.
- [ ] `promotion-math.ts` extraction commit contains zero logic changes (`git diff` reviewed).
