# Phase X3: CI Enforcement, Deploy Gating & Maintenance

**Goal:** make the safety net **mandatory**. Nothing merges to `main` and nothing deploys unless every
check is green, and the net keeps growing as the code grows.

**Depends on:** all previous phases (CI jobs already exist; this phase locks them in).

---

## 1. Final `ci.yml` job inventory
By now `.github/workflows/ci.yml` contains (verify each exists and is green on `main`):
| Job | From phase |
|---|---|
| `static` (matrix backend/consumer/admin) | P0 |
| `build` (matrix) | P0 |
| `docker-build` (matrix) | P0 |
| `dependency-audit` (backend/consumer/admin, high/critical production findings) | P0 |
| `dependency-review` (PR dependency vulnerabilities + reviewed denied licenses) | P0/X3 |
| `backend-unit` (with coverage) | P0/B2 |
| `backend-integration` (int + tz + e2e + migration guard + contracts clean check) | B1/B3/B4/B5/B6 |
| `consumer-tests` | C1–C4 |
| `admin-tests` | A1/A2 |
| `contracts` | X1 |
| `e2e` | X2 |
| `backend-mutation-unit`, `consumer-mutation` (path-filtered) | B7/C5 |
| `secret-scan` | this phase §2 |
| `tests-required` | this phase §5 |

Add a final aggregator job so branch protection needs only one required check, plus the
individual ones:
```yaml
  all-green:
    name: All checks
    if: always()
    needs: [static, build, docker-build, dependency-audit, dependency-review, backend-unit, backend-integration, consumer-tests, admin-tests, contracts, e2e, secret-scan, tests-required]
    runs-on: ubuntu-latest
    steps:
      - name: Require successful mandatory jobs
        env:
          JOB_RESULTS: ${{ toJSON(needs) }}
          EVENT_NAME: ${{ github.event_name }}
        run: |
          node --input-type=module <<'JS'
          const jobs = JSON.parse(process.env.JOB_RESULTS);
          for (const [name, job] of Object.entries(jobs)) {
            const allowedSkip = name === 'dependency-review' && process.env.EVENT_NAME !== 'pull_request';
            if (job.result !== 'success' && !(allowedSkip && job.result === 'skipped')) {
              console.error(`${name}: ${job.result}`);
              process.exitCode = 1;
            }
          }
          JS
```
`dependency-review` is skipped only on pushes because it compares PR base/head; it is required on PRs. The aggregator above rejects skipped mandatory jobs, including dependency-review on a PR.

Path-filtered mutation jobs are in `all-green.needs`. Only their expensive steps are filtered;
the jobs succeed when no relevant paths changed. A mutation failure therefore blocks the required
"All checks" status, and a failed path-filter cannot silently bypass the gate.

## 2. Secret scanning (KI-012)
```yaml
  secret-scan:
    name: Secret scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
```
| ID | Rule |
|---|---|
| X-SEC-001 | Gitleaks passes on the PR diff. On first enablement it will flag the committed `.env.docker` and `backend/.env.docker`. Those secrets were rotated on the VM (KI-012 resolved, D-010), so add both paths to `.gitleaksignore` with a comment referencing D-010. Also allowlist the test-only values (`test/setup/test-env.ts`, `e2e/.env.e2e`, which contain `test`/`e2e` and `not-for-prod`). Keep `secret-scan` in `all-green.needs`; any **new** secret fails the build |

## 3. Branch protection — DROPPED (D-065)
Not applied: the repo is not on a GitHub plan/team that supports it. `All checks` is still the
single aggregator, and CI/deploy gating below is enforced by workflows, not by GitHub settings.

`CODEOWNERS` (repo root `.github/CODEOWNERS`):
```
/contracts/                 @Istiak-A-Tashrif
/docs/testing/              @Istiak-A-Tashrif
/backend/prisma/migrations/ @Istiak-A-Tashrif
/.github/workflows/         @Istiak-A-Tashrif
```
(D-007.) CODEOWNERS is advisory without branch protection.

## 4. Deploy gating
Today both deploy workflows (`deploy-backend.yml`, `deploy-ai-service.yml`) are
`workflow_dispatch` and SSH straight to the VM, with no check that CI passed for that commit. Add
this as the **first step** of the `deploy-backend` job (the AI service is out of scope, but adding
the same step there is harmless):
```yaml
      - name: Require green CI for this commit
        env: { GH_TOKEN: "${{ github.token }}" }
        run: |
          conclusion=$(gh api "repos/${{ github.repository }}/commits/${{ github.sha }}/check-runs?check_name=All%20checks" \
            --jq '.check_runs | sort_by(.completed_at) | last | .conclusion')
          echo "All checks conclusion: $conclusion"
          [ "$conclusion" = "success" ] || { echo "::error::CI is not green for ${{ github.sha }}"; exit 1; }
```
Add `permissions: { checks: read, contents: read }` to the job. Note that the VM runs `./pull.sh`
(pulls the latest code), so deploying from an **older** green SHA still deploys the newest
`main`. Document that limitation in DECISIONS.md as a QUESTION for the owner (should `pull.sh`
check out `${{ github.sha }}`?). Do not change `pull.sh` in this phase.

## 5. "Tests required" rule for every future PR
`tests-required` job: fails when a PR changes production code without touching any test,
unless it has the label `no-tests-needed` **and** a line `No tests because: …` in the PR body.
```yaml
  tests-required:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: |
          base=${{ github.event.pull_request.base.sha }}
          src=$(git diff --name-only $base...HEAD | grep -E '^(backend/src|backend/prisma|consumer/src|admin/src)/' | grep -vE '\.(spec|test|int-spec|e2e-spec)\.tsx?$' || true)
          tests=$(git diff --name-only $base...HEAD | grep -E '(\.spec\.ts|\.test\.tsx?|int-spec\.ts|e2e-spec\.ts|^contracts/|^e2e/)' || true)
          labels='${{ toJson(github.event.pull_request.labels.*.name) }}'
          if [ -n "$src" ] && [ -z "$tests" ] && ! echo "$labels" | grep -q no-tests-needed; then
            echo "::error::Production code changed without tests. Add tests or label no-tests-needed with a reason."; exit 1; fi
```
Add `.github/pull_request_template.md`:
```
## What changed
## Tests
- [ ] Unit / integration / flow tests added or updated (IDs: )
- [ ] Contracts regenerated? (UPDATE_CONTRACTS=1) — reviewed diff in contracts/
- [ ] New KNOWN-ISSUES / DECISIONS entries:
No tests because: (only with label no-tests-needed)
```

## 6. Nightly (`.github/workflows/nightly.yml`)
`on: schedule: - cron: "0 20 * * *"` (02:00 Asia/Dhaka) + `workflow_dispatch`. Jobs:
1. `backend-mutation-domain`: `npm run test:mutation:domain`, upload the HTML report.
2. `consumer-mutation-full`: `npm run test:mutation` with `--incremental false`.
3. `backend-tz-matrix`: `test:int` with `TZ` ∈ {`UTC`, `Asia/Dhaka`, `America/New_York`} (catches local-time code paths that the business-day scenario misses).
4. `e2e-repeat`: the Playwright suite 3× (`--repeat-each=3`) to surface flakiness.
5. On any failure: open or update a GitHub issue titled `Nightly failure: <job>` using
   `gh issue create`/`gh issue comment` (`permissions: issues: write`).

## 7. Coverage ratchet
`scripts/coverage-ratchet.mjs`: reads `backend/coverage/coverage-summary.json`,
`consumer/coverage/coverage-summary.json` and `admin/coverage/coverage-summary.json` (enable the
`json-summary` reporter in Jest: `"coverageReporters": ["text-summary","json-summary","html"]`),
compares them with the committed `coverage-baseline.json`:
- any metric **drops by > 0.5 points** → fail;
- any metric **rises by > 1 point** → print `Run node scripts/coverage-ratchet.mjs --update and commit coverage-baseline.json`.
  Run it in `backend-unit`, `consumer-tests` and `admin-tests` after the coverage run. Update the
  baseline in normal PRs (reviewed by CODEOWNERS for `/docs/testing/`; put the baseline file under
  `docs/testing/coverage-baseline.json`).

## 8. Living-document rules (add to `docs/testing/README.md` §3 when this phase lands)
1. New controller/route → B5 manifest diff + policy entry + permission/tenancy sweep coverage
   are automatic. Just regenerate `contracts/routes.json` and review.
2. New page in consumer/admin → `smoke-coverage.test.ts` forces at least a smoke test.
3. New `useMutation` → CO-API-022 forces a retry decision.
4. New Prisma model with `consumer_id` → BE-UTIL-003 forces the purge scope and INV-13 covers tenancy.
5. New money/stock flow → add it to B3 and to the B4 scenario; INV-01…13 apply automatically.
6. A KI fixed → remove the `failing` marker in the **same PR** as the fix (the test turns green, and
   `it.failing` then fails the run, forcing this).
7. Quarterly: re-run the exploration checklist (count routes/pages/models; compare with the numbers
   in each README's "Current state") and update the docs.

## 9. Manual checklist (things not worth automating yet)
Record each run in DECISIONS.md:
- Backup → restore round-trip on a staging copy (admin backup&restore uses `pg_dump`/`psql`; BE-ADM-006 was skipped).
- Thermal printer + barcode printer with the real Windows print agent (`PrintingFromWebToPOSPrinter`, out of scope).
- PWA update flow (`swUpdate.ts`) after a deploy.

## Exit criteria
- [x] ~~`All checks` required status on `main`~~ — dropped (D-065); no branch protection.
- [ ] Deploy workflow refuses a SHA without green CI (prove it with a dispatch on a red branch).
- [ ] Nightly ran once successfully, or opened an issue for real findings.
- [ ] Coverage baseline committed; ratchet active.


## Dependency maintenance and exit checks (P0/D-014)
Use P0's `ci.yml` dependency-audit/review jobs and weekly `.github/dependabot.yml`; do not duplicate workflows. Keep both gates in `all-green.needs` and required for merges. Add the immutable lockfile check after **every** `npm ci` in jobs introduced by later phases.

| ID | Required evidence |
|---|---|
| X-DEP-001 | Each app runs `npm audit --audit-level=high --omit=dev`; the JSON evaluator blocks all unaccepted high/critical findings and fails closed on audit errors |
| X-DEP-002 | SECURITY-NOTES accepted SPA advisory is scoped to advisory/app/package/version/path; a new unrelated high finding fails; changed scope or expired exception requires review |
| X-DEP-003 | PR dependency review blocks a deliberately introduced vulnerable dependency; prove the reviewed `deny-licenses` policy blocks a disallowed license too |
| X-DEP-004 | `npm ci` leaves backend/consumer/admin package-lock.json unchanged; introduce an intentional lockfile mutation to prove the job fails |
| X-DEP-005 | Dependabot covers npm in /backend, /consumer, /admin and github-actions at /, weekly; review updates and remove obsolete overrides/exceptions |

License policy and repository dependency-review support are prerequisites for X-DEP-003 completion. Review accepted findings whenever dependencies or routing architecture change; do not add blanket exemptions. Optional knip/depcheck findings are maintenance work, never an excuse to delete code without reversible changes and review.
