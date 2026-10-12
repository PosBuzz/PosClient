# Decision Playbook

Use this whenever something in a phase doc does not go as written. Find the situation, follow the
steps in order, and log the outcome in `DECISIONS.md` using the template at the bottom. **Do not
improvise past a step that says STOP.**

Guiding priorities, highest first:
1. **Never weaken a check to get green.** Never lower a threshold, delete an assertion, or loosen
   a matcher just to pass.
2. **Fix confirmed defects encountered during testing immediately** under the owner's 2026-10-13 instruction; keep unrelated production changes out of scope.
3. **Prefer real dependencies over mocks** (real Postgres > mocked Prisma), except for external
   services (RabbitMQ, the FastAPI AI service, Cloudinary, the local print agent).
4. **Prefer testing through the public surface** (HTTP route > service method > private helper).
5. Small, mergeable PRs: one phase or one sub-section per PR.

---

## §1 A new test fails against unchanged production code

The test either found a bug or assumed something wrong. Decide which:

1. Re-read the production code path line by line. Check `git log -L` on the function and read
   the commit messages (`git log -p --follow <file>`), since intent often lives there.
2. Look for evidence of intended behavior, in this order of authority:
   a. An explicit code comment explaining the rule (e.g. `// "nothing paid" must be checked first`).
   b. A commit message that introduced the behavior on purpose.
   c. What the UI shows the user (consumer/admin pages, receipt PDFs).
   d. Consistency with sibling code (e.g. if 5 queries filter `deleted_at: null` and 1 doesn't).
3. **If the evidence says the current behavior is intended:** your expectation was wrong. Fix the
   test. Log it as `DECISION: behavior is intended` with the evidence link.
4. **If evidence confirms a bug, fix it immediately** (owner instruction, 2026-10-13):
   - Keep the test asserting the correct behavior and fix the underlying implementation in the same work session.
   - Re-run the failing test, relevant related suites, and all three apps' lint/typecheck. Verify changed backend behavior over real HTTP/Postgres where applicable.
   - Record the defect, cause, fix and verification in `KNOWN-ISSUES.md`/`DECISIONS.md`; the regression test must pass normally.
   - Do not weaken assertions, lower thresholds, disable checks, or mark a real defect `it.failing`/`it.fails`/skip merely to keep working.
   - If an external dependency or unavailable environment prevents a fix, record the concrete blocker honestly and continue unaffected work. This is not permission to hide a failure.
5. **If evidence is contradictory or absent:** write a **characterization test** pinning the current
   behavior. Title suffix `(characterization: confirm intent)`. Add a `QUESTION` entry in
   `DECISIONS.md` for the owner. Keep going; do not block on the answer.

## §2 Code is hard to test (no seam)

1. Can you reach it through HTTP (B5 harness) or by calling the Nest service with a real Prisma
   client (B3 harness)? → Do that. This handles 95% of cases in this repo, because services take
   `PrismaService` by constructor injection.
2. Is the logic a private method of a service? → Test it through the public method that calls it.
   Do **not** use `(service as any).privateMethod` except for the pure math helpers explicitly
   allowed in B2.
3. Does it depend on time? → Integration tests fake **only `Date`**:
   `jest.useFakeTimers({ now: new Date('2026-03-15T10:00:00Z'), doNotFake: ['nextTick','setImmediate','setTimeout','setInterval','clearTimeout','clearInterval','queueMicrotask','hrtime','performance'] })`.
   Faking real timers breaks the Postgres driver. Or insert rows with explicit `sale_date` /
   `created_at` values.
4. Does it call an external service (RabbitMQ, FastAPI, Cloudinary, print agent)? → Replace it at
   the Nest provider boundary with `.overrideProvider(X).useValue(stub)`, or at the network boundary
   with MSW on the frontend. Never hit real external services.
5. Still impossible? → Only then propose a refactor. Open a separate PR
   `refactor(testability): <what>`. It must be a pure move/extract with **zero** logic change, and
   existing tests plus a characterization test written *first* must pass before and after. Log it
   in `DECISIONS.md`.

## §3 A tool or package does not work as the doc says

1. Read the exact error. Check the package's peer deps: `npm view <pkg>@<ver> peerDependencies`.
2. Use the documented fallback for that tool:

| Tool | Planned | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Backend test DB | Testcontainers (`@testcontainers/postgresql`) | `TEST_DATABASE_URL` pointing at a Postgres from `docker compose -f docker-compose.test.yml up` (harness supports this; see B1) | GitHub Actions `services: postgres` (CI only) |
| Backend TS transform | `ts-jest` (already installed) | `@swc/jest` (if suite > 3 min) | n/a |
| Frontend runner | Vitest 5 | Vitest 3.2.x (if a Vite 6 peer error appears) | n/a |
| DOM env | `jsdom` | `happy-dom` (only if jsdom + antd crash on an API jsdom lacks) | n/a |
| HTTP mocking | MSW 3 | MSW 2.x (if Node or interceptor incompatibility) | `vi.mock('../api/axiosInstance')` (last resort, log it) |
| Mutation | Stryker 10 | Stryker 9.x | Scope down the `mutate` globs to keep runtime < 30 min |
| E2E | Playwright (Chromium) | n/a | n/a |

3. A version pinned in a doc fails to install? → Install the newest version of the **same
   major**. If the whole major is broken, step down one major and log it.
4. Never add a second tool for the same job (e.g. Jest *and* Vitest in the consumer).

## §4 A test is flaky (passes sometimes)

1. Run it 20× in isolation: `npx jest -t "<ID>" --runInBand` (or `npx vitest run -t "<ID>"`) in a loop.
2. Usual causes in this repo, check in order:
   - Order-dependent DB state → missing `resetDb()` or factory relies on autoincrement IDs. Fix: use
     returned IDs, never literal IDs.
   - `Promise.all` inside `sales.service.ts#create` makes sale-item insert order nondeterministic →
     sort by `variant_id` before asserting arrays.
   - Time → real `Date` crossing midnight UTC. Fix: fake `Date` (§2.3).
   - antd animations/portals in jsdom → `await screen.findBy…` instead of `getBy…`; never `setTimeout` waits.
   - Playwright → use web-first assertions (`await expect(locator).toHaveText`), never `waitForTimeout`.
3. If it can't be fixed within 1 hour: move it to quarantine. Rename it with a `.skip` and a
   `QUARANTINE(<date>, <reason>)` comment, add a row in `KNOWN-ISSUES.md` (type: flaky), and fix it
   within one week. **Quarantined tests count as missing** for that phase's DoD.

## §5 Coverage or mutation threshold not reachable

1. Look at the uncovered lines and surviving mutants. They are a list of missing assertions.
2. Surviving mutant in logging/error-message text → add it to Stryker's `ignorers` or use
   `// Stryker disable next-line StringLiteral: log text`. Logging only, nothing else.
3. Equivalent mutant (the code change makes no observable difference) → disable with an inline
   comment giving the reason.
4. Dead code found → log as `QUESTION` in `DECISIONS.md` (owner decides whether to delete it). Exclude
   it from coverage only with a `/* istanbul ignore next -- dead code, see DECISIONS #n */` comment.
5. **Never** lower the configured threshold. If a phase's target is truly unreachable, STOP and record
   it in `DECISIONS.md` with numbers. The owner must approve any threshold change.

## §6 The phase doc is wrong about the code

The code moved since 2026-10-12, or the doc has an error.
1. Trust the code. Find the new location (`grep -rn "<function name>"`).
2. If the behavior the doc describes no longer exists, skip that test ID and record it as
   `DOC-DRIFT` in `DECISIONS.md`.
3. Fix the phase doc in the same PR so the next person doesn't trip on it.

## §7 A test needs data the schema makes awkward

Use the factories (B1 `test/factories/`). If a required relation is missing from the factories,
**add a factory**; don't inline 40 lines of `prisma.x.create`. Factories always:
- take an optional `overrides` object,
- create required parents (consumer → plan, branch, role, user) when they aren't passed in,
- return the created row.

## §8 Ambiguous intended behavior in money/stock/report logic

Money and stock are the highest-stakes areas in a POS. When unsure:
1. Prefer the interpretation that **conserves** value: stock in = stock out + on hand,
   sale total = sum(lines) − discounts + tax + shipping, refunds ≤ amount paid.
2. Write that invariant as the test. If the current code violates it → §1 step 4 (KNOWN-ISSUE).

## §9 Something requires a decision outside engineering

Examples: which timezone the dashboard's "today" should use, whether overselling may ever be
allowed. → Write a characterization test, add a `QUESTION` to `DECISIONS.md` tagged
`@owner`, and move on. Never block a phase on a business question.

---

## DECISIONS.md entry template
```
### D-### <short title>   (YYYY-MM-DD, phase Bx/Cx/…, author)
Type: DECISION | QUESTION | DOC-DRIFT | FALLBACK | REFACTOR
Context: <what happened, the error, the file:line>
Options considered: <1–3 bullets>
Chosen: <what>, because <evidence>
Follow-up: <KI-### / owner question / none>
```
