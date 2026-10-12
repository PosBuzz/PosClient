# Phase B6: Schema & Migration Safety

**Goal:** a schema change that would break production deploys (`npx prisma migrate deploy` runs
on container start, per `docker-compose.yml`) or diverge from `schema.prisma` fails CI.

**Depends on:** B1. **Location:** `backend/test/integration/schema.int-spec.ts` + one CI step.

Facts (verified 2026-10-12): 22 migrations apply cleanly to an empty `postgres:17-alpine` with no drift (KI-007 fixed).

---

## 1. KI-007 is already fixed
Migration `prisma/migrations/20261012000000_fix_consumer_data_imports_index_name` renames the
truncated index, and `prisma migrate diff` exits 0 on a freshly migrated DB (verified 2026-10-12).
BE-SCHEMA-002 therefore needs **no** `KNOWN_DRIFT` allowlist and must assert an empty diff.

## 2. Tests
| ID | Test |
|---|---|
| BE-SCHEMA-001 | (Implicit in B1 global setup.) `migrate deploy` from zero succeeds |
| BE-SCHEMA-002 | `npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` outputs nothing other than comments / `-- This is an empty migration.` (run with `execSync`, assert on stdout). Do not use `--exit-code` alone because it hides the diff text. Print the SQL in the failure message |
| BE-SCHEMA-003 | Every migration folder name matches `^\d{14}_[a-z0-9_]*$` and contains `migration.sql` (existing folders like `20251222153804_` with empty suffix pass; that is fine) |
| BE-SCHEMA-004 | **Destructive change guard:** for migration folders **added in this branch** (compare against `origin/main` with `git diff --name-only origin/main...HEAD -- prisma/migrations`), the SQL must not contain `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN … TYPE`, or `TRUNCATE` unless the folder contains a file `ALLOW_DESTRUCTIVE.md` explaining the data migration. Run as a CI script (`scripts/check-destructive-migrations.mjs`), not Jest, because it needs git history |
| BE-SCHEMA-005 | `migration_lock.toml` provider is `postgresql` |
| BE-SCHEMA-006 | **Seed works on a migrated DB:** run `npx tsx prisma/seed.ts` against a fresh container. It is what new environments use. Assert exit 0 and that the seeded admin can log in (reuse BE-SEC-001 helper) |
| BE-SCHEMA-007 | Every model with a `consumer_id` column has an index whose first column is `consumer_id` (query `pg_indexes`). Missing → log as a performance QUESTION, not a failure: implement as a test with a known-exceptions list that you populate on first run |

## 3. CI
Add to `backend-integration` after the integration tests:
```yaml
      - name: Destructive migration guard
        run: node ../scripts/check-destructive-migrations.mjs
```
with `actions/checkout@v4` using `fetch-depth: 0` so `origin/main` exists.

## Exit criteria
- [ ] BE-SCHEMA-001…007 pass (BE-SCHEMA-002 asserts an empty diff).
- [ ] Locally, adding `DROP COLUMN` in a new migration makes the guard fail.
