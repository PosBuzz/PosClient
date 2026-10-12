# Phase P0: Baseline & Guardrails (repo-wide)

**Goal:** before adding tests, make the *existing* static checks green and run them in CI on
every PR. Otherwise new failures hide among old ones.

**Status (2026-10-13): COMPLETE — verified locally and in GitHub CI on draft PR [#40](https://github.com/PosBuzz/PosClient/pull/40).**

**Baseline refreshed 2026-10-13 (requested stricter rules enabled):**
| Check | backend | consumer | admin |
|---|---|---|---|
| `tsc` | Pass: 0 errors | Pass: 0 errors | Pass: 0 errors |
| ESLint | Pass: 0 errors / 0 warnings | Pass: 0 errors / 0 warnings | Pass: 0 errors / 0 warnings |
| Unit tests | Pass: 8 suites, 35 tests (`npm test`) | none | none |
| CI on PR | `ci.yml`: all checks passed | same | same |
| Node | v22.23.x locally | same | same |

---

## Step 1: Pin the Node version
1. Create `/.nvmrc` containing `22`.
2. In each of `backend/package.json`, `consumer/package.json`, `admin/package.json`, add:
   ```json
   "engines": { "node": ">=22.22.1 <23" }
   ```
   Reason: Vitest 5, MSW 3, jsdom 30 and Testcontainers 12 all require Node ≥ 22.12 (verified via `npm view <pkg> engines`).
3. Owner instruction (2026-10-13): use Node 22 in every Node runtime. Backend/consumer/admin Dockerfiles now use `node:22-alpine`; portfolio already used it. Compose builds those Dockerfiles. Root and all app package engines use `>=22.22.1 <23`, `.nvmrc` selects 22, CI reads `.nvmrc`, and setup rejects other Node major versions. The higher floor supports lint-staged 17.

## Step 2: Make lint green without behavior change
1. Backend: `cd backend && npx eslint "{src,apps,libs,test}/**/*.ts" --fix`, then rerun without
   `--fix`. Fix the remaining 2 by hand. Commit as `style(backend): apply eslint autofix`.
   - The diff must be whitespace/formatting only. Check with `git diff -w --stat`: any file with
     non-whitespace changes needs a manual review that it is formatting only.
2. Consumer: the 6 errors are unused destructured props (`onAddAttribute`, `onUpdateAttribute`,
   `onDeleteAttribute`, `onAddSerial`, `onUpdateSerial`, `onDeleteSerial`) at lines 87–92 of the file
   ESLint reports. Prefix each with `_` **only if** the project's ESLint config ignores
   `^_`-prefixed args. Otherwise remove the names from the destructure, leaving the prop types
   untouched. Do not delete the props from the type or from callers.
3. Add non-mutating lint scripts (the existing backend `lint` uses `--fix`, which CI must not do):
   - backend: `"lint:check": "eslint \"{src,apps,libs,test}/**/*.ts\" prisma-client-exception --max-warnings=0"`
   - consumer/admin: `"lint:check": "eslint . --max-warnings=0"` (warnings also fail; all three apps share the same script name)
4. Add `"typecheck"` scripts: backend `"tsc --noEmit -p tsconfig.json"`, consumer/admin `"tsc -b"`.

## Step 3: Root convenience scripts
In root `package.json` `scripts`, add:
```json
"lint:all": "npm run lint:check --prefix backend && npm run lint:check --prefix consumer && npm run lint:check --prefix admin",
"typecheck:all": "npm run typecheck --prefix backend && npm run typecheck --prefix consumer && npm run typecheck --prefix admin",
"test:all": "npm test --prefix backend -- --runInBand && npm run test:guardrails"
```
(`test:all` grows in later phases: each phase appends its scripts.)

## Step 4: CI skeleton (`.github/workflows/ci.yml`)
Create this file. **Later phases add jobs to it. Do not create separate workflow files** (except the nightly in X3).

```yaml
name: CI
permissions:
  contents: read

on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  static:
    name: Lint & typecheck (${{ matrix.app }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: [backend, consumer, admin]
    defaults:
      run:
        working-directory: ${{ matrix.app }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: ${{ matrix.app }}/package-lock.json
      - run: npm ci
      - name: Lockfiles stay unchanged
        working-directory: .
        run: git diff --exit-code HEAD -- backend/package-lock.json consumer/package-lock.json admin/package-lock.json
      - if: matrix.app == 'backend'
        run: npx prisma generate
      - run: npm run lint:check
      - run: npm run typecheck

  dependency-audit:
    name: Production dependency audit (${{ matrix.app }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: [backend, consumer, admin]
    defaults:
      run:
        working-directory: ${{ matrix.app }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: ${{ matrix.app }}/package-lock.json
      - run: npm ci
      - name: Lockfiles stay unchanged
        working-directory: .
        run: git diff --exit-code HEAD -- backend/package-lock.json consumer/package-lock.json admin/package-lock.json
      - name: Audit production dependencies with scoped exceptions
        run: |
          set +e
          npm audit --audit-level=high --omit=dev --json > "$RUNNER_TEMP/audit.json"
          audit_status=$?
          set -e
          node ../scripts/check-production-audit.mjs "$RUNNER_TEMP/audit.json" "$audit_status" "${{ matrix.app }}"

  dependency-review:
    name: PR dependency review (${{ matrix.app }})
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: [backend, consumer, admin]
    defaults:
      run:
        working-directory: ${{ matrix.app }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: ${{ matrix.app }}/package-lock.json
      - run: npm ci
      - name: Lockfiles stay unchanged
        working-directory: .
        run: git diff --exit-code HEAD -- backend/package-lock.json consumer/package-lock.json admin/package-lock.json
      - name: Block new high or critical dependency findings
        env:
          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: |
          git show "$PR_BASE_SHA:${{ matrix.app }}/package-lock.json" > "$RUNNER_TEMP/base-lock.json"
          set +e
          npm audit --json > "$RUNNER_TEMP/audit.json"
          audit_status=$?
          set -e
          node ../scripts/check-production-audit.mjs "$RUNNER_TEMP/audit.json" "$audit_status" "${{ matrix.app }}" "$RUNNER_TEMP/base-lock.json" delta
      - name: GitHub dependency graph review (when available)
        if: vars.DEPENDENCY_REVIEW_ENABLED == 'true' && matrix.app == 'backend'
        uses: actions/dependency-review-action@v5
        with:
          config-file: .github/dependency-review-config.yml

  backend-unit:
    name: Backend unit tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - name: Lockfiles stay unchanged
        working-directory: .
        run: git diff --exit-code HEAD -- backend/package-lock.json consumer/package-lock.json admin/package-lock.json
      - run: npx prisma generate
      - run: npm test -- --ci --runInBand
        env:
          TZ: UTC

  build:
    name: Build (${{ matrix.app }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: [backend, consumer, admin]
    defaults:
      run:
        working-directory: ${{ matrix.app }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: ${{ matrix.app }}/package-lock.json
      - run: npm ci
      - name: Lockfiles stay unchanged
        working-directory: .
        run: git diff --exit-code HEAD -- backend/package-lock.json consumer/package-lock.json admin/package-lock.json
      - if: matrix.app == 'backend'
        run: npx prisma generate
      - run: npm run build

  guardrail-tests:
    name: Dependency gate regression tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: node --test scripts/check-production-audit.test.mjs

  docker-build:
    name: Docker image builds (${{ matrix.app }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: [backend, consumer, admin]
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t posbuzz-${{ matrix.app }}:ci ${{ matrix.app }}
```
(The consumer/admin Dockerfiles `COPY .env.docker .env`. Those files are currently tracked in
git, so the build works in CI. If KI-012's remediation removes them from git, this job must create
a placeholder `.env.docker` with `VITE_API_BASE_URL=http://localhost:8000/api/v1` before `docker build`.)

**If `npm ci` fails in CI** because a lockfile is out of sync: run `npm install` locally in that app,
commit the updated `package-lock.json` in a separate commit `chore(<app>): sync lockfile`, and log it.
**If `npx prisma generate` is needed before typecheck** (it is, because `@prisma/client` types come from
generation), it is already in the workflow above.

## Step 5: Pre-commit hook (local fast feedback)
Implemented with Husky 9 and lint-staged 17. Root tools require Node >=22.22.1 <23.
`.husky/pre-commit` runs `npx lint-staged --no-stash --no-revert`; `lint-staged.config.mjs` runs the relevant app's read-only ESLint checks. This preserves the owner's working tree and avoids enforcing new repo-wide Prettier formatting on legacy files. CI remains authoritative (D-017).

## Exit criteria
- [x] `npm run lint:all && npm run typecheck:all && npm run test:all` passes at the repo root (three consecutive runs; 35 backend tests).
- [x] `ci.yml` jobs `static`, `backend-unit` and `build` are green on PR #40; all 17 jobs passed in the [checkpoint run](https://github.com/PosBuzz/PosClient/actions/runs/38293064702) at commit `113abfb`.
- [x] Lint fixes remove four obsolete type assertions and redundant parentheses; no check was weakened. Owner-authorized compatible security updates and Node 22/Docker command repairs are recorded separately below.
- [x] CI checks run on this draft PR. X3 will make them required branch-protection checks; merging/deployment remains out of scope for this checkpoint.


## Static strictness ratchet (D-014)
Enabled now, with zero errors and zero warnings in all three apps:

| Scope | Enforced rules |
|---|---|
| Backend ESLint | no-floating-promises, no-misused-promises (`checksVoidReturn: false`), switch-exhaustiveness-check, only-throw-error, await-thenable, return-await (`in-try-catch`), eqeqeq (`smart`), curly (`multi-line`), prefer-const, no-var |
| Consumer/admin ESLint | eqeqeq (`smart`), curly (`multi-line`), prefer-const, no-var, no-debugger |
| Backend TypeScript | noImplicitAny, noImplicitReturns, noUnusedLocals, noUnusedParameters, noImplicitOverride, noFallthroughCasesInSwitch |
| Consumer/admin TypeScript | noUnusedParameters (other existing compiler checks retained) |

Use ESLint JSON or the Node API for both counts; ESLint 9 has no built-in unix formatter.
Backend lint must include `prisma-client-exception/`; CI uses `--max-warnings=0`.
Return the final `res.send`/error send in response handlers; apply `override` only to actual inherited members.
Unused logger declarations stay commented; unused constructor DI stays injected without unused private properties. Backend `noImplicitAny` is enabled with the four missing declaration packages; PDF callbacks use receipt/Prisma types, RabbitMQ uses `ChannelModel` and synchronous `publish`, and the request-user augmentation is compatible with Passport. Full authentication-boundary optionality remains part of the larger strictness review.

Deferred ratchets (measured before this pass; remeasure before enabling):

| Rule | Baseline / prerequisite |
|---|---|
| react-hooks/exhaustive-deps | consumer 38 / admin 3; review dependencies and effect behavior before enabling |
| no-console / no-alert | inventory legitimate logging/confirmation flows; replace or narrowly justify each |
| backend no-unsafe-enum-comparison | establish enum boundary conversions |
| backend full strict | 212; fix in measured increments |
| frontend noImplicitAny | consumer 143 / admin 54; type API/UI boundaries incrementally |

Each ratchet gets a reviewed baseline and owners; shrink findings, then enforce as errors at zero.
Never turn on a rule while leaving warnings, or disable checks to make the totals green.

## Dependency checks: implementation requirements for Step 4
P0 now includes the workflow and referenced audit/dependency configuration files. The private-repo fallback audits PR dependency deltas; GitHub graph review can be enabled when available. Owner policy: no license restrictions for now (D-017).

- `scripts/check-production-audit.mjs` must parse the JSON and accept only audit exit codes 0/1 with a valid vulnerabilities report. Fail closed on registry/network errors, invalid JSON and unsupported report formats. Follow transitive `via` links to advisory leaves; fail on every high/critical advisory unless its exact advisory/app/package/version/path matches a documented exception. Lower severity findings are reported but do not fail this high/critical gate. Include meaningful tests proving an accepted finding passes, an additional high/critical finding fails, and malformed/unavailable audits fail.
- `.github/audit-exceptions.json` is empty: the old React Router finding is patched in the already-installed 7.18.2 version (D-021). All three production audits and both frontend full audits pass without exceptions. Do not restore an exception for this resolved advisory. The evaluator's scoped matching is tested with hypothetical fixtures; every real high/critical finding currently fails.

- Original license-gate proposal (superseded by owner's no-restrictions policy in D-017): `.github/dependency-review-config.yml` sets `fail-on-severity: high` and the owner's reviewed `deny-licenses` list. Do not invent a license policy; configure it and test it before declaring this gate complete. Keep `allow-ghsas` empty: the accepted existing SPA finding is handled by the production audit gate, while new vulnerable additions stay blocked on PRs. The action reviews dependency changes across the PR, including workflows/development dependencies. Confirm dependency-graph/review support for the repository; if unavailable, document it and implement an equivalent PR delta/license gate before marking X3 complete. See the [action configuration](https://github.com/actions/dependency-review-action) for severity/license inputs.
- Every job running `npm ci` checks `git diff --exit-code HEAD -- backend/package-lock.json consumer/package-lock.json admin/package-lock.json` from the repo root immediately afterward. This includes later integration/frontend/e2e jobs; installed lockfile changes must fail, not be automatically committed.
- Add `.github/dependabot.yml` with the weekly updates below (no automatic merging). The configuration is now implemented in `.github/dependabot.yml`.

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /backend
    schedule:
      interval: weekly
  - package-ecosystem: npm
    directory: /consumer
    schedule:
      interval: weekly
  - package-ecosystem: npm
    directory: /admin
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

Optional: evaluate `knip` or `depcheck` in a separate non-blocking inventory pass; review dynamic imports/framework entry points before removing anything. This does not replace vulnerability or license checks.


## Local verification (2026-10-13)
- Three consecutive root lint/typecheck/test/guardrail runs pass. ESLint Node API confirms 0 errors and 0 warnings in all three apps; backend has 8 suites/35 passing tests, audit gate has 16 passing tests.
- Fresh `npm ci` succeeds in separate temporary backend/consumer/admin directories, with identical lockfile hashes before and after.
- All three images build using Node 22. The backend container's default command starts successfully; `node --version` inside it returns v22.23.3. Six authenticated HTTP error scenarios pass against disposable Postgres 17 with Redis/RabbitMQ disabled.
- Production dependency audits report 0 vulnerabilities in each app following owner-authorized compatible updates. Backend full/dev audit still has 29 high and 5 moderate baseline findings; PR delta checks include dev dependencies and pass against the prior lockfile because those findings are unchanged. Track remediation separately without suppressing newly introduced vulnerabilities.
- CI/Dependabot YAML parses; Node constraints are consistent across root/apps/Dockerfiles/setup/CI. Portfolio changes are only engine metadata; its Dockerfile already uses Node 22.
- GitHub checkpoint verified: draft PR #40, commit `113abfb`, [CI run](https://github.com/PosBuzz/PosClient/actions/runs/38293064702), 17/17 successful jobs including all three Docker builds. Publication was explicitly authorized by the owner; the master P0 tracker is now ticked.
