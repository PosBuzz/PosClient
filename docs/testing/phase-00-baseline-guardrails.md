# Phase P0: Baseline & Guardrails (repo-wide)

**Goal:** before adding tests, make the *existing* static checks green and run them in CI on
every PR. Otherwise new failures hide among old ones.

**Baseline refreshed 2026-10-13 (requested stricter rules enabled):**
| Check | backend | consumer | admin |
|---|---|---|---|
| `tsc` | Pass: 0 errors | Pass: 0 errors | Pass: 0 errors |
| ESLint | Pass: 0 errors / 0 warnings | Pass: 0 errors / 0 warnings | Pass: 0 errors / 0 warnings |
| Unit tests | Pass: 8 suites, 35 tests (`npm test`) | none | none |
| CI on PR | none (only manual deploy workflows) | none | none |
| Node | v22.23.x locally | same | same |

---

## Step 1: Pin the Node version
1. Create `/.nvmrc` containing `22`.
2. In each of `backend/package.json`, `consumer/package.json`, `admin/package.json`, add:
   ```json
   "engines": { "node": ">=22.12.0" }
   ```
   Reason: Vitest 5, MSW 3, jsdom 30 and Testcontainers 12 all require Node ≥ 22.12 (verified via `npm view <pkg> engines`).
3. Note: **Docker images use `node:20-alpine`** (`backend/`, `consumer/`, `admin/` Dockerfiles), and their
   `npm ci` installs devDependencies too. The `engines` field only produces an `EBADENGINE` **warning**
   (no `engine-strict` is set), so builds keep working. **Do not change the Dockerfiles in a testing PR.**
   The `docker-build` CI job (Step 4) proves the images still build after each phase adds devDependencies.
   If it ever fails because of Node 20, STOP: bumping the base image to `node:22-alpine` is a runtime
   change for the owner, so open a separate PR and log it in DECISIONS.md.

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
"test:all": "npm test --prefix backend"
```
(`test:all` grows in later phases: each phase appends its scripts.)

## Step 4: CI skeleton (`.github/workflows/ci.yml`)
Create this file. **Later phases add jobs to it. Do not create separate workflow files** (except the nightly in X3).

```yaml
name: CI
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
    name: Review dependencies added by PR
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v5
        with:
          fail-on-severity: high
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
      - run: npm test -- --ci
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
1. Root: `npm i -D husky@^9 lint-staged@^17` then `npx husky init`.
2. `.husky/pre-commit`:
   ```sh
   npx lint-staged
   ```
3. Root `package.json`:
   ```json
   "lint-staged": {
     "backend/**/*.ts": ["prettier --check"],
     "consumer/src/**/*.{ts,tsx}": ["prettier --check"],
     "admin/src/**/*.{ts,tsx}": ["prettier --check"]
   }
   ```
   Hooks are a convenience. **CI is the authority.** If a developer objects to hooks, drop step 5
   (log it in DECISIONS.md). CI still enforces everything.

## Exit criteria
- [ ] `npm run lint:all && npm run typecheck:all && npm run test:all` passes at the repo root.
- [ ] `ci.yml` jobs `static`, `backend-unit` and `build` are green on the PR.
- [ ] `git diff -w` of the lint-fix commit shows no logic changes.
- [ ] X3 will make these required checks. Until then, don't merge red PRs.


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
The workflow above is the plan, not an already-installed workflow. Create the referenced files when implementing P0/X3.

- `scripts/check-production-audit.mjs` must parse the JSON and accept only audit exit codes 0/1 with a valid vulnerabilities report. Fail closed on registry/network errors, invalid JSON and unsupported report formats. Follow transitive `via` links to advisory leaves; fail on every high/critical advisory unless its exact advisory/app/package/version/path matches a documented exception. Lower severity findings are reported but do not fail this high/critical gate. Include meaningful tests proving an accepted finding passes, an additional high/critical finding fails, and malformed/unavailable audits fail.
- An exception file may cover **only** `GHSA-qwww-vcr4-c8h2` in `consumer`/`admin` for the currently documented React Router SPA dependency/version/path. Link each entry to `SECURITY-NOTES.md`, record owner/review date and revisit triggers; fail or request review on changed versions/paths, expired exceptions or adoption of server/RSC/data-router behavior. Read installed lockfiles to establish the exact paths at implementation time. Do not allowlist whole packages or ignore audit command failures. The backend starts with no exceptions. Existing overrides are patched dependencies, not reasons to suppress advisories.
- `.github/dependency-review-config.yml` sets `fail-on-severity: high` and the owner's reviewed `deny-licenses` list. Do not invent a license policy; configure it and test it before declaring this gate complete. Keep `allow-ghsas` empty: the accepted existing SPA finding is handled by the production audit gate, while new vulnerable additions stay blocked on PRs. The action reviews dependency changes across the PR, including workflows/development dependencies. Confirm dependency-graph/review support for the repository; if unavailable, document it and implement an equivalent PR delta/license gate before marking X3 complete. See the [action configuration](https://github.com/actions/dependency-review-action) for severity/license inputs.
- Every job running `npm ci` checks `git diff --exit-code HEAD -- backend/package-lock.json consumer/package-lock.json admin/package-lock.json` from the repo root immediately afterward. This includes later integration/frontend/e2e jobs; installed lockfile changes must fail, not be automatically committed.
- Add `.github/dependabot.yml` with the weekly updates below (no automatic merging). These are planned artifacts, not created by this documentation change.

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
