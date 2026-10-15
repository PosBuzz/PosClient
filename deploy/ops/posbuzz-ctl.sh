#!/usr/bin/env bash
# Everyday operations helper. Run on the VPS:  sudo posbuzz-ctl <command> [prod|stg] [args]
# Safe by default: it only reads, restarts one container, or runs the scripts that already exist.
set -euo pipefail

usage() { cat <<'U'
posbuzz-ctl: everyday operations
  status                         containers, timers, disk, memory, last deployed commits
  logs    <prod|stg> <service> [lines]   service: backend admin consumer portfolio postgres (default 100 lines)
  restart <prod|stg> <service>   restart ONE container (does not redeploy or change images)
  psql    <prod|stg>             interactive SQL shell (be careful on prod)
  shell   <prod|stg> <service>   sh inside a container
  health                         run the 5-minute health check now (prints problems, pings Healthchecks)
  backup                         run the nightly R2 backup now
  drill                          restore the newest R2 backup into a scratch database and compare with live
  snapshot <prod|stg>            dump that database to /root/manual-dumps/ (for before risky manual work)
  last-deploys                   commit currently deployed to each environment, and the rollback target
Deploys and rollbacks go through GitHub (merge to staging / main, or Actions -> Deploy -> Run workflow).
U
}

env_cn() { case "${1:-}" in prod|production) echo posbuzz;; stg|staging) echo posbuzz-stg;; *) echo "pick prod or stg" >&2; exit 2;; esac; }
need_svc() { case "${1:-}" in backend|admin|consumer|portfolio|postgres) ;; *) echo "service must be one of: backend admin consumer portfolio postgres" >&2; exit 2;; esac; }

cmd="${1:-help}"; shift || true
case "$cmd" in
  status)
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | sed -E 's#ghcr.io/posbuzz/posclient-##; s#:([0-9a-f]{7})[0-9a-f]{33}#:\1#'
    echo; systemctl list-timers --no-pager 2>/dev/null | grep -E "NEXT|backup-db|health-check|restore-drill" | awk '{print $1,$2,$3,$NF}'
    echo; df -h / | tail -1 | awk '{print "disk: "$3" used of "$2" ("$5")"}'
    free -m | awk '/Mem:/{printf "memory: %d MB used of %d MB\n",$3,$2}'
    echo; "$0" last-deploys ;;
  logs)    cn=$(env_cn "${1:-}"); need_svc "${2:-}"; docker logs --tail "${3:-100}" -f "$cn-$2" ;;
  restart) cn=$(env_cn "${1:-}"); need_svc "${2:-}"; docker restart "$cn-$2"; sleep 5; docker ps --filter "name=$cn-$2" --format '{{.Names}} {{.Status}}' ;;
  psql)    cn=$(env_cn "${1:-}"); exec docker exec -it "$cn-postgres" psql -U postgres -d posbuzz ;;
  shell)   cn=$(env_cn "${1:-}"); need_svc "${2:-}"; exec docker exec -it "$cn-$2" sh ;;
  health)  exec /usr/local/sbin/posbuzz-health-check ;;
  backup)  exec /usr/local/sbin/posbuzz-backup-db ;;
  drill)   exec /usr/local/sbin/posbuzz-restore-drill ;;
  snapshot)
    cn=$(env_cn "${1:-}"); mkdir -p /root/manual-dumps; f="/root/manual-dumps/${cn}-$(date -u +%Y%m%dT%H%M%SZ).dump"
    docker exec "$cn-postgres" pg_dump -U postgres -Fc -d posbuzz > "$f" && echo "saved $f ($(du -h "$f" | cut -f1)); restore with: docker exec -i $cn-postgres pg_restore -U postgres -d posbuzz --clean --if-exists --no-owner < $f" ;;
  last-deploys)
    echo "deployed commits (last-good-tag):"
    echo "  production: $(cut -c1-7 /opt/posbuzz/last-good-tag 2>/dev/null || echo unknown)   staging: $(cut -c1-7 /opt/posbuzz-staging/last-good-tag 2>/dev/null || echo unknown)"
    echo "pre-deploy dumps:   $(ls /opt/posbuzz/predeploy 2>/dev/null | wc -l) production, $(ls /opt/posbuzz-staging/predeploy 2>/dev/null | wc -l) staging;  staging snapshots: $(ls /opt/posbuzz-staging/snapshots 2>/dev/null | wc -l)" ;;
  help|-h|--help|*) usage ;;
esac
