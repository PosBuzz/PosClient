# Logs in Grafana Cloud (Alloy -> Loki)

Free Grafana Cloud stack `bravereef185` (region prod-ap-south-1, about 50 GB of logs a month, 14-day retention).
One Alloy container per host reads every container's logs through the Docker socket (read-only) and pushes them to Loki.

Credentials: `alloy.env` in the stack's `env/` folder on the server (root only, `chmod 600`, never in git):

```
LOKI_URL=https://logs-prod-028.grafana.net/loki/api/v1/push
LOKI_USER=<Loki user id from Connections > Hosted logs (Loki)>
LOKI_TOKEN=<access policy token with only logs:write>
```

Start or update (on the VPS, as root; staging first):

```
mkdir -p /opt/posbuzz-staging/observability && cd /opt/posbuzz-staging/observability
# copy docker-compose.alloy.yml and config.alloy from deploy/observability here
ALLOY_ENV=/opt/posbuzz-staging/env/alloy.env docker compose -p posbuzz-obs -f docker-compose.alloy.yml up -d
docker logs --tail 50 posbuzz-alloy
```

Use it: Grafana > Explore > Loki, for example `{stack="posclient-stg", service="backend"} |= "error"`. Labels: `container`, `service`, `stack`
(`posclient` = production, `posclient-stg` = staging). The `logs:write` token cannot read, so look at logs in the Grafana web UI.

Rollback: `docker compose -p posbuzz-obs down` removes it; nothing else depends on it. Alloy is not in the container list that
`posbuzz-health-check` watches, and the app deploy workflow does not touch it. Rotate the token: edit `alloy.env`, then `docker compose -p posbuzz-obs up -d --force-recreate`.
