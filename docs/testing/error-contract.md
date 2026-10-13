# Error contract

Every non-2xx JSON response from `/api/v1/**` has this shape:

```json
{ "statusCode": 400, "message": "Quantity must be at least 1 (line 1).", "error": "Bad Request" }
```

| Rule | Detail | Enforced by |
|---|---|---|
| R1 `message` is a string | Never an array. Up to three prioritized field errors are joined with semicolons and a count of further problems; the optional `errors` array holds one readable message per field (D-013). | X-ERR-020 |
| R2 `message` is readable | Starts with a capital letter, 200 characters or fewer, no field paths such as `items.0.quantity`, no enum names, no `P20xx`, no `undefined`, `null` or `[object Object]`. | X-ERR-010…012, X-ERR-021 |
| R3 Status matches cause | Bad input 400; wrong login 401; not permitted 403; missing or another tenant's resource 404; duplicate 409; unexpected 500. | X-ERR-030…040 |
| R4 No internals | No Prisma text, SQL, stack frames, file paths or snake_case table names in any field. Property paths may appear only in `errors[].field`. | X-ERR-022 |
| R5 500s are generic | The body does not carry the cause; the cause is in the server log. | X-ERR-040 |
| R6 Stable messages | Messages the UI depends on (stock, price changed, subscription, credentials, CSRF) are pinned with `toBe`/anchored patterns; changing them is a reviewed change. | X-ERR-030…039 |

Client side, `getErrorMessage(error, fallback)` in `consumer/src/utils/api-error.ts` and
`admin/src/utils/api-error.ts` is the only place that turns an error into text. Every `catch` and
`onError` that shows a toast must use it, except entries in `src/test/error-handlers.allowlist.json`
(each with a reason). The static check is CO-ERR-010 / AD-ERR-010.

Masked 4xx: a `catch` that returns a 500 must first pass through client errors with
`isClientError(error)`. `scripts/check-masked-errors.mjs` enforces this in CI (X-ERR-001/002).
