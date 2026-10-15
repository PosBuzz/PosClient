#!/usr/bin/env bash
# Forced command for the deploy user's SSH key (see authorized_keys). The only
# thing that key can do is: "deploy <git sha>" with, on stdin, a GHCR token on
# the first line followed by a tar of the repo's deploy/ directory.
set -euo pipefail
umask 077

[[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]] || { echo "refused" >&2; exit 1; }
TAG="${BASH_REMATCH[1]}"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
IFS= read -r GHCR_TOKEN
tar -x -C "$STAGE" --no-same-owner --no-same-permissions

# Install the new scripts and compose file, then hand over to them. This script
# stays as-is (it is the trust anchor); deploy.sh is updated from the repo.
install -m 0644 "$STAGE/docker-compose.prod.yml" /opt/posbuzz/docker-compose.prod.yml
install -m 0755 "$STAGE/deploy.sh" /opt/posbuzz/deploy.sh

GHCR_TOKEN="$GHCR_TOKEN" exec /opt/posbuzz/deploy.sh "$TAG"
