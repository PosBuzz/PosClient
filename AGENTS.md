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


# Testing & CI (PosBuzz)

The test and safety-net plan lives in `docs/testing/` — start at `docs/testing/README.md` (phase tracker),
then `DECISIONS.md` (D-xxx), `KNOWN-ISSUES.md` (KI-xxx) and `OWNER-ACTIONS.md`.

- Never lower an assertion, coverage floor or mutation threshold to make something pass; fix the code or add tests. Log defects as KI-xxx and decisions as D-xxx.
- Backend: `npm test` (unit), `npm run test:int` (needs `docker compose -f docker-compose.test.yml up -d --wait`), `npm run test:mutation:unit`. Domain mutation is nightly-only and sharded with `STRYKER_SHARD=i/32` (`npm run test:mutation:shard`); `scripts/mutation-tier-gate.mjs` merges shard reports.
- Consumer / admin: `npm test`, `npm run typecheck`, `npm run lint:check`. Consumer mutation: `npm run test:mutation -- <src file>` (one target per run).
- `ci.yml` runs every job on every PR and push to `main`; `All checks` is the single aggregator the deploy workflow looks up. Path-filtering was tried and reverted — do not reintroduce it without asking. Branch protection is intentionally not used (D-065).
- `nightly.yml` is not on `main` until the PR merges, so it cannot be dispatched with `gh workflow run`; to test it, push a throwaway branch with a temporary `push` trigger and delete it afterwards. It skips on schedule when there are no commits in the last 25 hours.
- Do not push repeatedly while CI runs: a new push cancels the run in progress. Mutation and E2E jobs are expensive; the GitHub Actions budget has run out once (2026-10-14).
- E2E (`e2e/`) logs in against a 5/min throttle; the login budget is persisted under `e2e/.cache`. Do not change the production throttle.
- Deploy: `pull.sh` pulls the latest `main` (accepted for now); the deploy workflow requires a green `All checks` on the commit. Deploy proofs wait for the owner.
