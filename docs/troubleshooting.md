# Troubleshooting Guide

## Decision tree

```text
Problem reported
      |
      +--> API unreachable?
      |       -> check deployment / /health / DNS / TLS
      |
      +--> 401?
      |       -> check bearer token / expiry / JWT secret
      |
      +--> 403?
      |       -> check decoded role and endpoint policy
      |
      +--> 400?
      |       -> check request validation / coordinates / image rules
      |
      +--> 429?
      |       -> check rate limiting and client retry behavior
      |
      +--> 5xx?
      |       -> check redacted server logs + DB + external dependencies
      |
      +--> image broken?
              -> check storage + generated URL + API_HOST/API_PROTOCOL
```

## Symptom: health check returns 503

The API's `/health` endpoint checks PostgreSQL connectivity. A 503 means the database dependency could not be authenticated successfully. fileciteturn257file0L2-L5

Check:

- `DATABASE_URL`;
- database availability;
- network/firewall rules;
- credentials;
- connection limits;
- recent schema/deployment changes.

## Symptom: login returns 401

Check:

- email/password correctness;
- account existence;
- JWT secret availability;
- token issuance;
- system clock if tokens appear immediately expired.

## Symptom: issue creation returns 400

Typical causes include:

- missing title/description;
- invalid latitude/longitude;
- invalid image type or oversized upload;
- missing/invalid photo metadata;
- photo older than the current 24-hour rule;
- GPS mismatch greater than 200 m;
- unreadable image metadata.

The current issue route and controller define these validation/evidence behaviors. fileciteturn258file0L2-L6 fileciteturn263file0L2-L2

## Symptom: issue is unexpectedly marked for review

Inspect:

- duplicate-image similarity;
- use of remote `photo_url` without an uploaded local image;
- evidence validation conditions.

A review signal should be investigated as a workflow condition, not interpreted as proof of abuse.

## Symptom: images work locally but not after deployment

Check:

1. application filesystem persistence;
2. upload directory existence/permissions;
3. `API_HOST`;
4. `API_PROTOCOL`;
5. reverse proxy/static asset rules;
6. whether the target environment uses ephemeral storage.

The deployment documentation explicitly identifies local filesystem uploads as a limitation for serious production use. fileciteturn255file0L2-L2

## Symptom: browser receives CORS error

Check:

- exact browser origin;
- `CORS_ORIGINS` value;
- scheme (`http` vs `https`);
- port;
- trailing slash assumptions.

Production requires configured CORS origins. fileciteturn257file0L2-L5

## Symptom: rate limiting behaves differently across replicas

This is expected with the current process-local limiter. Use a shared Redis-backed/equivalent limiter before relying on coordinated limits across multiple instances. fileciteturn256file0L2-L4

## Diagnostic data to collect

```text
environment
commit SHA
timestamp
endpoint
HTTP status
request ID, when available
redacted error category
health result
database status
storage status
external dependency status
```

Never include JWTs, passwords, raw EXIF, connection strings, or raw image content in diagnostic tickets.
