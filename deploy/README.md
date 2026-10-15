# Production deploy (CD)

Push to `main` → `CI` → (green `All checks`) → `Deploy` workflow: builds 4 images,
pushes them to GHCR tagged with the commit SHA, then SSHes to the VPS and runs
`deploy/deploy.sh`. It pulls the images, `docker compose up -d`, waits for every
container to be healthy and rolls back to the previous good SHA if not. A final job
smoke-tests the live site, including the cache headers that make a plain refresh
pick up a new build.

Re-deploy or roll forward manually: Actions → Deploy → Run workflow (optional `sha`).

## Server layout (`/opt/posbuzz`, VPS 195.35.45.101, ssh port 22222)
- `docker-compose.prod.yml`, `deploy.sh`: copied from the repo on every deploy.
- `env/stack.env` (DB password), `env/backend.env`, `env/portfolio.env`: server-only secrets, never in git. The Postgres password was rotated on 2026-10-15 (the old one had been committed). To rotate again: `ALTER USER postgres PASSWORD '…'` in the running container, update `DB_PASSWORD` in `stack.env` and `backend.env`, then `docker compose --env-file env/stack.env -f docker-compose.prod.yml up -d postgres backend` with `TAG=$(cat last-good-tag)`.
- `data/`: backend uploads, receipts, temp. `last-good-tag`: rollback target.
- Postgres uses the pre-existing volume `posclient_postgres_data`.
- Host nginx (`/etc/nginx/sites-enabled/posbuzz`) proxies to containers bound on 127.0.0.1:3000/3001/3002/8000.

## Access model
- GitHub secrets `DEPLOY_*` hold a key for the `deploy` user. That key is forced to
  `/usr/local/bin/posbuzz-deploy-entry`, which only accepts `deploy <40-hex sha>`.
- `testadmin` logs in with a key only. Password SSH, root login are off; UFW allows 22222/80/443; fail2ban watches sshd.
- Backups before the rebuild: `pg_dump -Fc` of `posbuzz` (see docs/testing).

## Env files in git
No `.env.docker` or `.env.docker.example` files are tracked (removed 2026-10-15) and the root `docker-compose.yml` is gone. Secrets live only on the server. The public frontend build values (API URL, root admin email, Cloudinary cloud name and preset) are `ENV` lines in `admin/Dockerfile` and `consumer/Dockerfile`. Old values remain in git history; the JWT/CSRF/revalidate secrets were regenerated and the DB password rotated, so only the history copy is stale.

## Not covered yet
- Redis and RabbitMQ are not deployed (the backend treats both as optional and off by default).
- `posbuzz.com` has no DNS A record (left as is by the owner); the smoke test probes `portfolio.posbuzz.cloud` instead.
- Database rollback: the deploy rolls images back, not migrations.
