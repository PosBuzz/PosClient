#!/usr/bin/env bash
# Runs on the VPS as the deploy user: pull the images for one commit, restart
# the stack, wait for health, and roll back to the last good tag on failure.
set -euo pipefail

TAG="${1:?usage: deploy.sh <tag>}"
cd /opt/posbuzz
COMPOSE=(docker compose --env-file ./env/stack.env -f docker-compose.prod.yml)
SERVICES=(backend admin consumer portfolio)
LAST_GOOD_FILE=./last-good-tag

export IMAGE_PREFIX="ghcr.io/posbuzz/posclient"

echo "$GHCR_TOKEN" | docker login ghcr.io -u posbuzz-deploy --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

wait_healthy() {
  local deadline=$((SECONDS + 240)) svc state
  for svc in postgres "${SERVICES[@]}"; do
    while :; do
      state="$(docker inspect -f '{{.State.Health.Status}}' "posbuzz-$svc" 2>/dev/null || echo missing)"
      [[ "$state" == healthy ]] && break
      if (( SECONDS > deadline )); then echo "::unhealthy:: $svc is $state" >&2; return 1; fi
      sleep 3
    done
  done
}

PREVIOUS="$(cat "$LAST_GOOD_FILE" 2>/dev/null || true)"
echo "deploying $TAG (previous good: ${PREVIOUS:-none})"

export TAG
"${COMPOSE[@]}" pull "${SERVICES[@]}"
"${COMPOSE[@]}" up -d --remove-orphans

if wait_healthy; then
  echo "$TAG" > "$LAST_GOOD_FILE"
  docker image prune -f --filter "until=168h" >/dev/null
  "${COMPOSE[@]}" ps
  echo "deploy ok: $TAG"
  exit 0
fi

echo "deploy FAILED, logs:" >&2
"${COMPOSE[@]}" logs --tail=40 backend >&2 || true
if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$TAG" ]]; then
  echo "rolling back to $PREVIOUS" >&2
  export TAG="$PREVIOUS"
  "${COMPOSE[@]}" up -d --remove-orphans
  wait_healthy && echo "rolled back to $PREVIOUS" >&2 || echo "ROLLBACK ALSO UNHEALTHY" >&2
fi
exit 1
