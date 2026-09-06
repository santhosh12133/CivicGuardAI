# API Reference

## 1. API contract

Base path:

```text
/api
```

Current route groups:

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/issues
GET    /api/issues/:id
POST   /api/issues
PUT    /api/issues/:id
DELETE /api/issues/:id
```

The issue router currently permits public reads, authenticated issue creation, staff/admin updates, and admin-only deletion. UUID, coordinate, status, and optional URL fields are validated server-side. fileciteturn258file0L2-L6

## 2. Authentication

Protected endpoints use:

```http
Authorization: Bearer <JWT>
```

JWT verification is performed by middleware using `JWT_SECRET`. Invalid or expired credentials produce HTTP 401; valid credentials with insufficient role produce HTTP 403. fileciteturn259file0L2-L5

## 3. Authentication endpoints

### POST `/api/auth/register`

Creates a citizen account.

Request:

```json
{
  "name": "Asha Kumar",
  "email": "asha@example.com",
  "password": "StrongPassword123!"
}
```

Expected success shape:

```json
{
  "user": {
    "id": "<uuid>",
    "name": "Asha Kumar",
    "email": "asha@example.com",
    "role": "citizen"
  },
  "token": "<jwt>"
}
```

Security contract:

- Never accept `staff` or `admin` as a public registration role.
- Passwords must be stored as password hashes, never plaintext.
- Do not return password hashes to clients.
- Duplicate email should be treated as a conflict.

### POST `/api/auth/login`

Request:

```json
{
  "email": "asha@example.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "user": {
    "id": "<uuid>",
    "name": "Asha Kumar",
    "email": "asha@example.com",
    "role": "citizen"
  },
  "token": "<jwt>"
}
```

The deployed session strategy should follow the authentication requirements documented in the security guide; browser localStorage token storage remains a hardening item rather than evidence of a complete secure-session architecture.

## 4. Issue endpoints

### GET `/api/issues`

Returns issue records for list views.

Authentication: currently public.

Security consideration: public read access means the API must be reviewed for privacy exposure, pagination, abuse protection, and whether citizen-created issue data should be globally discoverable.

### GET `/api/issues/:id`

Returns one issue by UUID.

Authentication: currently public.

Path validation:

```text
id must be a UUID
```

### POST `/api/issues`

Authentication: required for citizens/staff/admin as allowed by controller/business rules.

Content type:

```text
multipart/form-data
```

Form fields:

| Field | Type | Requirement | Notes |
|---|---|---|---|
| `title` | string | required | Non-empty after trimming |
| `description` | string | required | Non-empty after trimming |
| `latitude` | decimal | required | -90 to 90 |
| `longitude` | decimal | required | -180 to 180 |
| `status` | enum | optional | `Open`, `In Progress`, `Resolved` |
| `image` | file | optional by route, strongly preferred | Validated by Multer/evidence pipeline |
| `photo_url` | URL | optional | Backward-compatible fallback |

Example cURL:

```bash
curl -X POST "$API_URL/api/issues" \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=Broken street light" \
  -F "description=Street light is not functioning near the bus stop" \
  -F "latitude=12.971599" \
  -F "longitude=77.594566" \
  -F "image=@./street-light.jpg"
```

Processing includes coordinate validation, optional reverse geocoding, EXIF inspection, photo-date checks, GPS consistency checks, pHash computation, and similar-image detection. fileciteturn263file0L2-L2

Success should be a `201 Created` response containing the persisted issue object and any review flags exposed by the current controller contract.

### PUT `/api/issues/:id`

Authentication: required.

Roles:

```text
staff, admin
```

Optional fields include:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "latitude": 12.971599,
  "longitude": 77.594566,
  "status": "In Progress",
  "photo_url": "https://example.com/resolution.jpg"
}
```

An optional multipart image may also be supplied for resolution evidence.

### DELETE `/api/issues/:id`

Authentication: required.

Role:

```text
admin
```

This endpoint must reject authenticated citizens and staff.

## 5. Validation contract

### Geographic coordinates

```text
Latitude:  -90 <= latitude <= 90
Longitude: -180 <= longitude <= 180
```

### Status

```text
Open
In Progress
Resolved
```

### UUID

Issue identifiers are validated as UUIDs before controller execution. fileciteturn258file0L2-L6

### Uploads

The API limits multipart uploads to one file and 10 MB and restricts accepted image MIME types. fileciteturn256file0L2-L4

## 6. Error model

Canonical categories:

| Status | Meaning | Client action |
|---:|---|---|
| 400 | Invalid request/evidence | Correct request or evidence |
| 401 | Missing/invalid/expired JWT | Re-authenticate |
| 403 | Authenticated but not authorized | Do not retry with same role |
| 404 | Issue/resource not found | Refresh or report missing resource |
| 409 | Resource conflict | Resolve duplicate/conflict |
| 429 | Rate limited | Back off and retry later |
| 500 | Unexpected server failure | Show generic error; inspect server logs |
| 503 | Dependency/unavailable service | Retry using backoff after service recovery |

Production responses must not expose internal exception messages. This is an explicit production hardening requirement. fileciteturn256file0L2-L4

## 7. Request limits and CORS

The API configures JSON and URL-encoded body limits at 1 MB and a global process-local rate limiter. CORS is origin allow-listed in production using `CORS_ORIGINS`. fileciteturn257file0L2-L5

The rate limiter is process-local; horizontally scaled deployments require a shared limiter. fileciteturn256file0L2-L4

## 8. Health endpoint

### GET `/health`

Success:

```json
{
  "status": "ok",
  "database": "ok"
}
```

If PostgreSQL cannot be authenticated, the API returns HTTP 503 with a degraded/unavailable database indication. fileciteturn257file0L2-L5

## 9. API compatibility rules

When changing an endpoint:

1. Update validation and controller behavior together.
2. Update this API reference and frontend/mobile call sites in the same change.
3. Preserve backward compatibility unless the change is explicitly versioned or intentionally breaking.
4. Add or update integration tests.
5. Document error semantics, authorization, and request limits.
6. Never rely on frontend validation as the security control.
