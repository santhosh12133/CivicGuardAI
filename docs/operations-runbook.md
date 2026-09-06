# Operations Runbook

## 1. Daily operational checks

- API health endpoint returns healthy database status.
- Database has normal connectivity and capacity.
- No sustained 5xx spike.
- No unusual 429 spike.
- Upload storage has sufficient capacity.
- Geocoding failures are within expected baseline.
- Latest deployment matches the intended commit.

## 2. Health check

```bash
curl -i "$API_URL/health"
```

Expected healthy response:

```json
{
  "status": "ok",
  "database": "ok"
}
```

The current implementation performs a Sequelize database authentication check and returns HTTP 503 when that dependency is unavailable. fileciteturn257file0L2-L5

## 3. Authentication troubleshooting

Symptoms:

```text
401 -> missing/invalid/expired JWT
403 -> valid JWT but insufficient role
```

The current authentication middleware verifies bearer tokens with `JWT_SECRET`, and role authorization checks the decoded token role. fileciteturn259file0L2-L5

Investigate:

1. client API URL;
2. token expiry;
3. clock/time drift;
4. JWT secret consistency across instances;
5. role assignment;
6. browser/mobile session state.

## 4. Issue creation troubleshooting

Check in order:

1. JWT valid.
2. Request fields valid.
3. Coordinates valid.
4. Upload is <= 10 MB and accepted image type.
5. EXIF processing succeeds.
6. Photo timestamp satisfies current rule.
7. GPS validation succeeds.
8. Reverse geocoding dependency is available.
9. pHash computation succeeds.
10. PostgreSQL insert succeeds.

The controller performs these evidence and enrichment steps before issue persistence. fileciteturn263file0L2-L2

## 5. Upload storage incident

If uploaded images fail while database writes succeed:

- inspect filesystem/object-storage availability;
- check generated file paths/URLs;
- verify `API_HOST` and `API_PROTOCOL`;
- confirm permissions;
- check disk usage;
- verify reverse-proxy/static-file configuration.

For production, prefer durable object storage over local container filesystems. fileciteturn255file0L2-L2

## 6. Rate limiting

A 429 indicates the process-local limiter has rejected the request. For a multi-instance deployment, confirm the shared limiter strategy is actually enabled; otherwise each replica has an independent counter. fileciteturn256file0L2-L4

## 7. Database incident

Run:

```bash
curl -i "$API_URL/health"
```

Then inspect:

- provider database status;
- connection limits;
- credentials;
- network access;
- migration/schema compatibility;
- recent deployment changes.

Do not perform destructive schema changes as an incident response shortcut.

## 8. Geocoder incident

If address enrichment fails, preserve the submitted coordinates and expose the issue without fabricating an address. Review provider errors, rate limits, and network connectivity.

## 9. Deployment incident

1. Record current commit SHA.
2. Identify first failing request and timestamp.
3. Compare against previous known-good deployment.
4. Roll back if necessary.
5. Run post-rollback smoke tests.
6. Record a follow-up defect.

## 10. Security incident

Use `docs/incident-response.md` and `docs/security-threat-model.md`. Do not paste secrets, raw tokens, or personal data into tickets or chat.

## 11. Escalation evidence

For any incident, collect:

```text
environment
commit SHA
time window
affected endpoint(s)
HTTP status distribution
health status
relevant redacted logs
database status
storage status
external dependency status
mitigation
verification result
```
