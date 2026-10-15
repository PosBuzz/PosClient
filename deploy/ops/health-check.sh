#!/usr/bin/env bash
# Every 5 minutes (health-check.timer). Pings Healthchecks.io ONLY when everything is
# fine, so a failing check, or a dead/overloaded server that stops pinging, raises an
# alert (email/Telegram). Config: /opt/posbuzz/env/health.env (HEALTH_URL).
set -uo pipefail
source /opt/posbuzz/env/health.env
problems=()

use=$(df --output=pcent / | tail -1 | tr -dc 0-9)
[ "${use:-100}" -lt 80 ] || problems+=("disk ${use}% full")

mem=$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "%d", (1-a/t)*100}' /proc/meminfo)
[ "${mem:-100}" -lt 85 ] || problems+=("memory ${mem}% used")

for c in posbuzz-postgres posbuzz-backend posbuzz-admin posbuzz-consumer posbuzz-portfolio \
         posbuzz-stg-postgres posbuzz-stg-backend posbuzz-stg-admin posbuzz-stg-consumer posbuzz-stg-portfolio; do
  s=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo missing)
  [ "$s" = healthy ] || problems+=("$c is $s")
done

for svc in docker nginx fail2ban; do
  systemctl is-active --quiet "$svc" || problems+=("$svc is not running")
done

for cert in posbuzz.cloud posbuzz.xyz; do
  end=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$cert/fullchain.pem" 2>/dev/null | cut -d= -f2)
  days=$(( ( $(date -d "${end:-1970-01-01}" +%s) - $(date +%s) ) / 86400 ))
  [ "$days" -gt 14 ] || problems+=("certificate $cert expires in ${days}d")
done

if [ ${#problems[@]} -eq 0 ]; then
  curl -fsS -m 10 --retry 3 "$HEALTH_URL" >/dev/null
else
  printf '%s\n' "${problems[@]}" | curl -fsS -m 10 --retry 3 --data-binary @- "$HEALTH_URL/fail" >/dev/null
  printf '%s\n' "${problems[@]}" >&2
  exit 1
fi
