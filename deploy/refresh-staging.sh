#!/usr/bin/env bash
# Replace the staging database with a copy of production (on demand).
# Real data sits in staging afterwards: it is only reachable behind the app's
# login and the backend has no outbound mail/SMS/payment integrations.
# Staging's own data is snapshotted first (last 3 kept in snapshots/), so a refresh
# never loses staging work; if the snapshot fails the refresh does not run.
set -euo pipefail
cd /opt/posbuzz-staging
COMPOSE=(docker compose -p posclient-stg --env-file ./env/stack.env -f docker-compose.prod.yml)
export IMAGE_PREFIX="ghcr.io/posbuzz/posclient" TAG="$(cat last-good-tag)" FRONT_TAG="$(cat last-good-tag)-stg"

mkdir -p snapshots
SNAP="snapshots/staging-before-refresh-$(date -u +%Y%m%dT%H%M%SZ).dump"
echo "snapshotting staging -> $SNAP"
docker exec posbuzz-stg-postgres pg_dump -U postgres -Fc -d posbuzz > "$SNAP.partial"
[ "$(stat -c %s "$SNAP.partial")" -gt 1024 ] || { rm -f "$SNAP.partial"; echo "snapshot too small, refresh aborted" >&2; exit 1; }
mv "$SNAP.partial" "$SNAP"
ls -1t snapshots/*.dump | tail -n +4 | while read -r f; do rm -f "$f"; done

echo "stopping staging backend and portfolio"
"${COMPOSE[@]}" stop backend portfolio
# Start from an empty database: pg_restore --clean only drops objects that exist in the
# production dump, so tables from a newer staging-only migration would survive and make
# the next `prisma migrate deploy` fail.
docker exec posbuzz-stg-postgres psql -U postgres -d postgres -q -c "DROP DATABASE IF EXISTS posbuzz WITH (FORCE)" -c "CREATE DATABASE posbuzz"
docker exec posbuzz-postgres pg_dump -U postgres -Fc -d posbuzz \
  | docker exec -i posbuzz-stg-postgres pg_restore -U postgres -d posbuzz --no-owner
echo "restored; starting staging (migrations run on backend start)"
"${COMPOSE[@]}" up -d backend portfolio
echo "staging database refreshed from production; previous staging data: $SNAP"
echo "to get it back: docker exec -i posbuzz-stg-postgres pg_restore -U postgres -d posbuzz --clean --if-exists --no-owner < /opt/posbuzz-staging/$SNAP   (snapshot restore: stop staging backend/portfolio first)"
