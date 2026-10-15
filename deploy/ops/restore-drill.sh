#!/usr/bin/env bash
# Monthly (restore-drill.timer): prove the newest R2 backup can really be restored.
# Downloads it, decrypts with the server-side DRILL key, loads it into a throwaway
# Postgres with no network, and compares it with the live database.
# Reports to Healthchecks.io (DRILL_URL in /opt/posbuzz/env/health.env).
set -euo pipefail
umask 077
source /opt/posbuzz/env/backup.env
source /opt/posbuzz/env/health.env
T="$(mktemp -d)"
trap 'docker rm -f pgdrill >/dev/null 2>&1 || true; rm -rf "$T"' EXIT
fail() { echo "DRILL FAILED: $1" >&2; echo "$1" | curl -fsS -m 10 --retry 3 --data-binary @- "$DRILL_URL/fail" >/dev/null || true; exit 1; }

export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

F="$(rclone lsf "R2:${R2_BUCKET}/daily" 2>/dev/null | sort | tail -1)"
[ -n "$F" ] || fail "no backups found in R2"
# Backups are named posbuzz-<UTC stamp>.sql.gz.age: the newest must be under 36 h old.
STAMP="${F#posbuzz-}"; STAMP="${STAMP%%.sql*}"
AGE_H=$(( ( $(date -u +%s) - $(date -u -d "${STAMP:0:4}-${STAMP:4:2}-${STAMP:6:2} ${STAMP:9:2}:${STAMP:11:2}:${STAMP:13:2}" +%s) ) / 3600 ))
[ "$AGE_H" -lt 36 ] || fail "newest backup $F is ${AGE_H}h old"

rclone copyto "R2:${R2_BUCKET}/daily/$F" "$T/b.age" 2>/dev/null || fail "download of $F failed"
age -d -i /root/age-drill.key "$T/b.age" 2>/dev/null | gunzip > "$T/b.sql" || fail "cannot decrypt $F with the drill key"

docker run -d --name pgdrill --network none -e POSTGRES_PASSWORD=x postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do docker exec pgdrill pg_isready -U postgres -q 2>/dev/null && break; sleep 2; done
docker exec pgdrill createdb -U postgres posbuzz
docker cp "$T/b.sql" pgdrill:/b.sql
docker exec pgdrill psql -U postgres -d posbuzz -q -v ON_ERROR_STOP=1 -f /b.sql >/dev/null 2>"$T/err" || fail "restore errors: $(head -c 300 "$T/err")"

q() { docker exec "$1" psql -U postgres -d posbuzz -Atc "$2"; }
LT=$(q posbuzz-postgres "select count(*) from information_schema.tables where table_schema='public'")
RT=$(q pgdrill          "select count(*) from information_schema.tables where table_schema='public'")
LS=$(q posbuzz-postgres "select count(*) from sales");  RS=$(q pgdrill "select count(*) from sales")
RU=$(q pgdrill "select count(*) from users")
[ "$RT" = "$LT" ] || fail "table count restored=$RT live=$LT"
[ "$RU" -gt 0 ] || fail "restored users table is empty"
# The backup is up to a day older than live: sales may only be equal or fewer, and not wildly fewer.
[ "$RS" -le "$LS" ] && [ $(( RS * 10 )) -ge $(( LS * 9 )) ] || fail "sales restored=$RS live=$LS"

MSG="restore drill ok: $F (${AGE_H}h old) tables=$RT sales=$RS/$LS users=$RU"
echo "$MSG"
echo "$MSG" | curl -fsS -m 10 --retry 3 --data-binary @- "$DRILL_URL" >/dev/null
