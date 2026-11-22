# Monitoring

What signals CivicFix produces, what "healthy" looks like, and the alarms to set up.

## Signals

| Signal | Source | Notes |
|---|---|---|
| `GET /health` | API | `200 {"status":"ok","database":"ok"}`; `503` when the database is unreachable. Used by the deploy health gate |
| Application logs | stdout → CloudWatch `/civicfix/api` (AWS), Render logs | Plain text. Errors start with `Unhandled error:`; start-up logs `CivicFix API listening on port …` and any schema changes (`Updated database schema: …`) |
| Load balancer and service metrics | CloudWatch → ECS / Application ELB | Request count, 4xx/5xx counts, target response time, healthy task count |
| Container metrics | CloudWatch → ECS | CPU and memory per service |
| Database metrics | CloudWatch → RDS `civicfix-db` | CPU, connections, free storage, read/write latency |
| Business signals | Admin portal → Overview (`GET /api/issues/stats`) | Open / in progress / resolved, needs review, overdue (> 7 days), average time to resolve |

The API does not export custom metrics or traces; requests are not logged individually (the load balancer metrics cover traffic).

## Service objectives

Suggested targets for a municipal deployment; adjust to your commitments.

| Objective | Target | Measured by |
|---|---|---|
| Availability of `/health` | 99.5 % per month (≈ 3.6 h downtime) | Uptime check |
| API latency (non-upload requests) | 95 % under 500 ms | Load balancer target response time |
| Report submission | 95 % under 10 s, including photo upload and checks | Load balancer, end-to-end tests |
| Recovery from data loss | RPO ≤ 5 minutes, RTO ≤ 2 hours | [Backup and recovery](backup-and-recovery.md) |

## Recommended alarms

Create these in CloudWatch → Alarms (send to an SNS topic with your email or phone):

| Alarm | Metric | Condition |
|---|---|---|
| API unhealthy | Route 53 health check or a CloudWatch Synthetics canary on `<API URL>/health` | Failing for 2 consecutive minutes |
| API 5xx | ELB `HTTPCode_Target_5XX_Count` | > 10 in 5 minutes |
| No healthy tasks | ELB `HealthyHostCount` | < 1 for 2 minutes |
| API CPU | ECS `CPUUtilization` | > 80 % for 15 minutes |
| API memory | ECS `MemoryUtilization` | > 85 % for 15 minutes |
| Database CPU | RDS `CPUUtilization` | > 80 % for 15 minutes |
| Database storage | RDS `FreeStorageSpace` | < 2 GB |
| Database connections | RDS `DatabaseConnections` | > 80 (micro instances allow ~ 80–100) |
| SMS spend | SNS `SMSMonthToDateSpentUSD` | > 80 % of your SNS spend limit |
| Budget | AWS Budgets | Forecast above monthly budget |

Simple alternative without AWS setup: a free external uptime monitor (for example UptimeRobot) on `<API URL>/health` and the admin portal URL.

## Logging rules

- Log decisions and errors, not personal data: never passwords, tokens, codes, `Authorization` headers or full request bodies.
- `log` email/SMS providers print codes to the log — they are for development and tests only and are off in production.
- Keep the `Unhandled error:` prefix for errors so the queries in the [runbook](runbook.md#useful-cloudwatch-logs-insights-queries) keep working.
- Evidence processing currently logs coordinates and EXIF summaries; reducing this is on the [threat model](../security/threat-model.md#prioritised-improvements) list.
