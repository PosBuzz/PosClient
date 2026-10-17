# Grafana dashboard and alerts for the PosBuzz logs

Applied on 2026-10-17 to the Grafana Cloud stack `bravereef185` (folder "PosBuzz", dashboard uid `posbuzz-logs`, rule group `logs`,
contact point `posbuzz-email`, notification route `source=loki`). Nothing re-applies them automatically (the Alloy token only has
`logs:write`); to change them, edit in the Grafana UI or re-import the JSON and update the rules by hand.

## Dashboard
Dashboards > New > Import > upload `dashboard-posbuzz-logs.json`. Pick the `grafanacloud-bravereef185-logs` (Loki) data source
and leave the `stack` variable on `posclient-stg` (add `posclient` for production).

## Alerts
The backend uses Nest's default logger, which writes `ERROR` lines for unhandled exceptions but does not log HTTP status codes,
so a 5xx rate cannot be measured from these logs; alert on error lines instead. The `Errors in range` panel uses the same match.

Alerting > Alert rules > New alert rule, data source `grafanacloud-bravereef185-logs`:

| Alert | Query (instant, last 5m) | Condition | For |
| --- | --- | --- | --- |
| Backend errors, production | `sum(count_over_time({stack="posclient", service="backend"} \|~ `\bERROR\b` [5m]))` | is above 5 | 5m |
| Backend errors, staging | same with `stack="posclient-stg"` | is above 20 | 10m |
| Postgres errors, production | `sum(count_over_time({stack="posclient", service="postgres"} \|~ `\bERROR\b` [5m]))` | is above 5 | 5m |
| Logs stopped arriving (whole host) | `sum(count_over_time({stack=~"posclient.*"}[30m]))` | is below 1 | 30m |

Set "No data" to Alerting for the last rule only. It watches every container, not one service: production's backend is silent when idle (it logged nothing for 2 hours on 2026-10-17 and a per-service rule fired falsely). Contact point: Alerting > Contact points (email, or Telegram like the Healthchecks.io
checks). Tune the thresholds after a week of normal traffic.
