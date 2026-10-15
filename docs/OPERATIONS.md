# Operating the PosBuzz server

Day-to-day guide. Architecture and the why: [`SYSTEM.md`](SYSTEM.md). File-level detail of the deploy setup: [`deploy/README.md`](../deploy/README.md).
No secrets are written here: passwords and private keys live in the owner's password manager.

## 0. Rules of thumb
- **Deploys go through GitHub, not through the server.** Merge into `staging` to deploy staging; merge `staging` into `main` to deploy production.
- Production and staging share one VPS but are separate stacks and databases. Check the name before you type: `posbuzz-*` is production, `posbuzz-stg-*` is staging.
- Before any manual work on production data: `sudo posbuzz-ctl snapshot prod`.
- Everything on the server runs as root through `sudo`. Prefer the helper `posbuzz-ctl` (below); it only reads, restarts one container, or calls the existing scripts.

## 1. Get in
```
ssh posbuzz          # shortcut on the owner's Mac; the full form is
ssh -i ~/.ssh/posbuzz_admin_ed25519 -p 22222 testadmin@195.35.45.101
sudo -i              # when you need root (asks for the testadmin password)
```
Password login is disabled: the key file is the only way in. Lost key and recovery: `deploy/README.md` ("Access and recovery").

## 2. The helper: `sudo posbuzz-ctl`
| Command | What it does |
|---|---|
| `status` | containers (with deployed commit), timers, disk, memory, deployed commits per environment |
| `logs prod backend [200]` | follow a container's log (Ctrl+C to stop). Services: `backend admin consumer portfolio postgres`; use `stg` for staging |
| `restart stg portfolio` | restart ONE container (keeps its image and env) |
| `psql prod` | SQL shell. Read first, write only after a snapshot |
| `shell prod backend` | `sh` inside a container |
| `health` | run the 5-minute health check now |
| `backup` / `drill` | run the R2 backup / the restore test now |
| `snapshot prod` | dump the database to `/root/manual-dumps/` and print the restore command |
| `last-deploys` | commit deployed to each environment (and counts of safety dumps) |

## 3. Everyday tasks
**See if everything is fine:** `sudo posbuzz-ctl status`. All containers should say `(healthy)`. The health check runs every 5 minutes by itself and alerts you.

**Deploy a change:** PR into `staging` → merge → wait for the Deploy run (Actions tab) → test on posbuzz.cloud → PR `staging` into `main` → merge → production deploys. Nothing to do on the server.

**Redeploy / roll back:** GitHub → Actions → *Deploy* → *Run workflow* → choose the environment and (optionally) a commit `sha` that is on that branch and passed CI. A bad deploy rolls back by itself when the health checks fail (images only, not database migrations).
Server-side emergency rollback (only works while the old images are still on the server, which keeps the current and previous deploy):
```
cd /opt/posbuzz        # or /opt/posbuzz-staging
export IMAGE_PREFIX=ghcr.io/posbuzz/posclient TAG=<old full sha> FRONT_TAG=<old full sha>-prod      # -stg for staging
sudo -E docker compose -p posclient --env-file env/stack.env -f docker-compose.prod.yml up -d        # -p posclient-stg for staging
```

**Look at logs:** `sudo posbuzz-ctl logs prod backend 200`. Slow database statements (over 500 ms) are in the Postgres log: `sudo docker logs posbuzz-postgres 2>&1 | grep duration | tail`.

**Restart something that is stuck:** `sudo posbuzz-ctl restart prod backend` (a restart does NOT pick up changed env files; see "Change a setting").

**Refresh staging with production data:** Actions → *Refresh staging data*. Staging's own data is saved first in `/opt/posbuzz-staging/snapshots/` (last 3). To bring a snapshot back: stop staging backend and portfolio, then `docker exec -i posbuzz-stg-postgres pg_restore -U postgres -d posbuzz --clean --if-exists --no-owner < <snapshot file>`, start them again.

**Change a setting / secret:** edit the env file, then recreate the container so it reads it (`restart` is not enough):
```
sudoedit /opt/posbuzz/env/backend.env          # production API settings (staging: /opt/posbuzz-staging/env/backend.env)
cd /opt/posbuzz && export IMAGE_PREFIX=ghcr.io/posbuzz/posclient TAG=$(cat last-good-tag) FRONT_TAG=$(cat last-good-tag)-prod
sudo -E docker compose -p posclient --env-file env/stack.env -f docker-compose.prod.yml up -d --force-recreate backend
```
Changing `JWT_SECRET_KEY` logs everyone out. After any secret change, make a fresh encrypted config backup (`deploy/README.md`, "What to keep safe").

**Database access and restore:**
- Production data = Docker volume `posclient_postgres_data`. Dumps taken before every deploy: `/opt/posbuzz/predeploy/` (last 5). Nightly encrypted backups: Cloudflare R2 bucket `posbuzz`, folder `daily/` (14 days).
- List R2 backups: `sudo bash -c 'source /opt/posbuzz/env/backup.env; export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY RCLONE_CONFIG_R2_ENDPOINT=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true; rclone lsl R2:posbuzz/daily'`
- Restoring a backup: download it, `age -d -i <key> file.age | gunzip | psql …`. The server's drill key (`/root/age-drill.key`) opens backups made after 2026-10-15 17:46 UTC; older ones need the owner's offline key. Test it any time with `sudo posbuzz-ctl drill`.
- Never restore over production without a `snapshot` first, and stop the backend while you do.

**Certificates:** renew by themselves (`certbot` timer; the health check alerts when one has under 14 days left). Check: `sudo certbot certificates`. Dry run: `sudo certbot renew --dry-run`.

**Change nginx:** edit the repo file `deploy/nginx/posbuzz.conf` (via a PR), copy it to `/etc/nginx/sites-enabled/posbuzz` after `cp` of the old one to a backup, then `sudo nginx -t && sudo systemctl reload nginx`. Never reload without `nginx -t`.

**Updates and reboots:** security updates install by themselves. If `/var/run/reboot-required` exists, reboot in a quiet hour: `sudo reboot`; containers start again on their own (`restart: unless-stopped`); check `sudo posbuzz-ctl status` and wait for the next health-check ping.

**Rotate secrets** (a few times a year, or after any leak):
- *Postgres password:* `ALTER USER postgres PASSWORD '…'` in the running database, then update `DB_PASSWORD` in `env/stack.env` and `env/backend.env`, then `up -d postgres backend` (command above).
- *R2 keys / Healthchecks URLs:* edit `/opt/posbuzz/env/backup.env` or `health.env`; test with `sudo posbuzz-ctl backup`.
- *Cloudflare token (certificates):* edit `/root/.cloudflare.ini` and `/root/.cloudflare-xyz.ini`; test with `sudo certbot renew --dry-run`.
- *Deploy key:* generate a new key pair, replace the GitHub secret `DEPLOY_SSH_KEY` and the key in `/home/deploy/.ssh/authorized_keys` (keep the `restrict,command="/usr/local/bin/posbuzz-deploy-entry"` prefix).
- *Admin SSH key / a new person:* append their public key to `/home/testadmin/.ssh/authorized_keys`; remove a key by deleting its line.

## 4. When something is wrong
| Symptom | Usual cause | What to do |
|---|---|---|
| Alert: *server-health* | the message lists it: disk, memory, an unhealthy container, nginx/docker/fail2ban down, or a certificate | `sudo posbuzz-ctl status`, then `logs` for the container named in the alert |
| Alert: *db-backup* missed | backup script failed, R2 keys wrong, or server was down | `sudo posbuzz-ctl backup`; read the error; check `backup.env` |
| Alert: *restore-drill* | newest backup missing, too old, or cannot be restored | `sudo posbuzz-ctl drill`; the failure message says which |
| Site shows Cloudflare **522 / 521** | origin not answering | server down? `ssh posbuzz`; `sudo systemctl status nginx`; `sudo ufw status` (must allow 80/443) |
| **502 / 504** from nginx | a container is down or restarting | `sudo posbuzz-ctl status`, `logs prod backend`, `restart prod backend` |
| Deploy workflow red | image build, SSH, or health check failed | open the failed job in Actions; the log of the unhealthy container is printed at the end of the deploy step |
| Deploy red at "Resolve commit" | CI was not green or was cancelled for that commit | fix CI, or re-run CI; do not bypass |
| Browser shows a CORS error on `/auth/…` with status 429 | Cloudflare's rate-limit rule (`server: cloudflare`, `error code: 1015`), not the app: it answers without CORS headers | wait 10 s; the rule only covers `/auth/login*` (10 per 10 s per IP); check or loosen it in Cloudflare -> Security -> WAF -> Rate limiting rules |
| Page still shows an old version | should not happen: `index.html` and `sw.js` are never cached | hard refresh once, check `curl -I https://posbuzz.xyz/sw.js` shows `no-store` |
| Disk filling | old images/dumps | `docker image prune -af --filter until=72h`; check `/opt/*/predeploy`, `/root/manual-dumps` |

## 5. Monitoring in one place
- **Healthchecks.io** (project *posbuzz*): `posbuzz-server-health` (every 5 min), `posbuzz-db-backup` (nightly 02:30 Dhaka), `posbuzz-restore-drill` (monthly). Missed pings alert like failures.
- **UptimeRobot** (owner's account): HTTP checks for the four production and four staging URLs.
- **GitHub**: email on failed workflows. **Cloudflare**: traffic and security events per zone.
- All alert channels are the owner's email and Telegram.

## 6. Don't
- Don't run `docker compose down -v`, `docker volume rm`, or `docker system prune --volumes` on the server: the Postgres volumes hold the data.
- Don't edit files in `/opt/*` that the pipeline installs (`docker-compose.prod.yml`, `deploy.sh`): the next deploy overwrites them. Change them in the repo.
- Don't paste secrets into chats, tickets or Google Docs. Don't commit `.env*` files.
- Don't point staging at production services or copy staging data into production.
