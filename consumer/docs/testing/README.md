# Consumer (POS app) Testing Plan

Master plan, conventions and the decision playbook live in `../../../docs/testing/`.
**Read `docs/testing/README.md` §3 and `docs/testing/DECISION-PLAYBOOK.md` first.**

## Current state (2026-10-12)
- React 19, Vite 6.4.3 (installed), antd 5, TanStack Query 5, zustand 5, react-router 7, axios.
- **No tests, no test runner.** `tsc -b` is green. ESLint has 6 errors (P0 fixes them).
- 196 TS/TSX files, ~52k lines. The largest pages are `pos/index.tsx` (2400 lines), `returns/create.tsx`
  (1951), `add-sales/index.tsx` (1654), `view-sale`, `dashboard`, `add-quotation`.
- **The money math lives here** (`src/utils/calculate-totals.utils.ts`, `sale-item.utils.ts`,
  `promotion-validation.ts`, `promotion-helpers.utils.ts`). The backend stores what these
  functions compute (see root README §2). That makes this the highest-value test target in the repo.

## Phases
| Phase | Doc | What it buys you |
|---|---|---|
| C1 | `phase-1-test-harness.md` | Vitest + Testing Library + MSW + antd-in-jsdom working |
| C2 | `phase-2-calculation-logic.md` | Exhaustive + property tests for every cent the POS computes |
| C3 | `phase-3-api-stores-hooks.md` | axios CSRF/refresh interceptors, auth store, permission guards, hooks |
| C4 | `phase-4-page-flows.md` | POS / add-sale / returns / payments / dashboard flows against backend-generated contract data |
| C5 | `phase-5-mutation-testing.md` | Stryker proves the calculation tests catch changes |

## Final test commands
| Script | Runs |
|---|---|
| `npm test` | `vitest run` (all unit + flow tests) |
| `npm run test:watch` | `vitest` |
| `npm run test:cov` | with coverage + thresholds |
| `npm run test:mutation` | Stryker on `src/utils/**` |


## C1 verified checkpoint (2026-10-13)
The Vitest/jsdom/Testing Library/MSW harness is implemented. Seven smoke and isolation checks pass three times; test-aware typecheck, production build and zero full audit pass. All 20 jobs passed in [CI run 38301291165](https://github.com/PosBuzz/PosClient/actions/runs/38301291165) on commit `634c2ee`. See phase-1-test-harness.md and D-033.

## C2 local checkpoint (2026-10-13)
Calculation, promotion, formatter, payment-provider, search and subdomain tests (with seeded properties) pass three times with per-file coverage floors enforced. KI-025/026 repaired. See D-036.
