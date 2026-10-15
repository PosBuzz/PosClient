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
- `env/stack.env` (DB password), `env/backend.env`, `env/portfolio.env`: server-only secrets, never in git.
- `data/`: backend uploads, receipts, temp. `last-good-tag`: rollback target.
- Postgres uses the pre-existing volume `posclient_postgres_data`.
- Host nginx (`/etc/nginx/sites-enabled/posbuzz`) proxies to containers bound on 127.0.0.1:3000/3001/3002/8000.

## Access model
- GitHub secrets `DEPLOY_*` hold a key for the `deploy` user. That key is forced to
  `/usr/local/bin/posbuzz-deploy-entry`, which only accepts `deploy <40-hex sha>`.
- `testadmin` logs in with a key only. Password SSH, root login are off; UFW allows 22222/80/443; fail2ban watches sshd.
- Backups before the rebuild: `pg_dump -Fc` of `posbuzz` (see docs/testing).

## Not covered yet
- Redis and RabbitMQ are not deployed (the backend treats both as optional and off by default).
- The Postgres password predates the rebuild and is still the one that was committed in git; rotate it.
- Database rollback: the deploy rolls images back, not migrations.
