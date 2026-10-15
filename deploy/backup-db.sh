#!/usr/bin/env bash
# Nightly Postgres backup: pg_dump -> gzip -> age (public-key encrypted) -> Cloudflare R2.
# Runs on the VPS as root from backup-db.timer. Config lives in /opt/posbuzz/env/backup.env:
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, AGE_RECIPIENT
#   optional: KEEP_DAYS (default 14), HEARTBEAT_URL (pinged on success)
# Encrypted to the owner's key (offline, recovery) and, if set, to AGE_DRILL_RECIPIENT
# (private half lives on the server so the monthly restore drill can run unattended).
# Anyone who only reaches the R2 bucket still cannot read a backup.
set -euo pipefail
umask 077
source /opt/posbuzz/env/backup.env

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="posbuzz-${STAMP}.sql.gz.age"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

docker exec posbuzz-postgres pg_dump -U postgres --no-owner -d posbuzz \
  | gzip -9 | age -r "$AGE_RECIPIENT" ${AGE_DRILL_RECIPIENT:+-r "$AGE_DRILL_RECIPIENT"} > "$TMP/$NAME"

# A dump that is suspiciously small means something went wrong: fail loudly.
[ "$(stat -c %s "$TMP/$NAME")" -gt 2048 ] || { echo "backup too small" >&2; exit 1; }

rclone copyto "$TMP/$NAME" "R2:${R2_BUCKET}/daily/${NAME}"
rclone lsf "R2:${R2_BUCKET}/daily/${NAME}" >/dev/null   # confirm it landed

# Retention: delete anything older than KEEP_DAYS.
rclone delete "R2:${R2_BUCKET}/daily" --min-age "${KEEP_DAYS:-14}d"

echo "backup ok: ${NAME} ($(stat -c %s "$TMP/$NAME") bytes)"
[ -z "${HEARTBEAT_URL:-}" ] || curl -fsS -m 10 "$HEARTBEAT_URL" >/dev/null || true
