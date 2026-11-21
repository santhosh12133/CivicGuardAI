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

### GET `/api/auth/me`

Signed in. Returns `{ "user": { id, name, email, role } }` with the role as currently stored (roles can change after a token was issued; every authenticated request re-checks the account, so a removed account gets `401` and a changed role applies immediately).

### POST `/api/auth/change-password`

Signed in. Body `{ "currentPassword": "...", "newPassword": "..." }` (new: 8+ characters, different from the current one). `400` if the current password is wrong.

### Account management (admin only)

| Method and path | Body | Result |
|---|---|---|
| `GET /api/auth/users?role=staff,admin` | | `{ users, count }`; `role` filter optional |
| `POST /api/auth/staff` | `{ name, email, role: "staff" \| "admin" }` | `201 { user, temporaryPassword }`; `409` if the email exists |
| `PATCH /api/auth/users/:id` | `{ role: "citizen" \| "staff" \| "admin" }` | `{ user }`; `400` for your own account |
| `POST /api/auth/users/:id/reset-password` | | `{ user, temporaryPassword }` |

Temporary passwords are shown once; the person should change them after signing in.

## 4. Issue endpoints

### Who sees what

Issue reads are public, but responses depend on who is asking (send the bearer token when signed in):

| Field | Anonymous / other citizens | The reporting citizen | Staff / admin |
|---|---|---|---|
| Issue, photos, category, status, timeline | ✓ | ✓ | ✓ |
| `is_mine` | `false` | `true` | `true` only for their own |
| `reporter` (`{ id, name, email }`) and `user_id` | — | — | ✓ |
| Timeline author name of a citizen | hidden (`null`) | ✓ (their own) | ✓ |
| Timeline author name of staff/admin | ✓ | ✓ | ✓ |

An invalid or expired token on these public endpoints is treated as anonymous.

### GET `/api/issues`

Returns an array of issues, newest first.

Query parameters (all optional):

| Parameter | Values | Effect |
|---|---|---|
| `status` | `Open`, `In Progress`, `Resolved` | Only that status |
| `category` | a category id | Only that category |
| `mine` | `true` | Only the signed-in user's reports (`401` when not signed in) |
| `needs_review` | `true` | Only issues flagged for manual review |

Unknown values return `400`.

### GET `/api/issues/categories`

Public. Returns `[{ "id": "pothole", "label": "Pothole" }, ...]`. Current ids: `pothole`, `road_damage`, `streetlight`, `garbage`, `water_supply`, `drainage`, `traffic_signal`, `fallen_tree`, `other`.

### GET `/api/issues/stats`

Staff and admin only (`401` without a token, `403` for citizens).

```json
{
  "total": 42,
  "byStatus": { "Open": 20, "In Progress": 12, "Resolved": 10 },
  "byCategory": { "pothole": 15, "streetlight": 9, "garbage": 8, "...": 0 },
  "needsReview": 4,
  "overdue": 6,
  "last7Days": { "reported": 11, "resolved": 5 },
  "avgResolutionHours": 51.3
}
```

`needsReview` counts unresolved flagged issues; `overdue` counts unresolved issues older than 7 days; `avgResolutionHours` is the mean time from report to first "Resolved" for issues resolved now (`null` if none).

### GET `/api/issues/:id`

Returns one issue by UUID, including its timeline:

```json
{
  "id": "…",
  "title": "Streetlight out near bus stop",
  "category": "streetlight",
  "status": "In Progress",
  "is_mine": true,
  "updates": [
    { "id": "…", "from_status": null, "to_status": "Open", "note": null, "photo_url": null,
      "created_at": "…", "author": { "role": "citizen", "name": "Asha", "is_me": true } },
    { "id": "…", "from_status": "Open", "to_status": "In Progress", "note": "Crew scheduled for Monday",
      "photo_url": null, "created_at": "…", "author": { "role": "staff", "name": "Ravi K", "is_me": false } }
  ]
}
```

`400` for a malformed id, `404` if it does not exist.

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
| `status` | enum | optional | Only `Open` is accepted; any other value returns `400`. New issues always start `Open`, and only staff/admin can change status (via `PUT`) |
| `category` | string | optional | A category id; defaults to `other` |
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

Returns `201` with the issue (as in `GET /api/issues/:id`). The report is linked to the signed-in user and its timeline starts with a "reported" entry.

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
  "category": "drainage",
  "note": "Crew scheduled for Monday",
  "photo_url": "https://example.com/resolution.jpg"
}
```

`note` (up to 1000 characters) is shown to citizens in the timeline; a note on its own is a valid update. A status change, note or uploaded photo each add a timeline entry. An optional multipart `image` is stored as the resolution photo when the issue is (or becomes) `Resolved`, otherwise as the issue photo; earlier photos stay in the timeline.

Returns the updated issue with its timeline.

### DELETE `/api/issues/:id`

Authentication: required.

Role:

```text
admin
```

This endpoint must reject authenticated citizens and staff. It also deletes the issue's timeline and photos.

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

- A file larger than 10 MB returns `413` with `Image must be 10 MB or smaller`.
- A file that is not JPEG, PNG, GIF, or WebP returns `400`.
- Other multipart mistakes (more than one file, unexpected field name) return `400`.

## 6. Error model

Canonical categories:

| Status | Meaning | Client action |
|---:|---|---|
| 400 | Invalid request/evidence | Correct request or evidence |
| 401 | Missing/invalid/expired JWT | Re-authenticate |
| 403 | Authenticated but not authorized | Do not retry with same role |
| 404 | Issue/resource not found | Refresh or report missing resource |
| 409 | Resource conflict | Resolve duplicate/conflict |
| 413 | Upload or request body too large | Send a smaller image (10 MB max) or body (1 MB max) |
| 429 | Rate limited | Back off and retry later |
| 500 | Unexpected server failure | Show generic error; inspect server logs |
| 503 | Dependency/unavailable service | Retry using backoff after service recovery |

Production responses must not expose internal exception messages. This is an explicit production hardening requirement. fileciteturn256file0L2-L4

## 7. Request limits and CORS

The API configures JSON and URL-encoded body limits at 1 MB and a global process-local rate limiter. CORS is origin allow-listed in production using `CORS_ORIGINS`. fileciteturn257file0L2-L5

A browser request from an origin that is not on the allow-list receives `403` (`Origin not allowed by CORS`). Requests without an `Origin` header, such as those from the mobile app or `curl`, are not affected.

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
