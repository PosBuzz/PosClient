# Deploy: staging, then promote to production

Two environments on one VPS (195.35.45.101, ssh port 22222), separate stacks, databases and secrets:

| | staging | production |
|---|---|---|
| domains | `posbuzz.cloud`, `api.` / `admin.` / `portfolio.` | `posbuzz.xyz`, `api.` / `admin.` / `portfolio.` |
| ports (127.0.0.1) | 4000 consumer, 4001 admin, 4002 portfolio, 4800 api | 3000, 3001, 3002, 8000 |
| directory | `/opt/posbuzz-staging` | `/opt/posbuzz` |
| containers / project | `posbuzz-stg-*` / `posclient-stg` | `posbuzz-*` / `posclient` |
| database volume | `posclient_stg_postgres_data` | `posclient_postgres_data` |

Flow:
1. Push to `main` -> `CI` -> (green `All checks`) -> **Deploy staging** (`deploy.yml`): builds backend, portfolio (shared images, tag = sha) and admin/consumer (tag `<sha>-stg`, API URL `api.posbuzz.cloud`), pushes to GHCR, deploys staging over SSH, health-checks, rolls back on failure, smoke-tests.
2. Test on staging. Refresh its data from production any time: Actions -> **Refresh staging data**.
3. Actions -> **Promote to production** (`promote.yml`, manual): refuses a commit that did not deploy to staging successfully; reuses the exact backend/portfolio images, builds admin/consumer as `<sha>-prod` (API URL `api.posbuzz.xyz`), deploys production, smoke-tests it.

Both deploys keep a pre-deploy `pg_dump` (last 5 in `predeploy/`), roll back images (not migrations) on a failed health check, and prune old images.
Re-deploy staging by hand: Actions -> Deploy staging -> Run workflow (optional `sha`).

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

## Database backups
`backup-db.timer` runs `/usr/local/sbin/posbuzz-backup-db` (this repo: `deploy/backup-db.sh`) every night at 02:30 Dhaka: `pg_dump` -> gzip -> `age` (public key only on the server) -> Cloudflare R2 bucket `posbuzz`, prefix `daily/`, 14 days kept. Config and R2 keys: `/opt/posbuzz/env/backup.env` (root only). The private age key is held by the owner (password manager), never on the server. Install/update on the server: copy the script to `/usr/local/sbin/posbuzz-backup-db` (root, 700) and `backup-db.service`/`.timer` to `/etc/systemd/system/`, then `systemctl enable --now backup-db.timer`.
Restore: `rclone copyto R2:posbuzz/daily/<file> f.age; age -d -i key.txt f.age | gunzip | psql -U postgres -d <db>`. A first backup was restored into a scratch database on 2026-10-15 (74 tables, matching production).

## Not covered yet
- Redis and RabbitMQ are not deployed (the backend treats both as optional and off by default).
- `posbuzz.com` has no DNS A record (left as is by the owner); the smoke test probes `portfolio.posbuzz.cloud` instead.
- Database rollback: the deploy rolls images back, not migrations.
