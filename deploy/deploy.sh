#!/usr/bin/env bash
# Runs on the VPS as the deploy user: pull the images for one commit, restart
# one environment's stack, wait for health, and roll back to that environment's
# last good tag on failure.
#   deploy.sh staging|production <git sha>
set -euo pipefail

ENVIRONMENT="${1:?usage: deploy.sh staging|production <sha>}"
TAG="${2:?usage: deploy.sh staging|production <sha>}"

case "$ENVIRONMENT" in
  production) ROOT=/opt/posbuzz;         PROJECT=posclient;     CN=posbuzz;     SUFFIX=prod ;;
  staging)    ROOT=/opt/posbuzz-staging; PROJECT=posclient-stg; CN=posbuzz-stg; SUFFIX=stg  ;;
  *) echo "unknown environment: $ENVIRONMENT" >&2; exit 2 ;;
esac

cd "$ROOT"
COMPOSE=(docker compose -p "$PROJECT" --env-file ./env/stack.env -f docker-compose.prod.yml)
SERVICES=(backend admin consumer portfolio)
LAST_GOOD_FILE=./last-good-tag

export IMAGE_PREFIX="ghcr.io/posbuzz/posclient"

echo "$GHCR_TOKEN" | docker login ghcr.io -u posbuzz-deploy --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

wait_healthy() {
  local deadline=$((SECONDS + 240)) svc state
  for svc in postgres "${SERVICES[@]}"; do
    while :; do
      state="$(docker inspect -f '{{.State.Health.Status}}' "$CN-$svc" 2>/dev/null || echo missing)"
      [[ "$state" == healthy ]] && break
      if (( SECONDS > deadline )); then echo "::unhealthy:: $svc is $state" >&2; return 1; fi
      sleep 3
    done
  done
}

PREVIOUS="$(cat "$LAST_GOOD_FILE" 2>/dev/null || true)"
echo "deploying $ENVIRONMENT $TAG (previous good: ${PREVIOUS:-none})"

# Safety net for migrations: images roll back, schema changes do not. Keep a
# fresh dump from just before every deploy (last 5), so a bad migration can be
# undone by restoring it. Skipped quietly if the database is not running yet.
mkdir -p predeploy
if docker exec "$CN-postgres" pg_isready -U postgres -q 2>/dev/null; then
  docker exec "$CN-postgres" pg_dump -U postgres -Fc -d posbuzz > "predeploy/$(date -u +%Y%m%dT%H%M%SZ)-before-${TAG:0:12}.dump" \
    || echo "warning: pre-deploy dump failed" >&2
  ls -1t predeploy | tail -n +6 | while read -r f; do rm -f "predeploy/$f"; done
fi

# backend/portfolio images are shared by both environments (tag = sha); the
# frontends bake in the API URL, so each environment has its own (sha-stg / sha-prod).
export TAG FRONT_TAG="${TAG}-${SUFFIX}"
"${COMPOSE[@]}" pull "${SERVICES[@]}"
"${COMPOSE[@]}" up -d --remove-orphans

if wait_healthy; then
  echo "$TAG" > "$LAST_GOOD_FILE"
  # Keep only this deploy and the previous one (the rollback target) on disk;
  # images still used by the other environment are skipped by docker rmi.
  docker images --format '{{.Repository}}:{{.Tag}}' | grep '^ghcr.io/posbuzz/posclient-' \
    | grep -v -e ":${TAG}\(-stg\|-prod\)\?$" -e ":${PREVIOUS:-none}\(-stg\|-prod\)\?$" \
    | xargs -r docker rmi >/dev/null 2>&1 || true
  docker image prune -f >/dev/null
  "${COMPOSE[@]}" ps
  echo "deploy ok: $ENVIRONMENT $TAG"
  exit 0
fi

echo "deploy FAILED, logs:" >&2
"${COMPOSE[@]}" logs --tail=40 backend >&2 || true
if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$TAG" ]]; then
  echo "rolling back to $PREVIOUS" >&2
  export TAG="$PREVIOUS" FRONT_TAG="${PREVIOUS}-${SUFFIX}"
  # Frontends of tags deployed before staging existed have no suffix.
  docker image inspect "${IMAGE_PREFIX}-admin:${FRONT_TAG}" >/dev/null 2>&1 || export FRONT_TAG="$PREVIOUS"
  "${COMPOSE[@]}" up -d --remove-orphans
  wait_healthy && echo "rolled back to $PREVIOUS" >&2 || echo "ROLLBACK ALSO UNHEALTHY" >&2
fi
exit 1
