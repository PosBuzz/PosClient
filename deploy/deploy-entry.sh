#!/usr/bin/env bash
# Forced command for the deploy user's SSH key (see authorized_keys). The only
# things that key can do are:
#   deploy staging|production <git sha>   (stdin: GHCR token line + tar of deploy/)
#   refresh-staging                        (staging DB <- copy of production)
set -euo pipefail
umask 077

CMD="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$CMD" == "refresh-staging" ]]; then
  exec /opt/posbuzz-staging/refresh-staging.sh
fi
[[ "$CMD" =~ ^deploy\ (staging|production)\ ([0-9a-f]{40})$ ]] || { echo "refused" >&2; exit 1; }
ENVIRONMENT="${BASH_REMATCH[1]}"; TAG="${BASH_REMATCH[2]}"
case "$ENVIRONMENT" in production) ROOT=/opt/posbuzz ;; staging) ROOT=/opt/posbuzz-staging ;; esac

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
IFS= read -r GHCR_TOKEN
tar -x -C "$STAGE" --no-same-owner --no-same-permissions

# Install the new files, then hand over. This script stays as-is (it is the
# trust anchor); the rest is updated from the repo on every deploy.
install -m 0644 "$STAGE/docker-compose.prod.yml" "$ROOT/docker-compose.prod.yml"
install -m 0755 "$STAGE/deploy.sh" /opt/posbuzz/deploy.sh
install -m 0755 "$STAGE/refresh-staging.sh" /opt/posbuzz-staging/refresh-staging.sh

GHCR_TOKEN="$GHCR_TOKEN" exec /opt/posbuzz/deploy.sh "$ENVIRONMENT" "$TAG"
