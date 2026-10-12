# Backend Testing Plan (NestJS + Prisma + Postgres)

Master plan, conventions, and the decision playbook live in `../../../docs/testing/`.
**Read `docs/testing/README.md` §3 and `docs/testing/DECISION-PLAYBOOK.md` before starting.**

## Current state (2026-10-12)
- Jest 29 + ts-jest. `npm test` runs `src/**/*.spec.ts`: 8 suites, 35 tests, all mocked-Prisma
  unit tests. Keep them (D-002).
- `test/app.e2e-spec.ts` + `test/jest-e2e.json` are the Nest scaffold and have never been wired up
  (they need a DB and env). Phase B1 replaces them.
- About 245 TS files, 40 controllers, ~269 routes, 75 Prisma models, 22 migrations (they apply
  cleanly to an empty Postgres 17 with no drift since the KI-007 fix migration).
- Boot dependencies: Postgres (Prisma) and env vars. Redis and RabbitMQ are **optional, off by
  default** (`REDIS_ENABLED` / `RABBITMQ_ENABLED`, standard compose contains neither; AI compose includes RabbitMQ; D-008/D-012). Env vars are
  validated by Joi in `src/config/config.schema.ts` (`JWT_SECRET_KEY`, `DATABASE_URL`, `DB_USERNAME`,
  `DB_NAME`, `FASTAPI_URL` required).

## Phases
| Phase | Doc | What it buys you |
|---|---|---|
| B1 | `phase-1-test-harness.md` | Real Postgres in tests, app bootstrap identical to prod, factories, auth helpers |
| B2 | `phase-2-unit-pure-logic.md` | Exhaustive tests for pure math (promotion discount, totals, dates, subdomain parsing) |
| B3 | `phase-3-domain-integration.md` | Sale/return/exchange/transfer/adjustment/payment/rewards flows on a real DB + stock-conservation invariant |
| B4 | `phase-4-report-reconciliation.md` | Dashboard, EOD, summaries, variant/user stats must agree with each other and with raw rows |
| B5 | `phase-5-api-security-tenancy.md` | Every route: auth, permission, tenant isolation, CSRF, validation, plus a route manifest that fails on new unprotected routes and response-shape contracts |
| B6 | `phase-6-schema-migrations.md` | Migrations apply from zero; schema has no drift; destructive-migration guard |
| B7 | `phase-7-mutation-testing.md` | Proof that tests catch real code changes (Stryker) |
| B8 | `phase-8-service-coverage-guarantee.md` | All 310 public service methods provably tested, with depth by risk tier and mutation gates |

## Test commands (final state after all phases)
| Script | Runs | Needs Docker |
|---|---|---|
| `npm test` | unit `src/**/*.spec.ts` | no |
| `npm run test:int` | `test/integration/**/*.int-spec.ts` | yes |
| `npm run test:e2e` | `test/e2e/**/*.e2e-spec.ts` | yes |
| `npm run test:all` | all three, in that order | yes |
| `npm run test:mutation` | Stryker on critical modules | yes |

## B1 local checkpoint (2026-10-13)
Real Postgres harness, shared configureApp, auth/CSRF/HTTP helpers and fixtures are implemented. Eighteen self-tests pass three times, including separate real Redis/RabbitMQ opt-in tests. Original 35 unit tests remain green; CI verification is pending publication. See phase-1-test-harness.md for commands and fixes.
