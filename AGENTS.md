<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **PosClient** (13383 symbols, 30979 relationships, 317 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/PosClient/context` | Codebase overview, check index freshness |
| `gitnexus://repo/PosClient/clusters` | All functional areas |
| `gitnexus://repo/PosClient/processes` | All execution flows |
| `gitnexus://repo/PosClient/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->


# PosBuzz: system, testing, CI/CD

Read `docs/SYSTEM.md` first: it summarises the system (apps, environments, branch flow, test layers, rules, standing decisions,
known issues). Operating the server (access, deploy/rollback, logs, restore, secrets, troubleshooting): `docs/OPERATIONS.md`; file-level deploy/backup/alert detail: `deploy/README.md`. The old test-plan documents were removed
on 2026-10-16; the full text is in git history (`git show 840c2b3:docs/testing/<file>`).

## Environments and branch flow
- Two long-lived branches: `staging` (deploys staging, posbuzz.cloud) and `main` (deploys production, posbuzz.xyz). Branch from `staging`, PR into
  `staging`, then PR `staging` -> `main`. Hotfix: PR into `main`, then merge `main` back into `staging`. Branch protection is intentionally not used (D-065).
- One VPS hosts both stacks (`/opt/posbuzz` production, `/opt/posbuzz-staging` staging). Secrets live only on the server (`/opt/posbuzz*/env/`); GitHub
  holds only the `DEPLOY_*` secrets. Never put secrets, tokens or `.env.docker` files in git. Do not change server, DNS, Cloudflare or nginx settings
  without being asked; production deploys happen via the pipeline, not by hand.
- `.github/workflows/deploy.yml` deploys after a green `All checks` (it picks staging or production from the branch, rebuilds only changed apps,
  health-checks, rolls back on failure, smoke-tests). `refresh-staging.yml` replaces staging data with a copy of production (snapshotting staging first).
  Staging and production data are separate databases: never copy data from staging to production.

## Testing and CI rules
- Never lower an assertion, coverage floor or mutation threshold to make something pass; fix the code or add tests. Fix confirmed defects now with a normal
  passing regression test (no `it.failing`/skip). Record decisions in the PR description and, if they change how the system works, in `docs/SYSTEM.md`.
- Backend: `npm test` (unit), `npm run test:int` (needs `docker compose -f docker-compose.test.yml up -d --wait`), `npm run test:mutation:unit`. Domain mutation is
  nightly-only (D-068): `STRYKER_ROTATION=d/7` picks a seventh of the files per night plus `STRYKER_CHANGED_FILES`, split by `STRYKER_SHARD=i/12` with Stryker's
  incremental cache restored per rotation day and shard (D-069) (`npm run test:mutation:shard`); `scripts/mutation-tier-gate.mjs --baseline backend/test/service-coverage/mutation-baseline.json`
  is the ratchet gate (strict floors without `--baseline`). The domain Jest run uses integration + unit specs, never e2e specs (KI-105).
- Consumer / admin: `npm test`, `npm run typecheck`, `npm run lint:check`. Consumer mutation: `npm run test:mutation -- <src file>` (one target per run).
- Test titles start with a stable ID (`[BE-SALE-004]`, `[CO-CALC-012]`, `[AD-AUTH-002]`, `[X-ERR-010]`, `[E2E-J1]`), never reused. Tests set `TZ` explicitly.
- Errors: non-2xx JSON from `/api/v1/**` is `{statusCode, message, error}` with a readable `message` (see `docs/SYSTEM.md` section 4); the client turns errors into
  text only through `getErrorMessage` in `consumer|admin/src/utils/api-error.ts`.
- `ci.yml` runs every job on every PR and on pushes to `main` and `staging`; `All checks` is the single aggregator the deploy workflow looks up. Path-filtering was
  tried and reverted — do not reintroduce it without asking. Dependencies: `npm audit` is at 0 in all four apps; the CI audit gates production dependencies (high+).
- `nightly.yml` is not on the default branch until a PR merges, so it cannot be dispatched with `gh workflow run`; to test it, push a throwaway branch with a
  temporary `push` trigger and delete it afterwards. It skips on schedule when there are no commits in the last 25 hours.
- Do not push repeatedly while CI runs: a new push cancels the run in progress. Mutation and E2E jobs are expensive; the GitHub Actions budget has run out once (2026-10-14).
- E2E (`e2e/`) logs in against a 5/min throttle; the login budget is persisted under `e2e/.cache`. Do not change the production throttle.
