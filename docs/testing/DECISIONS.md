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


### D-017 Phase P0 implementation and owner policy (2026-10-13)
Type: DECISION
Chosen: Implement baseline scripts, Node 22 pin, CI, production audit checks, weekly Dependabot and read-only local hooks. Hooks use ESLint instead of repo-wide Prettier because legacy frontend files are not uniformly Prettier-clean, and run lint-staged with no stash/revert to respect the owner's mixed working tree. lint-staged 17 requires Node >=22.22.1 (root tools), while app engines retain the planned >=22.12.0 floor.
Owner chose no license restrictions for now. Vulnerability gates remain high/critical. Private repository metadata reports security_and_analysis=null; PR dependency-delta audits run independently, with the GitHub dependency-review action optionally enabled by DEPENDENCY_REVIEW_ENABLED when supported. Delta audits include dev dependencies and reject newly added vulnerable versions/parents; production audits have only exact documented SPA exceptions.
Owner authorized compatible dependency security fixes separately from P0 tooling, without forced major upgrades.
Follow-up: actual GitHub CI execution requires publishing the changes; no push has been authorized for this phase.

### D-018 Fix testing failures immediately (2026-10-13, owner instruction)
Type: DECISION
Context: Owner explicitly requested: "while testing if any fail occurs fix it immediately".
Chosen: Investigate every failing check immediately; fix confirmed defects and rerun the failing and related checks. Retain normal passing regression tests; record causes/fixes/verification. Never weaken tests or suppress failures with failing/skip markers. This supersedes all older phase/playbook text requiring confirmed defects to be deferred to separate fix PRs. Keep unrelated changes out of scope and report genuine environment blockers honestly.
Follow-up: apply throughout sequential implementation.


### D-019 Node 22 consistently across runtimes (2026-10-13, owner instruction)
Type: DECISION
Chosen: Backend/consumer/admin Docker images move from node:20-alpine to node:22-alpine. Portfolio images already use Node 22; its engine metadata is aligned under the owner's repository-wide Node instruction, with no portfolio source changes. Root and all Node app engine ranges are >=22.22.1 <23, CI reads root .nvmrc=22, and setup checks the same runtime range before installing dependencies. Compose uses these Dockerfile builds, not a separate Node image. This explicitly supersedes P0's original prohibition on changing Docker Node versions.
Follow-up: verify image builds on Node 22 before proceeding through P0.


### D-020 P0 failures repaired and verification (2026-10-13)
Type: DECISION
Context: Owner-authorized compatible security updates made four existing type assertions unnecessary; lint then failed. Backend Docker's default command pointed at dist/main while the real build emits dist/src/main, and it lacked a dockerignore.
Chosen: Remove the obsolete assertions and redundant parentheses immediately without changing ESLint rules. Correct the default Docker command; exclude host dependencies/build outputs/local env and runtime data from the backend build context. Existing env files are untouched. Preserve prior Node 20 behavior as historical context in D-004; current Docker stages use Node 22 under D-019.
Verification: all three images build; backend container boots by its default command on Node v22.23.3 and passes six real HTTP scenarios on Postgres 17. Three consecutive root check runs pass (35 backend tests and 16 gate tests). Fresh per-app npm ci keeps lockfile hashes identical. All production audits are zero; PR delta gate passes for current backend dev baseline.
Follow-up: GitHub CI green status awaits publication; no new commit/push authorized. Backend 29 high/5 moderate development audit findings remain tracked in KI-018 for scoped remediation; do not force major upgrades or blanket-allow them in the production gate.


### D-021 Retire the obsolete React Router audit exception (2026-10-13)
Type: DOC-DRIFT / DECISION
Context: Owner asked to fix any exception that can be resolved now. Both frontend lockfiles already contain react-router/react-router-dom 7.18.2. The current GitHub advisory https://github.com/advisories/GHSA-qwww-vcr4-c8h2 lists 7.18.2 as patched, contradicting the older SECURITY-NOTES assertion that a v8 migration was required.
Chosen: Remove both active exception entries; `.github/audit-exceptions.json` is empty. Correct SECURITY-NOTES and P0 requirements. Keep the scoped evaluator infrastructure reversible, with hypothetical 7.18.1 fixtures; add a regression assertion that the production exception list is empty and a vulnerable fixture fails without an exception.
Verification: consumer/admin full audits including dev dependencies report zero vulnerabilities; all three production gates pass with no exceptions. No runtime routing changes required.
Follow-up: backend development findings remain tracked separately in KI-018; no production exceptions remain.


### D-022 Current advisory review and compatible portfolio fixes (2026-10-13)
Type: DOC-DRIFT / DECISION
Context: Owner asked to verify the other advisory claims against current records and explicitly authorized portfolio security patches despite the original portfolio scope exclusion.
Chosen: Correct SECURITY-NOTES ranges and upstream claims against GitHub advisories. UUID/PostCSS overrides still cover their referenced findings; Next 15 patches exist, contrary to the old "only Next 16" claim. Patch portfolio to Next 15.5.27, Sharp 0.35.5 and source-map-js 1.2.2; raise Next/Sharp minimum constraints. Raise the consumer Sharp override floor to ^0.35.5 without changing its already-patched installed version. Retain portfolio PostCSS override because Next 15.5.27 still pins 8.4.31.
Verification: full frontend/portfolio audits are zero; portfolio builds and serves home/pricing/health with HTTP 200; patched Sharp decodes SVG, resizes and encodes PNG. Backend dev findings correspond to two unpatched leaf advisories (braces <=3.0.3 and sprintf-js <=1.1.3), not 34 independent vulnerabilities; document exact sources and retain KI-018 rather than invent a patched version or suppress the findings.
Follow-up: scoped investigation of replacing/migrating the development graph remains KI-018; no commits or pushes authorized for this phase.


### D-023 Publish the P0 checkpoint as a draft PR (2026-10-13, owner instruction)
Type: DECISION
Context: Owner explicitly authorized committing this phase, pushing fix/known-issues, and opening a draft PR to verify the checkpoint.
Chosen: Publish the locally verified P0 guardrails, Node 22 alignment, compatible security patches and advisory corrections. The draft PR includes the earlier known-issues commit already on this branch. Keep P0 completion pending until the required GitHub CI jobs pass; investigate and fix any failures immediately under D-018.
Follow-up: record the actual PR/CI result in the phase tracker after verification.


### D-024 Phase P0 checkpoint verified on GitHub (2026-10-13)
Type: DECISION
Context: Owner authorized publication; phase commit 113abfb pushed to fix/known-issues, draft PR https://github.com/PosBuzz/PosClient/pull/40 opened against main.
Verification: https://github.com/PosBuzz/PosClient/actions/runs/38293064702 completed successfully with all 17 jobs passing: static/typechecks, app builds, Docker builds, backend unit tests, production audits, PR dependency reviews and gate regression tests. Phase P0 exit criteria are satisfied; master and phase trackers are updated. No merge or deployment performed.
Follow-up: B1 backend test harness is the next sequential phase. Keep PR #40 draft as the verified checkpoint.


### D-025 Backend harness implementation and doc corrections (2026-10-13, B1)
Type: DECISION / DOC-DRIFT
Chosen: Extract production setup verbatim into configureApp; use real migrated Postgres 17 with Testcontainers 12 and a TEST_DATABASE_URL compose fallback. Guard destructive resets with NODE_ENV=test and a test-qualified database name. Keep the old scaffold as .ts.disabled, preserving reversible removal. Fixtures use sequence suffixes and schema-derived types; purchase histories share batch timestamps, sale DTOs use catalog pricing. JWT helpers forward Secure cookies manually and pair CSRF token/signature.
Corrections: /auth/client wraps its identity in body.user; helper defaults explicitly use Host localhost. Opt-in Redis/RabbitMQ tests have a separate test:infra config and CI job; no failures are deferred or marked failing. Original 35 unit tests remain unchanged.
Verification: all BE-HARN-001…018 pass three consecutive times (9 int + 7 e2e + 2 infra); lint/typechecks are 0/0 in all apps and backend builds. New test dependencies add no audit findings. A clean source copy with fresh npm ci passes 35 unit + 9 integration + 7 HTTP tests using automatic Postgres provisioning. The Compose TEST_DATABASE_URL fallback passes the same tests and its resources were removed afterward.
Follow-up: B1 CI verification requires publication; do not tick the master B1 tracker before that evidence exists.

### D-026 Fix runtime failures discovered by B1 immediately (2026-10-13)
Type: DECISION
Context: Enabled RabbitMQ tests passed publishing but Jest stayed alive after close because the connection close handler scheduled reconnects. A focused direct-IP HTTP test returned 401 because 127.0.0.1 was misclassified as tenant subdomain 127.
Chosen: Cancel/deduplicate reconnect timers and suppress reconnects on intentional close; prove no 5-second retry is scheduled during app shutdown. Recognize IP addresses in the shared subdomain parser; direct-IP auth now succeeds while mismatched tenant-origin auth still returns 401. Fix the test's queue race by awaiting real consumer delivery, with the payload assertion retained. These two scoped runtime fixes supersede B1's original seam-only restriction under the owner's D-018 immediate-fix policy.
Verification: real Redis/RabbitMQ and HTTP/Postgres suites pass three times with no open-handle warning or force-exit. Original 35 unit specs and all static checks remain green.
Follow-up: none for these repaired defects; B1 publishing/CI checkpoint remains pending.


### D-027 Publish the B1 checkpoint (2026-10-13, owner instruction)
Type: DECISION
Context: Owner explicitly authorized “Commit and push B1 checkpoint” to draft PR #40.
Chosen: Commit and push the locally verified harness, two immediate runtime repairs, CI jobs and phase documentation. Keep B1 completion pending until GitHub CI passes, and repair any CI failures immediately under D-018.
Follow-up: record the CI run and update phase completion after verification.


### D-028 B1 checkpoint verified on GitHub (2026-10-13)
Type: DECISION
Context: Owner-authorized B1 implementation commit 3f94838 was pushed to draft PR https://github.com/PosBuzz/PosClient/pull/40.
Verification: https://github.com/PosBuzz/PosClient/actions/runs/38297463078 passed all 19 jobs, including real Postgres integration/HTTP and optional Redis/RabbitMQ suites. Original unit tests, static checks, builds, Docker builds, audits and dependency reviews remain green. B1 exit criteria are satisfied; phase and master trackers are updated.
Follow-up: B2 pure-logic unit tests are the next sequential phase. Keep PR #40 draft; no merge or deployment performed.


### D-029 B2 testability seam and phase corrections (2026-10-13)
Type: REFACTOR / DOC-DRIFT / DECISION
Chosen: Extract the three promotion math helpers without logic changes; compare original and extracted bodies ignoring only method/export declarations and indentation. Service call sites invoke the exported helpers directly. Add seeded fast-check 4 properties with 1,000 examples each. Keep the seam separate when commits are authorized.
Corrections: Existing KI-016 already supplies specific Prisma messages and 404/400 for P2025/P2018; test these instead of restoring stale technical errors. KI-021 already fixes IPv4 hosts. cache-invalidation.util.ts is empty, so BE-UTIL-002 is retired as DOC-DRIFT rather than inventing tests or code. The purge SCOPE lives in consumer-purge.service.ts and covers indirect models only; generated direct consumer_id models must match the complete reachable purge graph.
Runner: Load reflect-metadata before DTO imports. Set unit rootDir to backend, restrict roots to src and prisma-client-exception, and include external filter specs/coverage. Thresholds use working-directory paths; keep 100/95 numeric targets. Name the two pure inventory files explicitly: stock-mutation performs I/O and its real atomicity/conservation coverage belongs to B3. This corrects phase scope, not a lowered threshold.
Behavior evidence: A zero rewards cap is normalized to null by the DTO, serialized as absent by consumer rewards settings, and ignored by the earning service. BE-DTO-680 pins that intended convention. Return quantities are service-filtered and shipping-only returns are supported; test the existing numeric constraints without inventing a blanket nonempty-return restriction. Multilevel hosts take the first label (existing explicit source comment); retain the characterization pending owner intent.
Follow-up: Publication and green CI are required for B2 completion; B3 remains responsible for real stock-mutation invariants.

### D-030 Repair defects exposed by B2 (2026-10-13)
Type: DECISION
Context: BE-UTIL-001 failed because JSON.stringify(undefined) returned undefined despite the helper's string return contract. BE-DTO-005 proved an empty sale passed DTO validation; the sale creation service also lacked a nonempty guard. BE-PEF-008 found “An user” and “An unit” in duplicate messages.
Chosen: Fall back to String(error) when JSON serialization yields undefined. Reject empty sales at the DTO and at the service before I/O, with a specific message. Select “A” for user/unit nouns while preserving the existing vowel article mapping. Keep all regression assertions passing normally under D-018.
Verification: Unit coverage is 100% across the scoped targets. Real HTTP/Postgres tests reject empty sales without sale/item/payment/audit writes and return a specific safe duplicate-product message. All three apps have lint 0 errors/0 warnings and clean typechecks; backend builds. All 261 unit tests pass three times with 100% scoped coverage, and 9 integration + 9 HTTP + 2 optional-infrastructure tests pass. Fresh npm ci keeps the lockfile hash identical and passes the exact CI coverage command; the dependency delta gate finds no added findings.
Follow-up: none for the repaired defects; B2 publication/CI remains pending.


### D-031 Publish the B2 checkpoint (2026-10-13, owner instruction)
Type: DECISION
Context: Owner explicitly authorized “Commit and push B2 checkpoint” to draft PR #40 after local verification.
Chosen: Commit the verbatim promotion extraction separately, then commit/push the remaining tests, immediate repairs, coverage gates and phase records. Verify all GitHub jobs before marking B2 complete; repair any failure immediately under D-018.
Follow-up: record the actual GitHub CI run and advance the sequential tracker only after it is green.


### D-032 B2 checkpoint verified on GitHub (2026-10-13)
Type: DECISION
Context: Owner-authorized extraction 2cb5bce and B2 implementation a9b82b8 were pushed to draft PR https://github.com/PosBuzz/PosClient/pull/40.
Verification: https://github.com/PosBuzz/PosClient/actions/runs/38299671151 passed all 19 jobs. Unit CI enforces the coverage floors; real Postgres/HTTP, optional Redis/RabbitMQ, all app static checks/builds, Docker builds and dependency gates remain green. B2 exit criteria are satisfied; phase and master trackers are updated.
Follow-up: C1 consumer test harness is next in the master execution order. PR #40 remains draft; no merge or deployment performed.
