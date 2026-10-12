# Testing Decisions Log

Append-only. Use the template at the bottom of `DECISION-PLAYBOOK.md`. Number entries `D-001`, `D-002`, …

### D-001 Test DB is real Postgres 17, not SQLite or mocked Prisma   (2026-10-12, planning)
Type: DECISION
Context: The backend uses raw SQL (`$queryRaw` in `sales.service.ts` variant stats,
`dashboard.service.ts`, `consumer-purge.service.ts`), Postgres-specific `Decimal(10,2)` columns, and
`@@unique([sale_number, consumer_id])` constraints that concurrency tests depend on.
Chosen: real `postgres:17-alpine` (the same image as `docker-compose.yml`) via Testcontainers.
Follow-up: none.

### D-002 Existing mocked-Prisma unit specs are kept   (2026-10-12, planning)
Type: DECISION
Context: The 9 existing `*.spec.ts` files (35 tests) mock Prisma. They are fast and valid.
Chosen: keep them as-is under `npm test`. New business-flow tests go into integration suites. Do
not convert or delete the old ones.
Follow-up: none.

### D-003 Migration drift on one index name   (2026-10-12, planning)
Type: DECISION
Context: `prisma migrate diff` from the migrated DB to `schema.prisma` wants
`ALTER INDEX "consumer_data_imports_source_consumer_id_target_consumer_id_cre" RENAME TO "consumer_data_imports_source_consumer_id_target_consumer_id_idx"`.
Postgres truncated the over-63-character name.
Chosen: tracked as KI-007. B6 prescribes the fix.
Follow-up: KI-007.

### D-004 Business days use BUSINESS_TIMEZONE, default Asia/Dhaka   (2026-10-12, KI-008 fix)
Type: DECISION
Context: Day boundaries were inconsistent (dashboard UTC vs EOD/stats/sale numbers in server-local time, which is UTC in containers). Currency is BDT and payment providers are Bangladeshi.
Options considered: (a) dayjs-tz rewrite of every date computation; (b) run the process in the business zone and make the dashboard use local time.
Chosen: (b). `src/timezone.ts` (first import in `main.ts`) sets `process.env.TZ` from `BUSINESS_TIMEZONE`, default `Asia/Dhaka`. Verified to work in `node:20-alpine` without tzdata. SQL groups with `AT TIME ZONE` using the same zone. Calendar-date columns (`expiry_date`, `incurred_on`, spreadsheet dates) intentionally still use UTC `toISOString()`, because they are stored as UTC midnight.
Follow-up: tenants in other zones would need a per-tenant zone (not needed today). Test harnesses must set `TZ` explicitly, because `main.ts` isn't loaded in tests.

### D-005 Login throttling keyed on IP + email   (2026-10-12, KI-002 fix)
Type: DECISION
Context: No `trust proxy` is configured. Behind a reverse proxy every client has the same `req.ip`, so an IP-only limit of 5/min would lock out all users together.
Chosen: `LoginThrottlerGuard` tracks `${ip}:${lowercased email}`. This stops per-account brute force. It does not stop one IP spraying many accounts (a QUESTION for later; it needs `trust proxy` + a real client IP).

### D-006 Server validates sale lines against the catalog   (2026-10-12, KI-005 fix)
Type: DECISION
Context: The POS never lets a cashier edit a line's unit price (read-only column; always regular/wholesale price). Tax comes from the product. Average/special discounts are cashier discretion.
Chosen: Reject when unit price ≠ catalog price, tax or pre-discount line total ≠ `calculateTaxAndTotal` (±0.02), or discounts > line. Cap each promotion's spread discount at the server's own evaluation, using `unit_price × qty` as the base (the POS's base; the backend evaluator otherwise prefers `line_total`, which is net of discounts and tax). Cashier discounts are not limited beyond "≤ line".
Follow-up: a catalog price change between loading the POS and checkout now gives a 400 "Price … has changed. Refresh". X1 fixtures must keep `sale-pricing.util.ts` and the consumer's `calculateTaxAndTotal` identical.

### D-007 CODEOWNERS owner   (2026-10-12)
Type: DECISION
Chosen: `@Istiak-A-Tashrif` owns `contracts/`, `docs/testing/`, migrations and workflows (X3 §3).

### D-008 Redis and RabbitMQ are optional, off by default   (2026-10-12)
Type: DECISION
Context: The owner wants their resource usage gone but the ability to bring them back. In the backend, Redis was used only by the health check; RabbitMQ only for AI descriptions, which already had an HTTP fallback.
Chosen: Keep all code and make it switchable. Backend: `REDIS_ENABLED` (RedisCacheModule registered only when true; health shows `disabled`) and `RABBITMQ_ENABLED` (RabbitMQService doesn't connect; DescriptionService calls the AI service over HTTP directly). ai-service: `RABBITMQ_ENABLED` (startup no longer requires RabbitMQ), `CACHE_REDIS_ENABLED` defaults to False (in-memory cache). The initial compose arrangement was superseded by D-012: the standard stack contains neither service; the AI stack contains RabbitMQ with its backend flag enabled.
To re-enable: see D-012 for the current compose files and flags.
Follow-up: tests don't start Redis/RabbitMQ; BE-HARN-011…014 cover both modes.

### D-009 Uniform login failure response   (2026-10-12)
Type: DECISION
Chosen: 401 "Invalid email or password" for unknown email and wrong password, for both tenant users and super-admin; timing equalized with a dummy bcrypt hash; subscription (403) checked only after a valid password. Frontend interceptors skip token refresh for the login request.

### D-010 Committed .env.docker files stay   (2026-10-12)
Type: DECISION
Context: KI-012. The owner rotated the secrets on the VM, so the committed values are no longer live.
Chosen: Leave the files tracked. The X3 secret scan allowlists `.env.docker` and `backend/.env.docker` with a reference to this entry. Any **new** secret file is still caught.


### D-011 Preserve readable client errors through service catches (2026-10-13, KI-013/016)
Type: DECISION
Context: Broad service catches changed intentional 4xx and explainable Prisma errors into generic 500s.
Chosen: `isClientError` rethrows HttpException and mapped Prisma known errors before logging/wrapping unexpected errors, at 159 sites. Its Prisma mapping import is relative so both built Node and Jest resolve it. Enable `return-await: in-try-catch` so rejected returned promises reach these catches too.
Verification: real HTTP/Postgres 17: excess points → 400 "Insufficient points balance"; unknown vendor → 404; unit-in-use → readable 409. Build and existing 35 tests pass.
Follow-up: permanent X4 regression suites remain planned.

### D-012 Compose services match the selected stack (2026-10-13, supersedes D-008 compose instructions)
Type: DECISION
Context: Owner's current decision removes optional infrastructure from the standard deployment.
Chosen: `docker-compose.yml` has neither Redis nor RabbitMQ. `docker-compose.with-ai.yml` has no Redis; RabbitMQ is an ordinary service with startup dependencies, backend `RABBITMQ_ENABLED: "true"` and AI `RABBITMQ_ENABLED: "True"`. Run `docker compose -f docker-compose.with-ai.yml up -d` for that stack. For Redis, explicitly supply an external instance or a separate compose override and set `REDIS_ENABLED=true`; setting the flag alone does not provision it. Source integrations remain available behind flags.
Verification: backend starts with only Postgres; HTTP health reports database healthy and Redis disabled.
Follow-up: none.

### D-013 Readable validation and frontend error extraction (2026-10-13, KI-014/015)
Type: DECISION
Chosen: Validation responses carry a single `message` (up to three prioritized field errors joined with semicolons, plus a count of additional problems) plus `errors: [{field, message}]`. `field` is the machine path (`items.0.quantity`); `message` is user text ("Item 1: quantity must not be less than 1."). Machine field paths are allowed only in `errors[].field`, never in visible text. Frontend `getErrorMessage(error, fallback)` prefers readable server strings, joins string arrays with "; ", handles network/timeouts and translates generic statuses. Blob errors use caller wording because this extractor is synchronous. Both apps share identical implementations.
Verification: zero-quantity HTTP request → 400 single string and errors array; both frontend lint/typechecks pass. Browser rendering checks remain planned, not claimed as executed.
Follow-up: normal passing X4 tests, no failing markers for repaired cases.

### D-014 Static-check ratchet and dependency-check plan (2026-10-13, P0/X3)
Type: DECISION
Chosen: Enable the requested zero-baseline lint rules plus `return-await` and multiline braces; enable backend noImplicitReturns/noUnusedLocals/noUnusedParameters/noImplicitOverride/noFallthroughCasesInSwitch and frontend noUnusedParameters. Preserve unused logger declarations as comments and constructor DI as ordinary underscore-prefixed parameters. Keep awaited DB calls when only their unused result bindings are removed. Defer the measured nonzero strictness rules listed in P0 until their findings can be fixed without weakening checks.
Dependency jobs are specified in the plan docs; implementation of CI remains P0/X3 work. Audit exceptions must be scoped by advisory, app and affected version/path, with SECURITY-NOTES justification; never ignore all audit failures. New vulnerable dependencies are still blocked by dependency review. License deny policy is owner-defined rather than invented here.
Follow-up: CI implementation and recorded ratchets in P0/X3.


### D-015 Enable backend noImplicitAny and remove documentation emojis (2026-10-13)
Type: DECISION
Context: Owner explicitly requested backend noImplicitAny in addition to noImplicitReturns, noUnusedLocals, noUnusedParameters, noImplicitOverride and noFallthroughCasesInSwitch; frontend noUnusedParameters stays enabled.
Chosen: Install @types/multer, @types/passport-jwt, @types/cookie-parser and @types/amqplib as dev dependencies, with lockfile updates. Type PDF callbacks using existing receipt/Prisma shapes; correct the RabbitMQ connection to ChannelModel, use getOrThrow for the Joi-defaulted URL and remove await from synchronous publish. Merge the application user fields into Express.User and preserve the existing nonoptional app request-user contract in express-serve-static-core, avoiding conflicting Passport global declarations. Replace documentation status icons with words and remove remaining emoji code points within in-scope docs.
Follow-up: Backend full strict, frontend noImplicitAny and react-hooks/exhaustive-deps remain tracked in P0. Backend noImplicitAny is now enforced, superseding its deferral in D-014. Full request authentication-boundary optionality belongs to the broader strictness review.

Verification for D-015: all three apps pass typecheck and ESLint (0 errors / 0 warnings); backend build and 8 suites / 35 tests pass. The rebuilt backend passes the same six authenticated HTTP error scenarios against freshly migrated Postgres 17, with Redis/RabbitMQ disabled. Documentation emoji scan: 0 findings across 34 in-scope Markdown files. Temporary backend/database stopped; changes remain uncommitted.


### D-016 Final review: compose flags and validation documentation (2026-10-13)
Type: DECISION
Context: AI compose no longer provisions Redis, but the existing AI env file still sets CACHE_REDIS_ENABLED=True. The validation formatter displays up to three field messages, while the docs described only one.
Chosen: Explicitly set backend REDIS_ENABLED=false and AI CACHE_REDIS_ENABLED=False in the AI compose stack without modifying the owner's env files. Document the actual three-message cap and additional-error count. Clean up multiline braces inserted by ESLint without reformatting entire frontend files.
Follow-up: Permanent regression suites and dependency/CI gates remain tracked in P0/X4/X3. Consumer build also reports stale Browserslist data; refresh it in a scoped dependency maintenance update.

Final review verification: all three typechecks/builds pass, ESLint is 0 errors / 0 warnings in each app, backend 8 suites / 35 tests pass, and all six real HTTP error scenarios pass on freshly migrated Postgres 17. Compose YAML/service flags and the existing AI changes parse successfully. AI runtime with external models/queue was not exercised.
