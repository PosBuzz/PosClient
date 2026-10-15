# Deploy: staging, then promote to production

Two environments on one VPS (195.35.45.101, ssh port 22222), separate stacks, databases and secrets:

| | staging | production |
|---|---|---|
| domains | `posbuzz.cloud`, `api.` / `admin.` / `portfolio.` | `posbuzz.xyz`, `api.` / `admin.` / `portfolio.` |
| ports (127.0.0.1) | 4000 consumer, 4001 admin, 4002 portfolio, 4800 api | 3000, 3001, 3002, 8000 |
| directory | `/opt/posbuzz-staging` | `/opt/posbuzz` |
| containers / project | `posbuzz-stg-*` / `posclient-stg` | `posbuzz-*` / `posclient` |
| database volume | `posclient_stg_postgres_data` | `posclient_postgres_data` |

Branch flow (only `main` and `staging` exist long-term):
1. Work on a feature branch, open a PR **into `staging`**. CI runs on the PR.
2. Merge it: `staging` -> CI -> (green `All checks`) -> **Deploy** workflow builds the images and rolls out **staging** (`api.posbuzz.cloud` frontends, tag `<sha>-stg`).
3. Test on staging. Pull fresh production data into it any time: Actions -> **Refresh staging data**. It replaces the staging database with a fresh copy of production (nothing is merged) after saving staging's own data to `/opt/posbuzz-staging/snapshots/` (last 3 kept; the refresh aborts if the snapshot fails). To get old staging data back, stop staging backend/portfolio and run the `pg_restore` command printed at the end of the refresh log.
4. Open a PR **`staging` -> `main`** and merge it: `main` -> CI -> **Deploy** rolls out **production** (`api.posbuzz.xyz` frontends, tag `<sha>-prod`). Production only ever receives code that was merged on staging first (convention, not enforced by branch protection, see D-065).

The Deploy workflow picks the environment from the branch: `staging` -> staging, `main` -> production. It refuses a commit without a green `All checks`, or one that is not on that branch, builds only the apps whose files changed since the last successful deploy of that branch (the others are re-tagged in the registry, seconds, no rebuild; `admin`/`consumer` also count `contracts/`) - backend/portfolio (tag = sha) and the two frontends (tag `<sha>-stg` / `<sha>-prod`, API URL baked in), deploys over SSH, health-checks, rolls back on failure, smoke-tests the live site (status codes, cache headers, and that each frontend talks to its own API) and prunes old images.
Both deploys keep a pre-deploy `pg_dump` (last 5 in `predeploy/`) and roll back images, not migrations.
Re-deploy by hand: Actions -> Deploy -> Run workflow (pick the environment, optional `sha`). Hotfix: PR straight into `main`, then merge `main` back into `staging`.

## Server layout (shown for production; staging is the same under `/opt/posbuzz-staging`)
- `docker-compose.prod.yml`, `deploy.sh`: copied from the repo on every deploy.
- `env/stack.env` (DB password), `env/backend.env`, `env/portfolio.env`: server-only secrets, never in git. The Postgres password was rotated on 2026-10-15 (the old one had been committed). To rotate again: `ALTER USER postgres PASSWORD '…'` in the running container, update `DB_PASSWORD` in `stack.env` and `backend.env`, then `docker compose --env-file env/stack.env -f docker-compose.prod.yml up -d postgres backend` with `TAG=$(cat last-good-tag)`.
- `data/`: backend uploads, receipts, temp. `last-good-tag`: rollback target.
- Postgres uses the pre-existing volume `posclient_postgres_data`.
- Host nginx (`deploy/nginx/posbuzz.conf` -> `/etc/nginx/sites-enabled/posbuzz`) routes by hostname to the ports in the table above; staging also sends `X-Robots-Tag: noindex`.
- Certificates: `*.posbuzz.cloud` and `*.posbuzz.xyz` via certbot dns-cloudflare (`/root/.cloudflare*.ini`), auto-renewed.

## Access model
- GitHub secrets `DEPLOY_*` hold a key for the `deploy` user. That key is forced to
  `/usr/local/bin/posbuzz-deploy-entry`, which only accepts `deploy staging|production <40-hex sha>` and `refresh-staging`.
- `testadmin` logs in with a key only. Password SSH, root login are off; UFW allows 22222/80/443; fail2ban watches sshd.
- Backups before the rebuild: `pg_dump -Fc` of `posbuzz` (see docs/testing).

## Env files in git
No `.env.docker` or `.env.docker.example` files are tracked (removed 2026-10-15) and the root `docker-compose.yml` is gone. Secrets live only on the server. The public frontend build values (API URL, root admin email, Cloudinary cloud name and preset) are `ENV` lines in `admin/Dockerfile` and `consumer/Dockerfile`. Old values remain in git history; the JWT/CSRF/revalidate secrets were regenerated and the DB password rotated, so only the history copy is stale.

## Database backups, alerts and restore drills
All run on the VPS as root from systemd timers; scripts live in `/usr/local/sbin/posbuzz-*` (source: `deploy/backup-db.sh`, `deploy/ops/`, units `deploy/backup-db.*`, `deploy/ops/*.service|timer`). Config and secrets are root-only in `/opt/posbuzz/env/` (`backup.env`: R2 keys, age public keys, backup ping URL; `health.env`: the two other ping URLs). Alerts go through Healthchecks.io (project "posbuzz": email now; add Telegram under Integrations and assign it to the three checks).

| timer | when | what | Healthchecks check |
|---|---|---|---|
| `backup-db.timer` | nightly 02:30 Dhaka | `pg_dump` -> gzip -> `age` (owner key + server drill key) -> R2 `posbuzz/daily/`, 14 days kept | `posbuzz-db-backup` (cron `30 2 * * *`, grace 2 h) |
| `health-check.timer` | every 5 min | disk < 80 %, memory < 85 %, all 10 containers healthy, docker/nginx/fail2ban running, certs > 14 days; pings only when all OK | `posbuzz-server-health` (period 5 min, grace 10 min) |
| `restore-drill.timer` | 1st of the month 04:00 Dhaka | restores the newest backup into a throwaway no-network Postgres and compares tables / sales / users with live | `posbuzz-restore-drill` (cron `0 4 1 * *`, grace 6 h) |

A missed ping (dead server, stuck job) alerts just like an explicit failure. Keys: the **owner's offline age key** is the recovery key (kept off the server); `/root/age-drill.key` lets the drill run unattended. Anyone who only reaches the R2 bucket still cannot read a backup. Manual restore: `rclone copyto R2:posbuzz/daily/<file> f.age; age -d -i key.txt f.age | gunzip | psql -U postgres -d <db>`. Run a drill on demand: `sudo /usr/local/sbin/posbuzz-restore-drill`. Backups made before 2026-10-15 17:46 UTC were encrypted to the owner key only.

## Dependency security
CI audits production dependencies of backend, consumer, admin and portfolio (high+ fails the build; the only exception list is `.github/audit-exceptions.json`). As of 2026-10-15 `npm audit` (including dev dependencies) reports 0 findings in all four apps: backend moved to Jest 30 (drops the vulnerable `braces`/`micromatch`), and `package.json` overrides pin `typed-rest-client`'s `qs` (Stryker) and the `js-yaml` used by `@istanbuljs/load-nyc-config` (Jest coverage; avoids `sprintf-js`, which has no patched release). Re-check those overrides when Stryker/Jest are next upgraded. The backend image is built from `npm ci --omit=dev` (prisma is a real dependency since the container runs `prisma migrate deploy`). GitHub Dependabot alerts are on (notifications only); version-update and security-update PRs are off.

## Not covered yet
- Redis and RabbitMQ are not deployed (the backend treats both as optional and off by default).
- `posbuzz.com` has no DNS A record (left as is by the owner); the smoke test probes `portfolio.posbuzz.cloud` instead.
- Database rollback: the deploy rolls images back, not migrations.
