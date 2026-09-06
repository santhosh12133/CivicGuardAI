# Security Architecture

## Security posture

CivicGuardAI uses layered controls rather than treating a single mechanism as sufficient: JWT authentication, role-based authorization, input validation, upload restrictions, security headers, request limits, rate limiting, and production configuration checks.

The API disables the Express `x-powered-by` header, applies security headers, requires a strong JWT secret, requires production CORS configuration, and avoids exposing internal 5xx exception details. fileciteturn257file0L2-L5

## Password security

Passwords are verified against bcrypt hashes. Plaintext passwords must never be stored, logged, returned, or included in telemetry.

## JWT security

The API expects:

```http
Authorization: Bearer <JWT>
```

The token is verified with the server-side `JWT_SECRET`. Authentication middleware does not trust client-submitted role fields. fileciteturn259file0L2-L5

Production controls:

- Use a long random signing secret.
- Keep secrets outside Git.
- Rotate secrets using controlled deployment procedures.
- Avoid long-lived browser sessions where a shorter-lived access token plus secure refresh mechanism is practical.

## Role-based access control

| Operation | Citizen | Staff | Admin |
|---|---:|---:|---:|
| Register | Yes | No via public registration | No via public registration |
| Login | Yes | Yes | Yes |
| Create issue | Yes | Policy-dependent | Policy-dependent |
| Read issue list | Current API allows public access | Yes | Yes |
| Update issue | No | Yes | Yes |
| Delete issue | No | No | Yes |

Route-level authorization currently enforces staff/admin for issue updates and admin for deletion. fileciteturn258file0L2-L6

## Input validation

The API validates UUIDs, geographic coordinates, enum status values, and selected URLs before business logic. File uploads are separately controlled by the multipart middleware. fileciteturn258file0L2-L6

## Web security headers

The current API sends:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- HSTS in production

These controls are documented as current implementation facts; browser-level security still requires correct deployment and HTTPS termination. fileciteturn257file0L2-L5

## CORS

Production uses an explicit comma-separated `CORS_ORIGINS` allow-list. Requests with unapproved browser origins are rejected by the configured CORS middleware. fileciteturn257file0L2-L5

## Rate limiting

A global process-local rate limiter is enabled. It protects a single process, not a multi-replica fleet. Multi-instance deployment requires a shared limiter. fileciteturn257file0L2-L5

## File security

Uploads are limited in size and count, restricted to approved image MIME types, and assigned server-generated filenames. The security design treats image metadata and image bytes as untrusted input. fileciteturn256file0L2-L4

## Privacy

Civic issue reports can contain precise geolocation and personally associated content. Public read access should therefore be treated as a product/privacy decision, not simply an implementation convenience.

## Security release gate

A release is not security-approved until:

- all protected endpoints are authorization-tested;
- invalid credentials fail safely;
- upload limits are verified;
- rate limiting returns expected behavior;
- CORS is tested with trusted and untrusted origins;
- no credentials appear in logs/artifacts;
- backup/restore and secret rotation procedures are known;
- public data exposure has been reviewed.
