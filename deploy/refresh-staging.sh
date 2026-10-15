#!/usr/bin/env bash
# Replace the staging database with a copy of production (on demand).
# Real data sits in staging afterwards: it is only reachable behind the app's
# login and the backend has no outbound mail/SMS/payment integrations.
set -euo pipefail
cd /opt/posbuzz-staging
COMPOSE=(docker compose -p posclient-stg --env-file ./env/stack.env -f docker-compose.prod.yml)
export IMAGE_PREFIX="ghcr.io/posbuzz/posclient" TAG="$(cat last-good-tag)" FRONT_TAG="$(cat last-good-tag)-stg"

echo "stopping staging backend and portfolio"
"${COMPOSE[@]}" stop backend portfolio
docker exec posbuzz-postgres pg_dump -U postgres -Fc -d posbuzz \
  | docker exec -i posbuzz-stg-postgres pg_restore -U postgres -d posbuzz --clean --if-exists --no-owner
echo "restored; starting staging (migrations run on backend start)"
"${COMPOSE[@]}" up -d backend portfolio
echo "staging database refreshed from production"
