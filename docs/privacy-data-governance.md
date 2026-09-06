# Privacy and Data Governance

## 1. Scope

This document describes engineering controls for handling civic report data. It is not a legal compliance certification and does not replace organization-specific privacy counsel, retention schedules, consent language, or regulatory assessments.

## 2. Data classification

| Data | Classification | Examples | Handling principle |
|---|---|---|---|
| Authentication secrets | Restricted | password hashes, JWT secrets | Never expose or log |
| Identity data | Confidential | name, email, user ID | Minimum necessary access |
| Location data | Sensitive | latitude, longitude, reverse-geocoded address | Treat as potentially identifying |
| Evidence images | Sensitive | issue photo, resolution photo | Access-controlled storage |
| Operational metadata | Internal | status, review flags, timestamps | Limit to product need |
| Public product metadata | Potentially public | issue title/status depending on policy | Explicitly define public surface |

## 3. Data minimization

Only collect fields required to support the report workflow. Avoid collecting unrestricted profile data or metadata that does not have a product purpose.

## 4. Location privacy

Coordinates can be more identifying than a textual address. Product owners should decide whether public issue responses expose exact coordinates, rounded coordinates, or only an approximate area.

The current API allows public issue reads, so public data exposure must be explicitly reviewed before broad public launch. fileciteturn258file0L2-L6

## 5. Image privacy

Original and resolution images may contain:

- faces;
- vehicle identifiers;
- private property details;
- EXIF metadata;
- precise location/time information.

Recommended production controls:

- private object storage;
- controlled delivery or signed URLs;
- optional EXIF stripping on derived/public images;
- malware scanning;
- retention/lifecycle rules;
- access logging for privileged retrieval.

The current deployment uses local filesystem uploads and documents object storage as a production improvement. fileciteturn255file0L2-L2

## 6. Retention

Retention periods must be configured by the deploying organization. The application should distinguish at least:

```text
active issue data
resolution evidence
moderation/audit history
backup copies
application logs
```

Deleting an issue from the application database does not necessarily remove copies already captured by backups, caches, CDN layers, or external storage.

## 7. Deletion

A future deletion policy should answer:

1. Who can request deletion?
2. Which records are removed immediately?
3. Which audit records must remain?
4. When are image objects deleted?
5. How are backup copies handled?
6. How is completion evidenced?

## 8. Logging and telemetry

Do not log:

- passwords;
- JWTs;
- Authorization headers;
- complete EXIF documents;
- raw image contents;
- database credentials.

Telemetry should use opaque IDs and aggregated measurements wherever possible.

## 9. Third-party data sharing

Reverse geocoding sends coordinates to an external provider. The deployment must review provider terms, data handling, logging, rate limits, and geographic coverage before production use.

## 10. Privacy engineering checklist

- [ ] Public issue fields are explicitly defined.
- [ ] Exact location exposure has product approval.
- [ ] Image storage is access-controlled.
- [ ] Retention periods are documented.
- [ ] Deletion semantics are defined for DB and object storage.
- [ ] Backups have an independent retention policy.
- [ ] Logs are redacted.
- [ ] External-provider data handling is reviewed.
