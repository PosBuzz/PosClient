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


### D-033 Consumer test harness and compatibility fallback (2026-10-13, C1)
Type: FALLBACK / DOC-DRIFT / DECISION
Context: MSW 3.0.3 peer resolution requires TypeScript >=5.9 while consumer is on 5.7. Vitest 5 removed describe.sequential; antd modal visibility stays in CSS animation styles because jsdom does not finish CSS animations.
Chosen: Use the documented MSW 2 fallback (2.15.0, TypeScript >=4.8), keep Vitest/coverage 5.0.4 and jsdom 30.1.2, use `{ concurrent: false }`, and disable motion only in renderWithProviders. Preserve real controls/interactions, visibility assertions and strict unhandled-request errors. Keep test noUnusedLocals/noUnusedParameters enabled, include Vitest config in node typechecks, and mirror the actual provider order including HelmetProvider.
Isolation: reset auth/message/modal stores, clear owned query clients and browser storage, reset MSW handlers, unmount React roots. Temporary typed auth/CSRF/subdomain contracts use endpoint constants and remain marked for replacement in B5/C4. Production QueryClient options extraction is deferred to C3, where it is needed.
Verification: seven smoke/isolation tests pass three times with coverage reporting; fresh npm ci preserves the lockfile hash and passes the exact CI command. Consumer build/test-aware typecheck/lint pass, all-app typechecks pass, and full audit is zero. No production source changes. Ignore generated coverage assets in ESLint (their bundled directives otherwise produce warnings); source lint rules remain unchanged.
Follow-up: GitHub CI verification and phase tracker update; C2 introduces calculation coverage floors.

### D-034 Sequential checkpoint publication and overlap (2026-10-13, owner instruction)
Type: DECISION
Context: Owner authorized committing completed phases and starting the next phase while checking CI for the preceding checkpoint.
Chosen: Publish locally verified C1 to draft PR #40, start C2 during its CI run, and record completion only when CI is green. This authorization also covers subsequent verified phase commits/pushes. Never defer a CI/test failure; repair it immediately under D-018. Keep each phase's implementation separately committed and maintain the master execution order.
Follow-up: record the actual C1 CI result while progressing C2.


### D-035 C1 checkpoint verified while C2 progresses (2026-10-13)
Type: DECISION
Verification: C1 implementation 634c2ee passed all 20 jobs in https://github.com/PosBuzz/PosClient/actions/runs/38301291165, including consumer coverage reporting, all-app static/build/image checks and the existing backend/dependency gates. Phase and master trackers are updated.
Follow-up: C2 calculation tests began while C1 CI ran, as authorized in D-034. No merge or deployment performed.


### D-036 C2 calculation tests and immediate repairs (2026-10-13)
Type: DECISION / REFACTOR
Chosen: Pin every sale-item, totals, promotion-validation, promotion-helpers, formatter, payment-provider, search and subdomain behavior with ID-tagged tests and seeded fast-check properties. Repair KI-025 (negative/over-capacity discounts, rounded INCLUSIVE base) and KI-026 (IPv4 hosts) immediately under D-018; the regression tests pass normally. CO-CART-008 and CO-TOT-030 therefore assert clamping rather than `it.fails`. CO-TOT-012 (tax before discount) stays a characterization pending owner intent.
Coverage: per-file floors from the phase doc are enforced in vitest.config.ts. The unreachable redundant fallback in enrichCartForPromotion (`!changed && currentSubtotal < minPurchase`, already handled by the earlier min-purchase branch) is excluded with a v8 ignore and comment rather than testing dead code.
Verification: lint 0/0, typecheck and build clean, `npm run test:cov` passes three times.
Follow-up: record CI result; X1 turns the subdomain and sale-totals tables into shared fixtures.


### D-037 C2 checkpoint verified on GitHub (2026-10-13)
Type: DECISION
Verification: C2 commit 51c9b02 passed all 20 jobs in https://github.com/PosBuzz/PosClient/actions/runs/38303007404, including the consumer coverage floors. Phase and master trackers updated. No merge or deployment performed.
Follow-up: X1 cross-layer contracts (sections 1-3) next.


### D-038 X1 sections 1-3 and immediate repairs (2026-10-13)
Type: DECISION / REFACTOR / DOC-DRIFT
Chosen: `contracts/` holds hand-written pricing, subdomain, promotion and sale-total fixtures plus consumer-generated payload files. Consumer, backend unit and backend Postgres tests all read the same files. Seam: `toSalePayloadItems` extracted from the POS, add-sale and add-quotation pages (identical three mappings, pure move). The two sale-total payload files are generated by the consumer (`UPDATE_CONTRACTS=1`) and replayed by `SalesService.create`; hand-written expected totals are asserted on the consumer side, so the chain is not circular.
Findings fixed under D-018: KI-027 (decimal tax rate cannot be stored), KI-028 (float total made paid sales partial), KI-029 (dead admin permission). Test tsconfig gains node types so contract tests can read fixtures.
Asymmetries (written down as required): (1) `customer_usage_limit` is enforced only by the backend (fixture X-PROMO-040 has expected_frontend and expected_backend). (2) Backend derives promotion usage from sale rows; the consumer reads stored counters. Fixtures give the backend that many prior sales.
QUESTION: `sales.service.ts#create` evaluates a top-level `applied_promotion_id` using the discounted `line_total`, while the per-item check uses unit_price x quantity. A min_purchase promotion could pass on the POS and be rejected there. The current pages do not send the top-level id, so this is latent; B3 should probe it.
Random carts: 200 carts, seed 20261012, 1-5 lines, integer tax 0-25 (catalog column), seeded by fast-check.
Deferred inside X1 until their prerequisites exist: X-ENDP-001/002/004 and X-REQ-* (need B5 routes.json and C4/A2 request files) and X-TYPE-* (need B5 response contracts). X-ENDP-003 and X-PERM-* run in the new static `contracts` CI job.
Verification: consumer lint, typecheck, build and test:cov (three runs) clean; backend 299 unit, 52 integration and 9 e2e tests pass, lint and build clean.
Follow-up: record the CI result; X1 stays open (partial) until the deferred sections land.


### D-039 X1 sections 1-3 verified on GitHub (2026-10-13)
Type: DECISION
Verification: commit 3f5cd2c passed all jobs in https://github.com/PosBuzz/PosClient/actions/runs/38305070818, including the new static `contracts` job, the 200-cart replay in backend-integration and the contract tests in consumer-tests and backend-unit. X1 remains open only for the sections that need B5/C4/A2 outputs (D-038). No merge or deployment performed.
Follow-up: B3 domain integration (invariant net first).


### D-040 B3 domain integration (2026-10-13)
Type: DECISION / DOC-DRIFT
Chosen: A SQL-only invariant net (`test/helpers/invariants.ts`: INV-01…13) runs in `afterEach` of every B3 file through a shared `newWorld` helper that also snapshots a bystander tenant; BE-NET-001…006 prove it catches tampering. Services come from the real DI container against Postgres. Covered: sales (create, pricing checks, quotations, deliveries, credit, promotions, soft delete/restore, concurrency), returns and exchanges, inventory (batches, adjustments, transfers, summaries), payments, vendor payments, rewards, customers, vendors, branches, categories/brands/units/tags, operational costs, support tickets, promotions, products/variants, spreadsheet imports and the super-admin flows (plans, consumer lifecycle, billing periods, purge, account data import). BE-ADM-006 (backup/restore) stays skipped per the phase doc.
Defects fixed under D-018 (each with a normal regression test): KI-033…045. The net itself found KI-030 (batch moved into another tenant's branch) and KI-044 (import without audit).
Characterizations kept (confirm intent later): sales never split a line across batches (BE-SALE-005); settling a due sale later earns no reward points (BE-PAY-002); a return item without a batch does not restock (BE-RET-019); a batch created without payments counts as fully paid (BE-INV-010).
Doc-drift: several `HttpException` branches in plans, billing and product-name handling are unreachable because Prisma duplicate/not-found errors are deliberately rethrown for the HTTP filter (KI-016 design). Tests assert the Prisma error and the filter's readable message instead; removing the dead branches is a cleanup for X4.
QUESTION: vendor summary totals only cover the page of batches requested (findOneWithDetails paginates before totalling); promotion sales report sums sale discount, not promotion discount. Both belong to B4 reconciliation.
Verification: lint and build clean; 307 unit tests pass with coverage thresholds; 277 integration tests pass three runs; 9 e2e tests pass.
Follow-up: CI result for the B3 commit; then B4.


### D-041 B3 checkpoint verified on GitHub (2026-10-13)
Type: DECISION
Verification: commit 57bee35 passed all jobs in https://github.com/PosBuzz/PosClient/actions/runs/38308437854. B3 exit criteria are satisfied; trackers updated.

### D-042 B4 report reconciliation (2026-10-13)
Type: DECISION / DOC-DRIFT / FALLBACK
Chosen: The canonical business day is built through the services (`test/integration/reports/scenario.ts`). Prisma stamps `sale_date`/`created_at` from the database clock, so JS `Date` is faked only while a service runs (sale numbers, reward expiry) and the stored timestamps are then pinned with SQL. Every expected value is a literal with its arithmetic beside it. The suite runs under TZ=UTC (`test:int`) and TZ=Asia/Dhaka (`test:int:tz`, added to the `backend-integration` job). Tests read the zone through `Intl` because jest's `process.env` is a copy.
Scenario extensions to the phase doc: S0 is only part-paid (30 of 80) and the customer pays the other 50 on the day, so `due_collected` is exercised (a payment on a same-day sale counts as period-sales collected, not due collected: DOC-DRIFT for the doc's "due_collected (S3 rest)"); E9 pays 25 of S3's remaining 45 so a due balance remains (20); all sales name the admin as `served_by_id` so user stats cover them (sales without a server are skipped by design).
Defects fixed under D-018: KI-046 (promotion counted twice in EOD total discount), KI-047 (variant stats subtracted discounts from an already net line total).
Pinned intentional differences: the dashboard counts refunds when paid (R0 included), the sales list attributes them to the original sale (R0 excluded): the difference equals R0's refund (BE-RPT-106). EOD `total_collected` counts payments created in the period, the dashboard `today_collected` sums `received_amount` of the day's sales: they differ by the collections on older sales (50). Dashboard weeks run Saturday to Friday.
QUESTION: EOD `non_cash_sales` is total sales minus cash collected (includes unpaid balance), pinned as-is; `net_sale_amount` subtracts refunds of older sales from today's sales (refund-date attribution) by design.
Verification: 33 report tests pass under Asia/Dhaka and 30 under UTC.


### D-043 B4 verified on GitHub and B5 security, tenancy and robustness (2026-10-13)
Type: DECISION / DOC-DRIFT / QUESTION
B4: commit f9e0cea passed all jobs in https://github.com/PosBuzz/PosClient/actions/runs/38309445550, including the new `test:int:tz` step. B4 exit criteria are satisfied except §5 (response-shape snapshots), which belongs with B5 §6.
B5 chosen: `contracts/routes.json` (268 routes) is generated from `DiscoveryService` metadata and compared in CI (`UPDATE_CONTRACTS=1` rewrites it). Policy lives in `test/e2e/security/public-routes.ts`: every unauthenticated route and every authenticated route without a permission has a written reason. Sweeps: permission matrix (712 generated cases), leak sweep over all 96 client GET routes, direct-reference sweep with another shop's ids over every parameterized route, body-id swaps over 15 POST/PATCH routes (each with a proving control request), and a robustness sweep (empty, mistyped and junk-id input on every authenticated route, backup/restore excluded because it would run a real dump). Defects fixed under D-018: KI-048…057.
Seams: none beyond tests. Production changes are the fixes above.
QUESTION (owner decides): `GET /api/v1/metrics` is public and exposes database-pool metrics; `POST /ai/auto-description` and `description-feedback` need only a login (no add/edit-product permission); `POST /auth/login-user` also returns the access token in the JSON body although it is an HttpOnly cookie; `process-credit-refund` and `adjust` let a user with `customers` add reward points without a matching refund; `ClientAuthGuard` accepts a token whose subdomain differs when the request carries no subdomain at all (direct API access), which is safe only because every query filters by the token's consumer id.
DOC-DRIFT: BE-ROB-001/002 originally expected per-route KI + `it.failing`; every failing route was fixed instead (D-018). `due_collected`, `KNOWN_5XX` and `KNOWN_VIOLATIONS` stay as empty, enforced lists.
Pending in B5: §6 response-shape contracts (`contracts/responses/*.json`, BE-CONTRACT-*), admin-side tenancy/secret sweep, and the CI step guarding `git diff contracts/`.
Verification: lint, build and coverage floors pass; 323 unit, 306 integration (33 under Asia/Dhaka) and 828 e2e tests pass (e2e twice).


### D-044 B5 response contracts and final sweeps (2026-10-13)
Type: DECISION / DOC-DRIFT
B5 checkpoint 83ed86f passed all jobs in https://github.com/PosBuzz/PosClient/actions/runs/38311388603.
Chosen: `contracts/responses/*.json` (18 files) are the normalized HTTP bodies of the canonical business day, compared in `test/e2e/contracts/responses.e2e-spec.ts`. Ids stay numbers, decimals stay strings, full ISO datetimes collapse to one instant, unordered lists sort by id (or content when they have no id). BE-CONTRACT-000 proves two builds are identical; that needed `resetSequence()` and sequential permission upserts in the factories, because concurrent upserts numbered permissions differently each run. Contracts must be generated through `npm run test:e2e` (it sets TZ=UTC): generating them with a bare `npx jest` in another zone wrote a different EOD. The backend-integration job now fails if the tests leave `contracts/` dirty.
Safety: the backup and restore routes (`GET /admin/backup`, `POST /admin/restore`) are excluded from every sweep through one tested list (`NEVER_EXECUTE`, BE-ROUTE-019). An early version of the exclusion used the wrong path and the sweeps did call them against the throwaway database; corrected before any commit. Defects: KI-058, KI-059.
DOC-DRIFT: the path names in the phase doc differ from the code (`/consumer/sales/reports/eod`, `/consumer/dashboard/analytics`, `/consumer/promotions/active/list`, `/consumer/payments/partial-sales`, `/consumer/users/plan-permissions`); the contracts use the real ones.
Verification: 323 unit, 306 integration (33 in Dhaka) and 851 e2e tests pass (three e2e runs); lint, build and coverage floors pass.
Follow-up: CI for this commit; X1 sections 4-5 (request replay and type contracts) can now be built on routes.json and responses/.


### D-045 B6 schema and migration safety (2026-10-13)
Type: DECISION
Chosen: `test/integration/schema.int-spec.ts` asserts the migrated database has an empty `prisma migrate diff` against `schema.prisma` (BE-SCHEMA-002, with BE-SCHEMA-008 proving the check reports a deliberate difference), migration folder names and files, the PostgreSQL lock, that the real `prisma/seed.ts` runs on a migrated database and the seeded super admin and tenant admin can log in, and that every tenant table leads an index with `consumer_id` (the exceptions list starts empty because none are missing today). `scripts/check-destructive-migrations.mjs` (with regression tests in the guardrail job) fails a branch that adds DROP TABLE, DROP COLUMN, ALTER COLUMN ... TYPE or TRUNCATE without an `ALLOW_DESTRUCTIVE.md`; the `backend-integration` job now checks out full history for it. SQL comments are ignored so a note cannot trip the guard.
Verification: 7 schema tests pass; 3 guard tests pass; the guard sees this branch's one added migration (an index rename, not destructive).
Follow-up: CI result; C3 consumer API, stores and hooks next.


### D-046 B5 and B6 verified; C3 first checkpoint (2026-10-13)
Type: DECISION / REFACTOR / DOC-DRIFT
Verification: commit 418419f (B5 contracts, B6 schema guards) passed all jobs in https://github.com/PosBuzz/PosClient/actions/runs/38312797811. B5 and B6 exit criteria are satisfied; trackers updated.
C3 so far: HTTP client, React Query defaults, 123 API-function cases checked against `contracts/routes.json` by method and path, endpoint parity both ways (X-ENDP-001/004), print agent, auth store, route permissions and menu. Defects fixed under D-018: KI-060…062.
Seams (pre-approved, behavior unchanged): `queryClientOptions` moved to `src/queryClientOptions.ts` instead of being exported from Providers.tsx (importing Providers pulls in the whole app); the sidebar menu moved to `src/menuItems.tsx` with a pure `visibleMenuItems` filter. Harness: jsdom's Blob lacked `stream()`, which hung every `responseType: "blob"` request under MSW; a small polyfill in `src/test/setup.ts` fixes it for all tests.
Notes: `RequirePermission` gained list support (any one permission) so a route can mirror the menu's rule. `contracts/unused-routes.json` records the four tenant routes the app never calls; the two credit routes are a QUESTION (a customers-permission user can burn or add points through them without a sale or refund). The route-permission snapshot `src/__snapshots__/route-permissions.json` makes any permission change visible in review.
Verification: lint, typecheck pass; 421 consumer tests pass twice.
Follow-up: C3 cache invalidation, hooks and coverage floors.

## D-047 C3 cache invalidation, hooks and coverage floors (2026-10-13)
Decision: a static test (CO-CACHE-002) lists the exact pages that create, delete, restore, refund, settle or change the status of a sale and requires each to call `invalidateSalesReports`; adding a new such page fails the test until it is added to the list. Hook tests (CO-HOOK-001..005) cover sale manager, promotion manager, barcode scanner and confirm-delete. vitest now enforces src/api ≥90%, src/stores ≥90%, src/hooks ≥80% lines and 100% for RequireAuth/RequirePermission.
Verification: lint, typecheck pass; 447 consumer tests pass with coverage floors.

## D-048 C4 transaction flows and CI repair (2026-10-13)
Type: DECISION / DOC-DRIFT
Chosen: Add sale compares captured requests with POS recordings, excluding only `is_online_order` and `is_delivery_later`. Quotation creation records a payment-free payload. Conversion starts from View quotation, navigates to Add sale and posts `quotation_id`; its fixture derives a quotation from the backend sale-detail shape because no quotation response contract exists yet. Returns record cash and exchange requests; partial payments record the remaining balance. Number inputs are overtyped rather than cleared (KI-065).
DOC-DRIFT: RET-004's spec describes choosing an exchange variant/batch and sending `exchanges[]`; the current UI instead looks up a replacement sale and posts `exchange_sale_id` plus an EXCHANGE payment. The test exercises that actual flow. POS-013 remains covered by CO-ROUTE-003.
CI repair: POS-011 asserts each sale's success separately, waits for the first toast to disappear, and asserts one then two captured sale requests. This preserves both sale-success assertions without depending on expiring toasts being visible together. Backend BE-SALE-030 exposed inconsistent zero-stock wording; KI-067 standardizes it without changing the concurrency test or stock logic. KI-066 catches the return form's already-reported mutation rejection.
GitNexus: index fb549f6, same checkout; creation impact LOW (SalesController.create), conversion and lazy return page UNKNOWN resolved through caller searches. Change analysis reports medium risk and the CreateReturn → CurrencyIcon flow; no partial/truncated flags.
Generated root AGENTS.md and CLAUDE.md remain untracked; neither is part of this checkpoint. C4 remains in progress until the remaining flows, smoke tests and page/global coverage gates pass.
Verification: consumer lint and test typecheck pass; 474 consumer tests pass twice under TZ=UTC. Backend lint and all 37 sales integration tests pass with a disposable Docker database.

## D-049 C4 reports, inventory, auth and real response fixtures (2026-10-13)
Type: DECISION / DOC-DRIFT
Chosen: Added backend-generated contracts for user/variant sales stats, quotation detail, inventory products/variants/batches, branches and expiring batches. View quotation conversion now uses the real quotation contract. The backend generator checks determinism and response parity for every additional file. Inventory flows record batch creation and transfer creation, check complete/cancel confirmation and simulate a server shortage after stock changes between loading and adjustment submission. Auth flows mount AuthLoader with real pages and route guards to exercise CSRF, login, auth refresh, state.from and tenancy redirects. The shared auth fixture now comes from auth-client.json; KI-068 corrects the consumer type to match it.
DOC-DRIFT: VS-001 must display line_total itself: backend line_total is already net of discounts (KI-047), so the old spec's subtraction would reintroduce double-discounting. DASH-001 checks all nine daily summary fields displayed by the page; weekly summary fields are not rendered. STATS-002 and INV-005/006 are additional unique IDs for variant stats, expiring inventory and transfer lifecycle actions. Existing KI-065 input behaviour is retained.
CI: 5f386da passed consumer assertions and backend jobs but missed the existing sale-item.utils 100% branch floor introduced by repricing. CO-SALE-REPRICE-002 adds a zero-price/absent-tax case; the threshold is unchanged. Full coverage is part of this checkpoint's verification. Every-page smoke coverage and the C4 page/global floors remain pending.
Verification: all 493 consumer tests pass with existing coverage floors and pass again under TZ=UTC; lint and test typecheck pass. All 28 backend response-contract tests pass, including the repeated-scenario determinism check. GitNexus change analysis reports LOW, zero affected execution processes and no partial/truncated result after rerunning with limit 1000.

## D-050 C4 smoke expansion and coverage work (2026-10-13)
Type: DECISION / DOC-DRIFT
CI: f29f0d3 passed every job in https://github.com/PosBuzz/PosClient/actions/runs/38323093489.
Chosen: Shared smoke helpers drive real list/table/drawer components through empty results, a populated result and the primary create action for seven master-data screens. Read-only lists use backend response contracts and assert no console errors; detail/form screens exercise their applicable loaded state and save action. POS layout settings stores a browser preference, so it has no backend request. Added real product/customer detail, product list, online order, pending delivery, purchase balance, stock-by-variant, quotation list and daily-target contracts. The contract collector gives P1 a target of 5 only immediately before collecting daily-target and flags S6 as an online order only before collecting online-order contracts; earlier recordings remain unchanged. Determinism is checked by rebuilding the scenario twice.
Additional flows: POS-014/015 drive restaurant checkout and options; PAY-004/005 guard zero/empty and split payments; SALE-003/004 guard split-payload parity and cart preservation after rejection. KI-069 fixes deprecated antd APIs found by the smoke checks. No console-error filter or threshold relaxation is introduced.
GitNexus UNKNOWN findings for the settings/product components were resolved by their direct lazy route/component imports. Root generated instructions remain untracked. C4 is still in progress; the remaining directories and 70% page floors must pass before its tracker is checked off.
Verification: all 526 consumer tests pass twice with coverage; global lines 54.53%. Enabled global ≥50%, returns ≥70% (76.11% measured) and partial-payments ≥70% (75.86% measured). POS (58.44%) and Add sale (66.06%) floors remain pending additional interactions. Backend response contracts pass all 38 cases. Lint and test typecheck pass.
Graph limitation: after reindexing, detect-changes reports CRITICAL / 219 flows for the response collector's inline `path` callbacks. The warning was reported before committing. Both context and Cypher return empty ids for all 36 collector callbacks, so their identity/caller mapping remains unresolved, not a clean low-risk result. Text search confirms the callbacks are invoked only by collect in this test file and are not imported by production code; the staged diff contains no backend production changes. Frontend production changes are confined to the three deprecated antd prop migrations, verified by their real-page smoke tests. The full graph check has no partial/truncated flag; the display caps its process list. This index limitation must not be interpreted as an all-clear for future production changes.

## D-051 C4 receipt, cancellation and user/role regressions (2026-10-13)
Type: DECISION / DOC-DRIFT
Chosen: POS-016 drives auto-print with the real sale-detail item/payment shape, rather than the minimal mutation response; POS-017 confirms cancellation resets without posting. SALE-005/006 cover barcode input, unpaid and part-paid checkout. User and role smoke tests retain zero-console-error assertions. KI-070 corrects form lifecycle and role-change clearing; the user test checks that changing roles still removes previously selected branch access. Temporary warning-stack diagnostics were removed before committing.
GitNexus returned CRITICAL / 659 upstream symbols for each DrawerForm, with missing symbol ids and unrelated backend flows. The warning was reported before editing. Direct import searches bind each drawer to its respective Users/Roles page; the change is confined to their initialization effects and branch-selection clearing. The unresolved graph identity limitation remains recorded; it is not treated as low risk.
POS-018/019 cover restaurant customer/staff/shipping and quantity-button discount scaling. POS-020 then confirmed KI-071: adding the same menu product again lost per-unit scaling. The shared helper gains an opt-in flag set only by POS/Add sale, preserving quotation and overall-discount callers. GitNexus reported CRITICAL (575 symbols/107 flows for the helper and 659 for wrappers) before the edit; text callers include those pages, promotion hooks and helper tests, and full coverage gates are required for this change.
Additional guards: POS-021 removes a zero-quantity restaurant line; POS-022 reports an HTTP printer rejection without retrying the sale; SALE-007 proves KI-071 on Add sale. A resource-contention run timed out POS-003/004 and RET-004 at the unchanged 15-second limit, cascading into RET-006 after cleanup. Vitest workers are capped at two to keep antd renders from competing across many pages; assertions and timeouts are unchanged. Coverage runs must be sequential because Vitest owns a report-directory lock.
Graph repair: a cold rebuild (`analyze --force --no-parse-cache --index-only`) restored the missing ids and production symbol mapping. The helper's authoritative impact is HIGH, 11 upstream symbols / four consumer processes; this is not waived by the LOW shared axes. Full change analysis reports HIGH / six expected POS/Add sale processes and identifies both drawers and the helper, with no partial/truncated flag. Earlier CRITICAL warnings are preserved above as the pre-edit evidence and explanation for the rebuild.
Verification: all 539 consumer tests pass twice with coverage under TZ=UTC. Global lines 57.02%, POS 70.42%, Add sale 71.12%, returns 76.11%, partial payments 75.86%; all required C4 thresholds are enabled and pass, including the existing pure-helper 100% gate. Lint/typecheck pass in consumer, admin and backend. 42237fb passed every CI job in https://github.com/PosBuzz/PosClient/actions/runs/38324845129. C4 remains open for its ten remaining smoke directories and the every-page guard.
Flake verification: POS-003/004 and RET-004 pass together in 20 consecutive isolated runs after the worker cap (60 executions, no timeout or quarantine).


## D-052 C4 remaining page smoke tests and admin harness start (2026-10-13)
Type: DECISION / DOC-DRIFT
Chosen: Added smoke tests for the last ten consumer page directories and a recursive every-page guard. The backend collector creates adjustment/vendor/receipt data only after the earlier contract calls, preserving their recordings; new responses are generated over real HTTP and checked by a repeated scenario. Barcode Printing uses the authenticated store instead of an invalid redundant auth request (KI-072). Receipt presets use supported Select/Collapse APIs (KI-073), preserving all sections and payload defaults.
CI f93b9c8 failed three existing long flows at the unchanged 15-second limit. The suite now uses one worker in CI to reduce contention, retaining two locally. Assertions, timeout and coverage floors remain unchanged. The first resumed CI-mode coverage run passes all 551 tests: global lines 64.21%, all four page floors pass. The second full run passes all 551 tests; backend replay passes all 49 response-contract tests. Consumer/admin/backend lint and typecheck pass, and the admin production build succeeds.
Admin A1 uses the same API prefix as the real axios consumer of relative endpoints: http://api.test/api/v1. The example env omits the prefix, while absolute download endpoints normalize it themselves; AD-HARN-004 pins the correct request URL and later E2E builds must supply the prefixed base. New helpers mirror consumer helpers without adding a shared package. All 30 initial admin tests pass with coverage after KI-074 fixes repeated CSRF recovery. Admin routes do have permission gates, contrary to A2's prose; tests will pin actual gates rather than asserting their absence.
GitNexus admin CSRF impact: MEDIUM, 33 upstream symbols, two direct callers (module interceptor and refresh helper), no indexed execution processes. The guard affects request recovery through the shared client; refresh recovery assertions remain green. Generated root instruction files remain untracked.

Final graph check after a cold refresh reports LOW / zero indexed affected processes, 21 changed symbols and no partial/truncated check result. Analyzer reports capped process discovery; zero indexed processes is not proof of no runtime impact. Download endpoint constants are prefixes whose table callers append row ids; X-ENDP-002 validates completed paths. AD-API-020 characterizes axios conflict rejection: the unreachable response-status branch remains a QUESTION, since no evidence supports changing caller semantics.

## D-053 Admin page flows, request replay and meaningful response dates (2026-10-13)
Type: DECISION / DOC-DRIFT
A1 checkpoint 80112bb passed every CI job: https://github.com/PosBuzz/PosClient/actions/runs/38358394595. A2 adds real-page flows for plans, consumers, billing, roles, users, support and login; backup/restore is intercepted by MSW exclusively. Every page directory except portfolio has a test, matching the spec exclusion. Global/page ≥50%, API ≥90% and store ≥90% line thresholds are enabled after measuring 61.02% global, 61.17% pages, 94.90% API and 100% stores. Final gates follow the fixture-date repair below.
DOC-DRIFT: Plans use a multiple Select rather than checkboxes; its complete visible option set is compared with the backend-generated permissions response. The admin test ConfigProvider disables virtual scrolling because jsdom has no layout to reveal off-screen options, preserving real selection and submit handlers. The helper's UNKNOWN graph impact was resolved by its test-only import callers. Consumer subdomain validation currently runs per edit rather than debounced; the test drives the actual control and asserts that taken names block submission. Import targets derive a second account from the backend consumer shape to test source/destination selection; no additional import recording is required by the A2 table. Support tickets are created through the real service before collecting the additional populated/detail fixtures.
KI-075 migrates Home's deprecated Card prop, KI-076 adds restore confirmation, and KI-077 fixes renewal's same-day rounding. Restore preserves the filename explicitly in FormData.append. The MSW XHR→Node Request bridge serializes jsdom File as a blob; the regression asserts original name at append plus the uploaded bytes over HTTP, rather than relying on that bridge's rewritten name. Temporary diagnostics were removed. No real backup/restore requests were made.
X1 §4: every request file must have an explicit case, then replays unchanged over HTTP with a fresh business-day scenario, CSRF, 2xx status, stored totals where recorded and all B3 invariants. The return-exchange recording's UI fixture uses sale id 99: replay creates the matching replacement through SalesService, then assigns that fixture id before dispatch. No payload ids are silently rewritten. All 16 recordings pass (17 checks including the enumeration guard).
KI-078: collapsing every ISO date to one metadata instant had hidden the canonical tenant's billing period ending in 2040 and changed promotion date meaning. Normalize only volatile created/updated/generated metadata and last_reply_at; preserve billing, promotion, sale and return dates. Movement history aliases DB adjustment.created_at as date, so the collector pins this fixture timestamp in PostgreSQL before collection. Repeat-scenario equality is retained. Backend normalization impact UNKNOWN was resolved by its sole collector use and recursive calls; no production serializer changes.
GitNexus pre-edit impacts: Home, BackupRestorePage and Billing DrawerForm UNKNOWN, resolved by their explicit lazy route/direct drawer imports. handleRestore LOW (one parent caller, no indexed processes). Backend collector UNKNOWN, with two local test invocations only. No high-risk warning was waived or interpreted from missing edges. Final graph/verification evidence is appended after the gates.
QUESTIONS retained as characterization: public /test embeds a lead form; removing it needs a product decision. AD-API-020 pins axios's 409 rejection because the response-status branch is unreachable, without inventing a new caller contract. No owner approval was requested for these recorded questions.

A2/X1 request verification: all 50 admin tests pass with coverage floors, 59 backend response/determinism/date checks plus 17 request-replay checks pass over HTTP/Postgres, and all-app lint/typecheck pass. Consumer final-fixture coverage passes all 551 tests (64.24% global lines and all existing thresholds); its second full run also passes all 551 tests. Cold graph rebuild followed by detect-changes reports LOW, zero indexed processes, 29 changed symbols and no partial/truncated result. The analyzer still reports capped entry-point discovery, so missing processes are not treated as a no-impact proof.

Staged change analysis includes all 61 files / 38 symbols, reports LOW with zero indexed affected processes and no partial/truncated result. All checks above are green before this checkpoint commit. CI for the A2 checkpoint is verified after push.

## D-054 X1 response type contracts and shared-model repairs (2026-10-13)
Type: DECISION / DOC-DRIFT
A1/A2 is CI-verified on e588a0a: https://github.com/PosBuzz/PosClient/actions/runs/38362188194. X1 now generates exact response literals for 20 consumer fixtures and admin auth; compiler assignments retain required fields, nullability, primitive values and finite enum members. TypeScript JSON imports widen enum strings and infer null as any, so a readonly JsonShape maps nominal enum values to their actual JSON strings and exact literals are checked against it. ImportShape links the source JSON's field/type structure; generator --check additionally rejects stale copied values/nulls. Both app typecheck scripts and X-TYPE-001/002 freshness tests enforce this. No as-Sale/as-unknown casts or expected errors hide mismatches. Readonly applies to generated fixtures, not production models. Admin consumer/plan pages have no named response interfaces; those type assignments are skipped as expressly allowed by X1 §5, while their request/response page and HTTP replay checks remain active.
KI-079: Numeric cart/submitted-payment models stay separate from stored Decimal/nested sale responses. Product list inventory summaries are typed separately from detail records. Nullable API ids/contacts/metadata are represented as such; absent computed change_amount/refund_amount are optional. CustomerType includes the backend's persisted default regular, preserving the UI's Individual/Business choices. Product form mapping converts nullable category/brand ids to undefined. The currency formatter already Number-coerces strings, so only its parameter type changes; return-view multiplication uses explicit Number conversion. Admin auth no longer requires refresh_token. No business formula is changed by these frontend repairs.
Type checks exposed KI-080 (numeric zero instead of boolean low-stock flags). Its predicate is Boolean-coerced in product and variant detail, retaining ≤ comparison and zero-threshold behaviour. The exact-stock regression initially compared the product fixture collected before a later +1 adjustment against the final DB state; it now verifies current total_stock against an independent batch aggregate, then tests exact/current−1 thresholds. KI-081 then proves that a supplied mismatched tenant id was ignored by the variant service; its detail query is now scoped by product.consumer_id. No standalone route currently exposes the variant helper, and omitted ids retain the existing internal owner lookup.
Pre-edit GitNexus: Sale CRITICAL (61 upstream/30 direct symbols); formatCurrency CRITICAL (27 upstream/26 direct, five processes); both warnings were reported before edits. Other response interfaces: Return LOW/6, Product MEDIUM/26, CustomerSummary MEDIUM/10, Promotion MEDIUM/14, SaleForPayment LOW/5. The product form mapper is LOW/5 (one process). Lazy Products/Barcode/ViewReturn components and private admin User type are UNKNOWN, resolved by their route/local type uses. ProductService.findOne and ProductVariantService.findOne are LOW/7 and LOW/6 lower bounds, with two unresolved receiver sites; direct controller/text calls were checked, and this boundary is not treated as a full no-impact proof.
Proof: the unmodified exact sale literal compiles; four isolated corruptions (missing branch_id, boolean total_amount, invalid sale_type, null sale_number) each fail compilation. Their temporary files are outside the repo. Further X1 totals proofs run in an isolated detached worktree with byte-identical math/service source; the live branch and its tests are never mutated. Baselines pass 13 consumer fixture tests and 12 backend replay tests including all 200 generated carts. Removing shipping from totalAmount fails the shipping fixture and X-TOT-R02. Removing the allocator's last-line remainder makes X-TOT-R01 nonterminating; an isolated process-group watchdog stops it after 20 seconds. This is DOC-DRIFT from the old spec's expected cent mismatch: the current integer-capacity loop also relies on that remainder for progress. It is reported as nontermination, not as an ordinary assertion failure or a passing test. The permanent test timeout/thresholds remain unchanged.
Verification so far: all-app lint/typecheck pass; 78 backend response/replay checks and all 19 product integration tests pass on isolated PostgreSQL; all 51 admin tests pass with coverage floors; first full consumer coverage run passes 553 tests. Final second run, graph check and remaining proof cleanup follow before committing.

Completion additions: X-TOT-R03 now checks the B3 invariant net after the full golden/random replay suite (all 200 carts remain in the DB and every batch is checked). Added real rewards-settings and sale-product type checks, preserving numeric cart input types. API settings/prices accept actual Decimal strings/nulls; the cart mapper normalizes only null image to undefined, covered by CO-SALE-MAP-001. Its pre-edit graph impact is HIGH / eleven upstream symbols / four processes, reported without waiving via LOW shared axes. ProductVariantForSale is CRITICAL / 61 upstream, RewardsSettings LOW/5; the replay helper is UNKNOWN resolved by its one local check invocation. Static contract CI verifies type-fixture freshness and root test:all includes admin.
Proof completion: the named remainder fixture X-TOT-003 also demonstrates nontermination without the last-line remainder; removing shipping fails BE-RPT-102 and BE-RPT-000 as well as the shipping fixture and X-TOT-R02. Restored checkout passes all 13 consumer fixture checks and 24 backend totals/reconciliation checks; git diff is empty and the owned temporary worktree was removed. No deliberate mutant remains in the live workspace.

Final expanded checks: all 13 golden replay cases, including X-TOT-R03, pass. Final HTTP response/replay validation is run sequentially because backend harness processes share test/.tmp/env.json; earlier parallel verification was repeated without parallelism. The first final consumer coverage run passes all 554 tests, global lines 64.20% and the unchanged pure-helper/page/API/store/hook floors. Final second run and refreshed graph check follow before commit.

Final X1 gate evidence: 554 consumer tests pass twice (first with coverage); 51 admin tests pass with coverage; final response/request HTTP suites pass 79 checks and golden totals/invariants pass 13. Related product integration passes 19 cases. All-app lint/typecheck, permission parity, inline-path and type-copy freshness checks pass. Refreshed detect-changes reports HIGH / six expected consumer processes (cart/POS/Add sale and ViewReturn), with no partial/truncated check result. This HIGH risk is not waived by shared axes; the full flow/math gates above are the mitigation.

## D-055 Frontend Docker contracts and X2 stack preparation (2026-10-13)
Type: DECISION / DOC-DRIFT
CI f2a2c55 passes all tests, typechecks, builds, audits and static contract checks but both frontend Docker builds fail because app-only contexts omit shared response JSON imports. KI-082 changes frontend builders to repo-root contexts, with explicit app/contracts/checker copies and freshness/typecheck before build. Backend context remains backend/. All three Compose variants and CI Docker commands are updated; only public frontend .env.docker files are included from env files. No type import/test reference is removed. GitNexus Dockerfile target UNKNOWN/not indexed; literal build/context references in CI and all Compose variants confirm callers.
X2 uses registry-verified Playwright 1.64.0, dotenv 18.0.7 and pg 8.23.1, Chromium only. PostgreSQL is isolated on localhost:55433 with tmpfs. DB name posbuzz_e2e_test retains B1's test-qualified-name convention; preparation refuses any other host/port/name or non-test NODE_ENV before resetting. Existing installed app lockfiles are used locally; --install runs npm ci for fresh CI setups. Both frontend builds receive the correct prefixed API base URL. Built apps, seed and Chromium install pass; browser journeys follow after repairing the CI build checkpoint. No merge or deployment was performed.

## D-056 X2 journeys J0–J2 and harness fixes (2026-10-13)
Type: DECISION
The seed has no units, so `createStock` creates a "Piece" unit through the API when none exist. The consumer logout button is icon-only, so it gets `data-testid="logout-button"` (pre-approved §3.3 seam). POS is a full-screen route without the sidebar, so J1 enters it in-app from the dashboard card and leaves with Back, which keeps the dashboard query cache and so exercises the KI-011 stale-cache path. Dashboard baselines use `settledDashboardCents` (waits for network idle), because the first render shows 0.00; without it J1/J2 passed only on a fresh DB. J2 reads the baseline before the sale and asserts +210.00 sale −105.00 refund net, stock 9 and RETURN_IN +1. Chromium had to be installed (`npx playwright install chromium`; environment only). J0–J2 pass twice in a row on a reused DB. J3–J11 and the stock-decrement proof run remain.

## D-057 X2 journeys J3–J11 complete; harness pacing (2026-10-13)
Type: DECISION
All twelve journeys (J0–J11) pass three consecutive full local runs (2.9 min each, on a reused database). Choices: (1) Login is throttled at 5/min per IP+email (D-005), which stays untouched; the harness paces its own logins to 4 per minute per account. (2) Setup creates data through the API; the UI is used for the step under test. The API helper's CSRF call rotates the shared cookie, so the first browser POST after a helper call can return 403 "invalid csrf token" and the app's documented recovery retries it; tests wait for the non-403 response. (3) J5 asserts exactly one successful token rotation. After a reload there is no CSRF token yet, so one 403 before the successful refresh is the recovery path (≤2 attempts). (4) J6 checks the tenant guard through the browser cookie jar with a different tenant Origin: 401 "subdomain does not match your tenant", cookies cleared, then /pos redirects to /login. (5) J4 edits the plan through the admin UI and restores the original permission ids in `finally`. J8 raises the seeded tenant's `max_branch` through the admin API (the seed allows one branch). (6) `addToPos` waits for network idle and retries the search step as a unit, since a refresh can re-render the POS mid-typing. (7) J11 uses the real message "Price of variant N has changed (now 120.00). Refresh the product list…". (8) J9 found KI-083. Proof: making the sale take 0 stock makes J1 fail (expected 8, received 10); reverted, git diff empty. CI job `e2e` added to `ci.yml`; its first run is the remaining verification.

## D-058 X4 error-message tests (2026-10-13)
Type: DECISION
Frontend: `getErrorMessage` unit tests in both apps (CO-/AD-ERR-001…008); a TypeScript-AST scan that every `catch`/`onError` toast uses `getErrorMessage` (CO-/AD-ERR-010/011) with an allowlist of five consumer files, each with a reason (print-agent failures, form validation, 404 sale-number guidance); rendering tests for POS checkout (stock, price, array, network, 500, generic 403, duplicate customer), returns, partial payments, login 401/403 with no refresh request, AI description, plus admin consumer/plan/billing/user/login cases. CO-ERR-028 is the existing CO-FLOW-INV-003 (tagged with both IDs).
Backend: `scripts/check-masked-errors.mjs` (X-ERR-001/002, unit-tested and a CI step in backend-unit); static message checks over every thrown 4xx (X-ERR-010…012, with a reviewed snapshot); a runtime sweep over every authenticated route checking shape, readability, no internals and no 5xx on empty bodies (X-ERR-020…023); and HTTP-pinned scenarios (X-ERR-030, 032…040; 031 and the tenant-login cases stay in BE-SEC). The sweep found KI-085/086 and the static check KI-087.
E2E: J12 (wrong password: one login request, no refresh after it; a refresh before login is the session probe on page load), J13 (stock message on screen), J14 (duplicate customer 409 shown as readable text; the plan's "duplicate product" needs the heavy product form, and the customer modal exercises the same Prisma-409 path).
Rules R2 "starts with a capital letter" is checked for static messages and runtime bodies; Nest's own generic bodies ("Forbidden resource", "Unauthorized") satisfy it. Error contract written to `docs/testing/error-contract.md`.

## D-059 B7/C5/B8/X3 first pass (2026-10-13)
Type: DECISION / DOC-DRIFT
Stryker 10's vitest runner finds no tests under vitest 5.0.4, so the consumer uses the command runner with each file's own tests (`npm run test:mutation`, one file per run; contracts copied beside the sandbox). In-place mode instruments every file and was abandoned. The first measured score was formatters 91.89% and calculate-totals 89.89% (below the 90 break); survivors are being killed. Backend unit config lists only unit-tested files; DB-backed utilities belong to the unfinished domain config. B8 tags come from direct service calls in existing tests only (helper-mediated calls are not claimed); its folder is `test/service-coverage` because `coverage/` is gitignored. X3 files are in place; GitHub-side steps (branch protection, throwaway-PR proofs, first nightly) need repo admin.

Secret scan runs the open-source gitleaks v8.18.4 binary (checksum-pinned) with `.gitleaks.toml`, because the GitHub Action requires a paid license for organizations (first CI run: "License key is required").

## D-060 Continued service coverage and timezone gate repair (2026-10-13)
Type: DECISION / FALLBACK
The pending six UsersService integration tests and inventory checks pass; committed and pushed as 60d43af. Inventory now has 95 gaps. Docker requires sandbox escalation; the authorised isolated-Postgres rerun passed. The npm-cache GitNexus native binary is truncated, so the intact previous-session 1.6.12 runner refreshed the index. Staged detect-changes reports LOW risk, three test helpers, zero production processes, without partial/truncated output. CLAUDE.md/AGENTS.md remain untracked.
KI-089: global setup overwrote an explicit TZ with UTC, invalidating the nightly matrix. The harness now preserves the requested process timezone while BUSINESS_TIMEZONE remains UTC. BE-HARN-019 pins the three zones. GitNexus setup/STATIC_TEST_ENV are UNKNOWN; literal imports and Jest globalSetup references bind them to integration, e2e and optional-infrastructure configurations. Verification follows.
Sale-item survivor: the existing two-line test used equal quantities, allowing an always-true find predicate to survive. Give the unrelated first line a different quantity, retaining all expected selected-line values; no production change. upsertVariantInSaleItems impact HIGH, eleven upstream symbols/four sale and quotation processes; warning reported before the test edit.

Continuation: 17 new real-Postgres tests cover all PortfolioContentService, PortfolioLeadService and ReceiptPdfSettingService methods; inventory shrinks from 95 to 44 gaps. Initial duplicate slug/SKU fixtures were corrected to distinct identities, preserving ordering/publishing assertions. Receipt-settings test coverage includes branch/default fallback, nested updates, copying, tenant isolation and exact exception messages/statuses. Class impacts: PortfolioContent/Lead LOW (five upstream symbols each, three direct module/controller imports, no indexed processes); ReceiptPdfSetting MEDIUM (17 upstream, six direct module/controller/PDF/consumer imports). Backend typecheck passes.
KI-090: command-runner incremental caching retained the sale-item survivor after its test changed. Hash the complete source/test/contract/config/dependency inputs and invalidate untrusted reports; CO-MUT-001 proves changed inputs invalidate while unchanged inputs preserve the cache. Sandbox Stryker listener is denied (EPERM); mutation rerun uses authorised escalation. Axios pre-edit File impact HIGH (113 upstream, seven direct API/store imports; File process axes unavailable). New adapter assertions pin both clients' withCredentials and header preservation; removed the earlier cookie BooleanLiteral suppression because adapter-level testing can observe it. Queue failures now assert the actual refresh message, and empty-CSRF refresh recovery counts attempts.
The X3 prose excluded path-filtered mutation jobs from All checks, which would let that required status pass despite a mutation failure. Both jobs now always run their filter and conditionally execute expensive steps, and are included in all-green.needs. CI workflow impact UNKNOWN (not indexed); literal workflow/deploy/plan references confirm its role. No assertion or score floor is lowered.

Inventory repair KI-091: TypeScript AST discovery handles multiline it.each titles and excludes commented/skipped/todo/failing tests. ConsumerUsersService/AdminUsersService are coverage identities for the two runtime UsersService classes; production class names and import aliases are unchanged. BE-COV-002/003 pin these independent claims. Graph serviceInventory/claimedTags UNKNOWN; direct imports in service-coverage.spec.ts confirm the consumers. No zero is interpreted as unused.
CI 38411969563: all jobs pass except J2 and its All checks aggregator. J2 successfully returns stock but reads a zero baseline before analytics renders; final net is 315.00 and retry 420.00, consistent with J1 and successive J2 net changes. KI-092 replaces networkidle baseline readiness with UI polling against independently fetched current analytics; sale/return delta remains +210.00 -105.00. settledDashboardCents impact UNKNOWN; context and literal references bind its two J1/J2 callers. E2E typecheck passes; browser/CI confirmation remains pending.

B8 deliberate proof: adding a temporary public coverageProofDummy to VendorService fails both BE-COV-001 and BE-COV-010. Source restoration is protected by finally, byte-identical after restoration, and both selected gates pass again. Log: /tmp/posbuzz-vendor-coverage-proof.log (local evidence). VendorService remains UNKNOWN even after a cold graph rebuild because GitNexus 1.6.12's default ignore-service.js excludes directories named vendor as third-party code. Direct module/controller and master-data test references confirm the production service; the temporary method was never committed.
KI-092 trace confirmation: original J2 reads 0.00 while its dashboard analytics response has today_total_sale=210/today_net_sale=210; after the return it has 420/315. Retry baseline again reads 0.00 while analytics has 420/315, then 630/420 afterward. This proves a rendered-baseline timing defect, with the exact delta assertion retained. No cookies, auth headers or credentials from the trace were printed.
Owner actions are prepared in OWNER-ACTIONS.md. D-017 explicitly chooses no license restrictions, so the license rejection proof needs an owner policy decision; it is not claimed complete. Branch protection, red-PR/deploy proofs and first nightly remain owner-only.

## D-061 RabbitMQ response acknowledgement repair (2026-10-13)
Type: DECISION
KI-093: the new external-boundary response-consumer regression catches double acknowledgement for a response lacking requestId (expected one call, received two). Remove only the redundant ack in that branch; the existing finally acknowledges exactly once. No private method is called by tests: they invoke the callback registered on the external channel by the public setupResponseConsumer method. GitNexus handleResponseMessage LOW, four upstream symbols, setupResponseConsumer direct caller, two indexed response setup/reconnect flows. Focused regression, real-broker lifecycle test and all-app lint/typecheck verification follow.

Continuation verification: all 34 new service integration cases pass after correcting the quotation fixture lookup (findOne intentionally excludes quotations), required return variant/batch ids, uppercase PDF heading and the existing foreign-unit 404 contract. All 24 new unit cases pass, including real PDF/Excel exports and external transport/process mocks. Real RabbitMQ/Redis lifecycle suite passes both tests; RabbitMQ exactly-once regression passes after KI-093. Service inventory now claims all 305 public methods, so known-gaps.json is deleted; ten inventory/requirements-helper tests pass. B8 is still open: risk-tier and tenancy diagnostics are not yet satisfied or wired as final gates.
KI-094: docker compose --wait without a health check returned before PostgreSQL accepted connections. TCP readiness and psql now prepare a migrated test template plus 16 isolated databases. Stryker 10's installed child-process-proxy.js demonstrably sets STRYKER_MUTATOR_WORKER; ids begin at zero. BE-HARN-020/021 assert distinct prepared worker URLs and fail closed for missing/out-of-range ids, missing counts and nonlocal/non-test bases. Setup/test-env impact UNKNOWN; the package script, nightly step and loader imports bind the test-only callers.
KI-095: the 20-repeat J2 run passes twelve journeys but eight fail at login; browser traces show POST /auth/login-user=429. Playwright restarts repeat workers, losing the module-local budget. Shared atomic reservations preserve pacing across worker processes; E2E-HARN-001 proves the fifth attempt waits across process boundaries. waitForLoginBudget impact LOW, three upstream symbols, login direct caller and both page fixtures, no indexed processes. Baseline arithmetic is now green in CI 38418049941 on a483ebc; stability verification follows for the new pacing.

## D-062 Timezone matrix truth-fixture correction (2026-10-13)
Type: DECISION / DOC-DRIFT
The full integration suite passes UTC (382 applicable cases) and Dhaka (385), but New York fails BE-RPT-001 hourly buckets. Production deliberately computes business-local Date hours (business-time.util.ts documents that src/timezone.ts selects the process timezone at boot). The hand-computed scenario expectation only recognized Dhaka and otherwise assumed UTC; on its fixed 2026-03-14 instant New York is UTC-4. KI-096 adds explicit UTC/Dhaka/New York offsets and rejects an unsupported zone; expected counts (2/2/1) and amounts (480/335/250) are unchanged. No production report logic changes. Test File impact UNKNOWN; integration Jest testRegex and the nightly matrix bind the dynamic test runner. Focused New York and complete matrix reruns follow.

## D-063 Mutation exclusion audit (2026-10-13)
Type: DEFECT / DECISION
KI-097 invalidates the earlier consumer mutation completion estimates: Stryker category directives ignore both equivalent and non-equivalent replacements on the same expression. Remove those directives and remeasure all targets without lowering the 90% floor or the critical-file 100% killed-or-justified requirement. The sole retained exclusion is the write to variantQuantityMap, which is never read. Equivalent survivors must be reviewed individually; an equivalent boundary replacement cannot justify suppressing a conditional that removes positive tax or promotion allocation. All 152 related regression tests pass after directive removal. No production expression changes in this audit.

## D-064 Tenant inventory and nightly tier gate (2026-10-13)
Type: DEFECT / DECISION
KI-098 requires both consumerId and consumer_id signatures to trigger the tenant obligation. The inventory regression checks consumer roles, sales and unscoped admin roles. BE-COV-020 now has a report gate that requires results for every reviewed Tier A/B service file, rejects absent or wholly unmeasured results, and applies each file's 75%/60% floor independently. Its regression cases prove an overall passing score cannot mask one low file. Domain mutation targets are derived from the reviewed inventory plus B7 guard/math targets; old partial method ranges cannot satisfy the all-method B8 requirement. Actual domain scores and the separate B7 critical thresholds remain pending, so the phase stays open.

## D-065 Branch protection dropped (2026-10-13)
Type: DECISION
Owner decision: the repository is not on a GitHub team plan, so branch protection / required `All checks` is not applied and its throwaway-PR proof is removed from X3 exit criteria. Remaining X3 gates: deploy refuses red SHA, first nightly, coverage baseline.

## D-067 Intentional tracked deployment credentials; JWT already rotated (2026-10-14)
Type: DECISION
Owner decision: `pull.sh` (with its deployment token) and the tracked `.env.docker` files are intentional and are not to be removed or reworked by the test programme. The old JWT from rabbitmq.controller.ts history was rotated and is dead; HEAD contains no JWT. No history rewrite or force-push. The secret scan keeps scanning new commits only. Security note recorded for the owner: the repository is public, so any live credential in these tracked files is readable by anyone.

## D-068 Lighter domain mutation: weekly rotation, changed files, ratchet gate (2026-10-14)
Type: DECISION
Owner request: reach the B7/B8 goal with far less compute. The full domain run (≈13,500 mutants, 32 one-hour shards) is replaced by:
- **Rotation:** each night mutates every 7th service file (`STRYKER_ROTATION=d/7`, d from the UTC day), so every file is measured once a week; files changed in the last 25 hours are always added (`STRYKER_CHANGED_FILES`). Six shards; a shard with nothing assigned skips Stryker.
- **Tests used:** integration specs plus the unit specs (`src/**/*.spec.ts`, with reflect-metadata). Unit specs add kills for files the integration suite never reaches (the 0% files in KI-106) at ~seconds per run. E2E specs stay out (KI-105).
- **Gate:** BE-COV-021 ratchet — a measured file may not fall more than 1 point below `test/service-coverage/mutation-baseline.json`; unrecorded files are reported. Each nightly uploads `backend-mutation-baseline-candidate`; recording baselines is a reviewed copy of that file into the repo. The Tier A 75% / Tier B 60% floors remain the target, still enforced by the strict mode (`node scripts/mutation-tier-gate.mjs <reports>` without `--baseline`).
- **Seed baseline:** 19 unsplit files from nightly 38457921171 (KI-106). Split files and support.service (ambiguous name) are recorded by the first candidate.
This keeps the regression guarantee (a change that weakens tests for a file fails within a day for edited files, within a week for the rest) while cutting nightly mutation work by roughly 85%. It does not claim the floors are met: raising scores to the floors remains test-writing work tracked in KI-106.

## D-069 Domain mutation speed: incremental cache, runner recycling, short timeouts (2026-10-14)
Type: DECISION
The first D-068 nightly still timed out (shard 1 had 1,678 mutants, ~90 min projected, with out-of-memory runner restarts). Changes:
- Stryker's incremental report is restored and saved per rotation day and shard (`actions/cache` restore/save, saved even when the shard fails). Mutants whose code and covering tests are unchanged reuse their earlier result. Local check: the same shard took 12 min 26 s cold and 79 s with the cache, with identical scores.
- `maxTestRunnerReuse: 25` recycles Jest runners before Nest/Prisma state grows into an OOM crash.
- `timeoutMS` 120 s → 15 s: an infinite-loop mutant no longer waits two minutes.
- `ignorers: ['logging']` (`stryker-plugins/ignore-logging.mjs`) skips mutants inside `logger.*` / `this.logger.*` / `console.*` calls — diagnostic text only.
- `thresholds.break: null`: a shard fails only on errors; the BE-COV-021 ratchet gate judges scores.
- 12 shards; mutation step capped at 110 min (job 120) so a cold pass always completes and saves its cache (a shard cut off at 50 min saved nothing). Runner minutes are free on the public repository. The first full pass is the slow one; later nights retest only what changed.

## D-070 Stryker database slots are claimed per worker process; incremental cache v2 (2026-10-14)
Type: DECISION
Nightly 38483487752 failed the ratchet on an unchanged file (KI-108): `maxTestRunnerReuse` (D-069) made Stryker start more worker processes than the 16 prepared databases, so 28% of mutants ended as RuntimeError and were dropped from the score.
- Each worker process claims the first database slot whose lock file names no live process (`claimStrykerDatabaseSlot`, directory-mutex serialised, `test/.tmp/stryker-slots`, reset by `stryker-db.mjs`). Chosen over worker-id modulo 16 (two live workers could share a database, giving false kills and survivors) and over dropping runner recycling (brings back the out-of-memory crashes).
- The incremental cache key is now `stryker-domain-v2-…`. Stryker reuses every non-killed result, errors included, and a harness fix does not invalidate them, so the old caches were unusable. Bump the prefix again whenever saved results are invalid.
- Baselines: the nine files first measured correctly in nightly 38514413086 were added to `mutation-baseline.json` (existing entries untouched). Scores from 38483487752 were not used.
Verification: local Stryker with recycling every 2 mutants (about 100 processes) finished with 0 RuntimeErrors; nightly 38514413086 green with 0 RuntimeErrors in 3,951 mutants. BE-HARN-022 pins slot reuse.

## D-071 Service-level unit specs as the mutation lever; shared helpers; dead code removed (2026-10-14)
Type: DECISION
KI-106 left most Tier A/B service files under their mutation floors. The domain run judges each file by integration plus unit specs, and most surviving mutants were Prisma query shapes, tenant scoping, status transitions and error wrapping that no test pinned. Closing the gap uses fast, database-free unit specs next to each service:
- **Helpers** (all under `backend/test/helpers/`): `error-wrapping.ts` pins the shared "client errors pass through, anything else is logged with its stack and becomes a generic 500" contract per method; `fake-tables.ts` is an in-memory Prisma delegate stand-in for multi-step import logic; `pdf-recorder.ts` + `pdf-golden.ts` record every PDFKit drawing call and compare it with a reviewed golden file (one call per line, `UPDATE_PDF_GOLDEN=1` to regenerate after an intended layout change). PDF goldens use midday UTC timestamps so they hold in all three matrix time zones.
- **Fast loop:** `stryker.unit-only.config.mjs` (+ `test/jest-stryker-unit-only.json`) mutates chosen files against the unit specs alone, minutes instead of an hour. Its scores are a lower bound for the domain run, which adds the integration specs. `mut.sh`-style usage: `STRYKER_DOMAIN_RUN=1 npx stryker run stryker.unit-only.config.mjs --mutate <file>`.
- **Dead code removed instead of tested:** branches that can never run because `isClientError` already passes the same Prisma errors to the Prisma filter — the `NotFoundException` rethrows in CategoryService, the P2002/P2025/P2003 branches in PlanService and BillingHistoryService, the error-message echo in `PlanService.findOne` (it leaked the raw error text), the `throwProductNameConflict` helper in ProductService (its message left the reviewed message snapshot), and a no-op trailing query in `ProductVariantService.update`. Equivalent mutants are removed at the source, never excluded.
- **No assertion, floor or threshold was lowered.** Tier floors (75 / 60) are unchanged.

## D-072 Nightly domain mutation: runner time budget (2026-10-14)
Type: DECISION
Concern: will a GitHub runner finish the domain mutation shards? Measured facts: a cold shard ran 27-66 min for 330-690 mutants (about 5-6 s per mutant); a warm shard (v2 incremental cache) took 3-4 min. Each rotation day (r1..r7) has its own cache, so a cold pass happens once per day-of-week per shard; the worst estimated shard is about 1,000 mutants (rotation day 7, the large sales ranges), roughly 90-100 min once. The job timeout stays disabled (owner request), so a cold pass completes (GitHub's hard limit is 6 h).
Change: `stryker.domain.config.mjs` concurrency 3 -> 4 (`STRYKER_CONCURRENCY` overrides). Stryker splits concurrency between type-check workers and test runners; 3 produced one test runner on a 4-vCPU runner, 4 produces two. Expected: cold passes close to halve. The unit specs added for KI-106 also make most mutants die in milliseconds instead of waiting for an integration test.
Watch: first nightly after this change for OOM restarts (heap 3 GB per Jest worker, runners recycle every 25 mutants); revert to 3 if a shard fails on memory.

## D-073 Product-audit period uses UTC days; timezone check covers product-audit (2026-10-15)
Type: DECISION
Concern: the audit period start/end were built with local `setHours`, so results depended on the server time zone (KI-112). Date-only inputs arrive as UTC midnight (same convention as D-004's calendar-date columns), so UTC day boundaries are the consistent choice.
Change: `product-audit.service.ts` uses `setUTCHours`; `test:int:tz` runs `test/integration/product-audit` under Asia/Dhaka and America/New_York, in addition to the Dhaka report suite.
Verification: CI run 38687491364 on `fix/known-issues` passed (all jobs, 15m44s), which includes the KI-110, KI-111 and KI-065 fixes and the consumer-purge SCOPE refactor.

## D-074 Continuous delivery to the VPS from main via GHCR images (2026-10-15)
Type: DECISION
Concern: deploys were a manual workflow that ran `git pull` with a token committed in `pull.sh` and built images on the production box (`prisma db push --accept-data-loss` in one compose file). Pages also needed a hard refresh after a deploy.
Change: `deploy.yml` runs after a green `All checks` on a push to `main` (or by hand): builds backend/admin/consumer/portfolio into `ghcr.io/posbuzz/posclient-*:<sha>`, deploys over a forced-command SSH key (`deploy/deploy-entry.sh`), waits for container health, rolls back to the last good sha, smoke-tests the live site (status codes plus `index.html` no-cache / `sw.js` no-store) and prunes old image versions (keeps 10). Stack: `deploy/docker-compose.prod.yml` (ports bound to 127.0.0.1, Postgres on the existing volume, migrations via `prisma migrate deploy`). Redis and RabbitMQ are not deployed (both optional in the backend). Host: UFW (22222/80/443), key-only SSH, fail2ban, unattended upgrades. Dependabot version updates removed (they queued about 30 CI runs).
Verification: first deploy failed health (server env lacked `FASTAPI_URL`; fixed by hand, no rollback target on a first deploy); the second deploy (run after PR #95) passed all jobs including the live smoke test.
Follow-ups done the same day: Postgres password rotated on the server; `.env.docker` files with secrets (root, backend, portfolio, ai-service) and the root `docker-compose.yml` removed from git (admin/consumer `.env.docker` stay, they carry only public Vite build values); stale leaked-token `pull.sh` removed.
Open: the removed secrets are still in git history (rewrite not done; the live ones were regenerated or rotated); the old GitHub token must be revoked by the owner; `posbuzz.com` has no DNS A record (left as is).
