# Security Threat Model

## 1. Security objectives

CivicGuardAI must protect:

- user credentials and session tokens;
- citizen identity and report data;
- uploaded images and resolution evidence;
- precise geolocation data;
- administrative capabilities;
- database integrity;
- API availability.

## 2. Trust boundaries

```text
Untrusted mobile/browser
        |
        | HTTPS
        v
API boundary
  - auth
  - validation
  - rate limiting
        |
        +---- PostgreSQL
        |
        +---- Files / object storage
        |
        +---- Geocoding provider
```

Client code, uploaded files, EXIF metadata, arbitrary URLs, and external provider responses must be treated as untrusted input.

## 3. Threat register

| Threat | Impact | Current mitigation | Residual risk |
|---|---|---|---|
| Credential theft | High | bcrypt password hashing, JWT verification | Client-side token storage still needs hardening |
| Privilege escalation | Critical | JWT role checks | Requires complete authorization test coverage |
| IDOR / unauthorized issue access | High | Protected mutation routes; review public reads | Public reads need explicit privacy policy |
| Malicious file upload | High | MIME/size checks, server-generated names, ExifTool timeout | Malware scanning/object storage hardening not complete |
| EXIF spoofing | Medium | Cross-checking GPS/time | Metadata can be manipulated |
| Duplicate-report abuse | Medium | pHash similarity + review flag | pHash is a heuristic |
| API abuse / DoS | High | Global rate limiter and body limits | Limiter is process-local |
| Secret leakage | Critical | Environment-based secrets | Operational secret scanning still required |
| DB compromise | Critical | Managed DB recommended | Encryption, IAM, backup policy depend on deployment |
| External geocoder outage | Medium | Enrichment is non-authoritative | Need explicit timeout/retry metrics |
| Sensitive logs | High | Production checklist prohibits secrets/EXIF | Existing verbose controller logging should be reduced |

The current API disables Express fingerprinting, adds security headers, limits request bodies, limits uploads, uses a global rate limiter, requires a strong JWT secret, and avoids production stack details in errors. fileciteturn256file0L2-L4

## 4. Authentication threats

The authentication middleware verifies `Authorization: Bearer <token>` using `JWT_SECRET`. Missing/invalid/expired credentials produce 401; role failures produce 403. fileciteturn259file0L2-L5

Hardening requirements:

- rotate signing secrets through controlled deployment procedures;
- use short-lived browser access tokens with secure refresh handling where feasible;
- revoke compromised sessions through a server-side/session strategy if the threat model requires it;
- test all protected endpoints for every role.

## 5. Authorization threats

Never derive authorization from user-supplied fields such as a posted `role`, query parameter, or issue owner value. The server must use the authenticated identity and explicit route authorization.

Current router-level controls require staff/admin for updates and admin for deletion. fileciteturn258file0L2-L6

## 6. Upload threats

Potential attacks include:

- executable/polyglot content;
- decompression bombs;
- malformed images that exploit parsers;
- oversized uploads;
- path traversal through filenames;
- denial of service through metadata parsing.

Current mitigations include server-generated filenames, one-file/10 MB limits, MIME filtering, and an ExifTool task timeout. fileciteturn256file0L2-L4 fileciteturn263file0L2-L2

Recommended additional controls:

- malware scanning;
- content-type sniffing from magic bytes;
- image re-encoding;
- private object storage;
- signed download URLs;
- storage lifecycle policies.

## 7. Location privacy

Latitude/longitude can identify a citizen's exact location. Public issue-read endpoints therefore require explicit privacy review before large-scale public deployment.

Do not expose:

- authentication credentials;
- complete EXIF metadata;
- internal file paths;
- unnecessary personal profile fields;
- precise private addresses unless product policy explicitly permits it.

## 8. Logging threats

Never log:

```text
passwords
JWTs
Authorization headers
full EXIF blobs
raw uploaded file contents
connection strings
```

Logs should carry a request/correlation identifier and safe contextual metadata such as endpoint, status code, latency, issue identifier, and error category.

## 9. Availability threats

The process-local limiter is appropriate for a single API instance but does not provide shared enforcement across replicas. The deployment documentation therefore requires a Redis-backed or equivalent distributed limiter for multi-instance deployments. fileciteturn255file0L2-L2

## 10. Security test plan

Minimum release tests:

1. missing JWT -> 401;
2. malformed JWT -> 401;
3. expired JWT -> 401;
4. citizen -> staff-only update rejected;
5. staff -> admin-only deletion rejected;
6. invalid UUID -> 400;
7. invalid coordinates -> 400;
8. oversized upload -> rejected;
9. disallowed MIME type -> rejected;
10. malformed EXIF -> safe failure;
11. duplicate image -> appropriate review signal;
12. rate-limit threshold -> 429;
13. CORS untrusted origin -> rejected in production;
14. error responses do not leak stack traces/internal messages.

## 11. Residual production risks

The repository documentation already identifies the following items as requiring further production hardening: durable object storage, distributed rate limiting, formal migrations, centralized observability, secure browser session storage, and full integration testing. fileciteturn255file0L2-L2

These are tracked as engineering risks rather than hidden assumptions of production readiness.
