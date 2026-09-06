# Observability

## 1. Objectives

Observability should answer four questions quickly:

1. Is the API healthy?
2. Which dependency is failing?
3. Which user-facing flow is affected?
4. Can an operator reconstruct the failure without exposing sensitive data?

## 2. Signals

| Signal | Purpose | Examples |
|---|---|---|
| Logs | Event-level diagnostics | request failure, upload rejection, DB error |
| Metrics | Trends and thresholds | request count, latency, 4xx/5xx, 429, upload failures |
| Traces | Cross-component timing | API -> DB -> geocoder -> evidence processing |
| Audit records | Business accountability | status change, moderation action, deletion |
| Health checks | Service availability | API and database health |

## 3. Current health endpoint

`GET /health` checks PostgreSQL connectivity and returns a success payload when the database is reachable. On database failure it returns HTTP 503. fileciteturn257file0L2-L5

## 4. Recommended API metrics

- request count by route/method/status;
- p50/p95/p99 latency;
- 4xx rate;
- 5xx rate;
- 429 rate;
- authentication failures;
- authorization failures;
- issue creation success/failure;
- upload rejection count;
- EXIF validation rejection count;
- GPS mismatch count;
- duplicate-review count;
- geocoder latency/error rate;
- database query latency/error rate.

## 5. Worker/evidence metrics

Track separately:

```text
uploads_received
uploads_rejected
exif_processed
exif_failures
gps_checks
gps_mismatches
phash_computations
phash_failures
duplicate_flags
geocoding_success
geocoding_failure
```

These metrics must be aggregate counters, not raw content logs.

## 6. Structured logging

Each request should eventually have a correlation identifier, for example:

```json
{
  "timestamp": "2026-09-07T10:00:00Z",
  "level": "info",
  "request_id": "req_01H...",
  "method": "POST",
  "route": "/api/issues",
  "status": 201,
  "latency_ms": 412
}
```

Do not log JWTs, authorization headers, passwords, complete EXIF payloads, database connection strings, or raw image content.

## 7. Alerts

### P0 / critical

- API unavailable.
- Database unavailable.
- Authentication outage affecting most users.
- Data-integrity issue or unauthorized access suspected.

### P1 / high

- Sustained 5xx rate above agreed threshold.
- Upload processing failures spike.
- Geocoding dependency degradation materially affects issue creation.
- Storage capacity approaches exhaustion.

### P2 / medium

- Latency degradation.
- Increased 429 rate.
- Duplicate/review rate changes unexpectedly.

Thresholds must be selected from measured baselines rather than copied generic values.

## 8. Dashboards

### API dashboard

Requests, latency, 4xx/5xx, 429, authentication failures, database health.

### Evidence dashboard

Upload success, metadata failures, GPS mismatch, duplicate review, processing latency.

### Operations dashboard

CPU, memory, disk/storage, database connections, backups, deployment status.

## 9. Observability maturity path

Current repository controls are mainly logs, health checks, and deployment checklists. The deployment guide still recommends centralized logs, error tracking, uptime monitoring, and database monitoring before high-confidence production operation. fileciteturn255file0L2-L2

Recommended sequence:

```text
structured logs
    -> metrics
    -> dashboards
    -> alerting
    -> distributed tracing
    -> SLO/error-budget practice
```
