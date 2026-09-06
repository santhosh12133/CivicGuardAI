# CivicGuardAI (CivicFix)

> A full-stack civic issue reporting and resolution platform that connects citizens with authorized civic staff through a React Native mobile application, a React/Vite administrative portal, and a Node.js/Express API backed by PostgreSQL.

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Core Workflow](#2-core-workflow)
- [3. System Architecture](#3-system-architecture)
- [4. Architecture Components](#4-architecture-components)
- [5. End-to-End Request Flow](#5-end-to-end-request-flow)
- [6. Authentication and Authorization](#6-authentication-and-authorization)
- [7. Issue Reporting Flow](#7-issue-reporting-flow)
- [8. Photo Upload and Validation](#8-photo-upload-and-validation)
- [9. GPS and EXIF Validation](#9-gps-and-exif-validation)
- [10. Reverse Geocoding](#10-reverse-geocoding)
- [11. Duplicate Image Detection](#11-duplicate-image-detection)
- [12. Admin Dashboard Flow](#12-admin-dashboard-flow)
- [13. Issue Lifecycle](#13-issue-lifecycle)
- [14. API Reference](#14-api-reference)
- [15. Data Model](#15-data-model)
- [16. Repository Structure](#16-repository-structure)
- [17. Mobile Application](#17-mobile-application)
- [18. Admin Portal](#18-admin-portal)
- [19. Backend Service](#19-backend-service)
- [20. Environment Configuration](#20-environment-configuration)
- [21. Local Development Setup](#21-local-development-setup)
- [22. API Examples](#22-api-examples)
- [23. Validation and Error Handling](#23-validation-and-error-handling)
- [24. Security Architecture](#24-security-architecture)
- [25. Deployment Architecture](#25-deployment-architecture)
- [26. Troubleshooting](#26-troubleshooting)
- [27. Testing and Verification](#27-testing-and-verification)
- [28. Known Limitations and Production Improvements](#28-known-limitations-and-production-improvements)
- [29. Technology Stack](#29-technology-stack)
- [30. Maintainer Notes](#30-maintainer-notes)

---

# 1. Project Overview

CivicGuardAI, also referred to as CivicFix in the user interface and backend responses, is a civic issue management platform.

The system is divided into three applications:

1. **Mobile application** — citizens authenticate, capture or select an issue photo, provide a description, obtain device coordinates, review the location on a map, and submit the report.
2. **Backend API** — authenticates users, enforces roles, validates issue data, receives images, performs EXIF/GPS checks, reverse-geocodes coordinates, calculates image perceptual hashes, and persists issue records.
3. **Admin portal** — authorized staff and administrators sign in, inspect reports, filter issues, review suspicious reports, update statuses, upload resolution images, and delete issues when permitted.

The primary business objective is:

> **Capture a civic problem at its location → validate the evidence → route it to authorized staff → track the status → document the resolution.**

---

# 2. Core Workflow

The main application workflow is:

```text
Citizen / Staff
      |
      v
   Login
      |
      v
   JWT issued
      |
      v
Authenticated client
      |
      v
Report civic issue
      |
      +---- Title
      +---- Description
      +---- GPS coordinates
      +---- Optional image upload
      |
      v
Backend validation
      |
      +---- Request validation
      +---- JWT authentication
      +---- Image type/size validation
      +---- EXIF metadata validation
      +---- Photo date validation
      +---- EXIF GPS vs reported GPS validation
      +---- Reverse geocoding
      +---- pHash duplicate detection
      |
      v
PostgreSQL issue record
      |
      v
Admin / Staff Dashboard
      |
      +---- View issue
      +---- Review evidence
      +---- Update status
      +---- Upload resolution image
      |
      v
   Resolved
      |
      v
Admin can delete the issue
```

The issue status state machine is:

```text
Open
  |
  v
In Progress
  |
  v
Resolved
```

The current API also allows an authorized staff/admin to set the status directly to any valid status (`Open`, `In Progress`, or `Resolved`).

---

# 3. System Architecture

## 3.1 High-level architecture

```text
                           CIVICGUARDAI

 ┌──────────────────────┐             ┌──────────────────────┐
 │  React Native / Expo │             │  React + Vite + MUI   │
 │    Citizen Mobile    │             │    Admin Portal      │
 │                      │             │                      │
 │ • Login/Register     │             │ • Staff/Admin Login   │
 │ • Camera/Gallery     │             │ • Dashboard           │
 │ • Location           │             │ • Issue Details       │
 │ • Map                │             │ • Status Updates      │
 │ • Report Issue       │             │ • Resolution Image    │
 └──────────┬───────────┘             │ • Delete              │
            │                         └──────────┬───────────┘
            │                                    │
            │ HTTPS/HTTP + JSON                  │ HTTPS/HTTP + JSON
            │ Multipart/FormData for images      │ Multipart/FormData
            │                                    │
            └────────────────┬───────────────────┘
                             │
                             v
                  ┌─────────────────────────┐
                  │ Node.js + Express API   │
                  │                         │
                  │ Routes                  │
                  │ Controllers             │
                  │ JWT Middleware          │
                  │ RBAC                    │
                  │ Validation              │
                  │ Multer Upload           │
                  │ EXIF / GPS Validation   │
                  │ Reverse Geocoding       │
                  │ pHash Detection         │
                  └────────────┬────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 v                           v
       ┌───────────────────┐       ┌──────────────────────┐
       │ PostgreSQL        │       │ Local Upload Storage  │
       │                   │       │                      │
       │ users             │       │ backend/uploads/     │
       │ issues            │       │                      │
       └───────────────────┘       └──────────────────────┘
                 │
                 │
                 v
       ┌──────────────────────┐
       │ OpenStreetMap        │
       │ Nominatim            │
       │ Reverse Geocoding    │
       └──────────────────────┘
```

## 3.2 Architectural layers

### Presentation layer

- `mobile/` — citizen-facing mobile UI.
- `admin/` — staff/admin web UI.

### API layer

- `backend/server.js` — Express application bootstrap, middleware, static uploads, routes, database startup, and health endpoint.
- `backend/src/routes/` — URL routing and request validation.
- `backend/src/controllers/` — business logic.

### Security layer

- `backend/src/middleware/authMiddleware.js` — JWT authentication and role authorization.
- `bcryptjs` — password hashing and verification.
- `jsonwebtoken` — JWT creation and verification.

### Data layer

- `backend/src/models/` — Sequelize models.
- PostgreSQL — persistent application data.

### Evidence-processing layer

- `backend/src/middleware/upload.js` — image upload filtering and storage.
- `exiftool-vendored` — EXIF metadata extraction.
- `geolib` — geographic distance calculation.
- `backend/src/utils/phash.js` — perceptual hashing and duplicate similarity.
- `backend/src/utils/geocoding.js` — reverse geocoding and caching.

---

# 4. Architecture Components

## 4.1 Mobile application

Location: `mobile/`

Responsibilities:

- User registration and login.
- JWT session persistence.
- Camera permission handling.
- Gallery permission handling.
- Photo capture/selection.
- Device location retrieval.
- Map display and coordinate adjustment.
- Issue form submission.
- Multipart image upload.
- API error presentation.

Important files:

```text
mobile/src/
├── context/
│   └── AuthContext.js
├── navigation/
├── screens/
│   └── ReportScreen.js
├── components/
└── utils/
    └── api.js
```

## 4.2 Admin portal

Location: `admin/`

Responsibilities:

- Staff/admin authentication.
- Protected routing.
- Issue listing.
- Search and filtering.
- Manual-review identification.
- Issue details.
- Status changes.
- Resolution-image upload.
- Issue deletion for admins.

Important files:

```text
admin/src/
├── api/
│   └── api.js
├── components/
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   └── IssueDetails.jsx
├── App.jsx
└── main.jsx
```

## 4.3 Backend API

Location: `backend/`

Responsibilities:

- Express server.
- Authentication.
- Authorization.
- Request validation.
- Issue CRUD operations.
- Image upload.
- EXIF processing.
- GPS validation.
- Reverse geocoding.
- pHash duplicate detection.
- PostgreSQL persistence.
- Static image serving.
- Centralized error handling.

---

# 5. End-to-End Request Flow

## 5.1 Login flow

```text
Mobile/Admin UI
     |
     | POST /api/auth/login
     | { email, password }
     v
Express auth route
     |
     v
express-validator
     |
     v
authController.login()
     |
     +---- Find user by email
     |
     +---- bcrypt.compare(password, hash)
     |
     +---- jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '12h' })
     |
     v
{ user, token }
     |
     +-------------------------+
     |                         |
     v                         v
Mobile AsyncStorage       Admin localStorage
```

## 5.2 Authenticated request flow

```text
Client
  |
  | Authorization: Bearer <JWT>
  v
authenticateToken
  |
  +---- Header exists?
  |       no -> 401
  |
  +---- JWT signature/expiry valid?
  |       no -> 401
  |
  v
req.user = decoded JWT
  |
  v
authorizeRoles(...)
  |
  +---- role allowed?
  |       no -> 403
  |
  v
Controller
```

## 5.3 Report issue flow

```text
Mobile ReportScreen
      |
      +---- Validate title/description
      |
      +---- Request GPS permission
      |
      +---- Read current location
      |
      +---- Build FormData
      |       ├── title
      |       ├── description
      |       ├── latitude
      |       ├── longitude
      |       └── image
      |
      v
POST /api/issues
      |
      v
JWT authentication
      |
      v
Multer image processing
      |
      v
Express validation
      |
      v
createIssue()
      |
      +---- Coordinate validation
      +---- Upload URL construction
      +---- Reverse geocoding
      +---- EXIF extraction
      +---- Photo-date validation
      +---- GPS validation
      +---- pHash computation
      +---- Similar-image detection
      |
      v
Issue.create()
      |
      v
201 Created + issue JSON
```

---

# 6. Authentication and Authorization

## 6.1 Roles

The database defines three roles:

| Role | Intended responsibility |
|---|---|
| `citizen` | Register, authenticate, and submit civic issues |
| `staff` | Access the admin portal and update issues |
| `admin` | Staff capabilities plus issue deletion and user listing |

## 6.2 Registration

Endpoint:

```http
POST /api/auth/register
```

Required fields:

```json
{
  "name": "Citizen Name",
  "email": "citizen@example.com",
  "password": "strong-password"
}
```

Rules:

- Name is required.
- Email must be valid.
- Password must contain at least 8 characters.
- Public registration is restricted to `citizen`.
- Duplicate email returns `409`.
- Password is hashed with bcrypt before persistence.
- A JWT is returned immediately after successful registration.

## 6.3 Login

Endpoint:

```http
POST /api/auth/login
```

The backend:

1. Validates the email and password fields.
2. Finds the user by email.
3. Compares the supplied password with the bcrypt hash.
4. Generates a JWT.
5. Returns a sanitized user object and token.

JWT payload:

```json
{
  "userId": "<uuid>",
  "role": "citizen"
}
```

Token lifetime:

```text
12 hours
```

The signing secret is read from:

```text
JWT_SECRET
```

## 6.4 Authorization header

Authenticated API calls use:

```http
Authorization: Bearer <JWT_TOKEN>
```

## 6.5 401 vs 403

### HTTP 401 — Unauthorized

Returned when:

- Authorization header is missing.
- Header is not a Bearer token.
- JWT is invalid.
- JWT is expired.

### HTTP 403 — Forbidden

Returned when the JWT is valid but the user's role is not authorized for the endpoint.

## 6.6 Mobile session storage

`mobile/src/context/AuthContext.js` stores:

```text
@civicfix/token
@civicfix/user
```

using AsyncStorage.

At application startup, the context restores the stored session and calls `setAuthToken()` so Axios can send the Bearer token.

Logout removes both values and clears the Axios authorization header.

## 6.7 Admin session storage

The admin portal stores:

```text
admin_token
admin_user
```

in browser localStorage.

The portal accepts only:

```text
staff
admin
```

A `401` response clears the stored session and redirects to `/login`.

---

# 7. Issue Reporting Flow

## 7.1 Citizen input

The mobile report screen supports:

- Title.
- Description.
- Camera capture.
- Gallery selection.
- GPS location.
- Map-based coordinate adjustment.
- Photo preview.

## 7.2 Location acquisition

The mobile app requests foreground location permission and uses Expo Location with high accuracy.

The resulting coordinates are sent as:

```text
latitude
longitude
```

The user can also adjust the map marker before submission.

## 7.3 Request format

Issue creation uses:

```text
multipart/form-data
```

with the image field named:

```text
image
```

The backend also supports a `photo_url` fallback for backward compatibility when no uploaded file is present.

## 7.4 Server-side issue creation

The backend validates coordinates again even though the mobile application supplies them.

This is important because **client-side validation is never treated as the security boundary**.

The server then processes the uploaded evidence before creating the database record.

---

# 8. Photo Upload and Validation

## 8.1 Upload middleware

File:

```text
backend/src/middleware/upload.js
```

Multer stores files under:

```text
backend/uploads/
```

Generated filenames use a timestamp and random suffix:

```text
issue-<timestamp>-<random>.<extension>
```

## 8.2 Accepted image types

The upload filter accepts:

- JPEG
- JPG
- PNG
- GIF
- WebP

Both extension and MIME type are checked.

## 8.3 File size limit

Maximum upload size:

```text
10 MB
```

## 8.4 Public image URL

Uploaded images are served by Express at:

```http
/uploads/<filename>
```

The controller builds a public URL using:

- `API_HOST`, if configured.
- Otherwise the incoming request host.
- `API_PROTOCOL`, if configured.
- Otherwise the detected request protocol.

## 8.5 Resolution images

When staff/admin uploads an image through the issue update endpoint:

- If the issue is being changed to `Resolved`, or is already `Resolved`, the image is stored in `resolved_photo_url`.
- Otherwise the uploaded image is stored in `photo_url`.

This lets the record retain the original issue evidence separately from resolution evidence.

---

# 9. GPS and EXIF Validation

The backend uses `exiftool-vendored` to inspect metadata from uploaded images and `geolib` to calculate geographic distance.

## 9.1 EXIF metadata checks

For an uploaded image, the backend looks for meaningful metadata such as:

- Camera make.
- Camera model.
- Original capture date.
- GPS fields.

An image with no meaningful EXIF metadata is rejected.

## 9.2 Photo date validation

The backend attempts to obtain the photo date from:

1. `DateTimeOriginal`.
2. `FileModifyDate` as a fallback.

If no valid date can be parsed, the upload is rejected.

The current maximum accepted photo age is:

```text
24 hours
```

A photo older than 24 hours is rejected.

## 9.3 GPS extraction

The backend attempts several GPS formats:

1. Direct `GPSLatitude` / `GPSLongitude` fields.
2. `GPSPosition` string.
3. Existing GPS fields where the coordinates cannot be directly parsed.

Coordinate arrays containing degrees/minutes/seconds are converted to decimal degrees.

Southern latitude and western longitude are negated using the EXIF reference fields.

## 9.4 Device/report coordinates vs photo coordinates

The backend compares:

```text
Photo EXIF coordinates
        vs
Reported/device coordinates
```

using `geolib.getDistance()`.

Current maximum distance:

```text
200 meters
```

If the distance is greater than 200 meters, the issue submission is rejected.

## 9.5 Gallery and missing GPS behavior

The current implementation permits a photo without directly readable embedded GPS to fall back to the submitted device coordinates for comparison. This is intentionally documented because it is part of the current implementation, not a guarantee that the image itself contains GPS evidence.

The `needs_review` field is used for manual review in cases such as remote-photo fallback and duplicate-image detection.

## 9.6 Important distinction

The system validates **available metadata**; EXIF metadata is not cryptographic proof that a photograph was taken at a particular location. EXIF can be removed or manipulated.

Therefore, EXIF/GPS validation should be treated as an evidence-quality signal rather than absolute proof of authenticity.

---

# 10. Reverse Geocoding

File:

```text
backend/src/utils/geocoding.js
```

The backend uses OpenStreetMap Nominatim reverse geocoding.

Input:

```text
latitude + longitude
```

Output:

```text
human-readable address
```

## 10.1 Address formatting

The formatter attempts to combine:

- House number.
- Road/street.
- Suburb/neighborhood.
- City/town/village.
- State/region.
- Country.
- Postal code.

## 10.2 Cache

An in-memory cache is used to reduce repeated external requests.

Current configuration:

```text
TTL: 24 hours
Maximum entries: 1000
```

Coordinates are rounded to four decimal places for the cache key.

## 10.3 Retry behavior

The service retries failed geocoding requests with exponential backoff.

If all attempts fail, the backend stores a coordinate-based fallback address such as:

```text
Location (12.3456, 78.9012)
```

This means geocoding failure does not necessarily prevent issue creation.

---

# 11. Duplicate Image Detection

File:

```text
backend/src/utils/phash.js
```

The application calculates a perceptual hash (pHash) for uploaded images.

## 11.1 Why pHash is used

A normal file hash changes completely when an image is resized or slightly modified.

A perceptual hash is intended to remain similar for visually similar images.

CivicGuardAI uses this to identify possible repeated/similar evidence.

## 11.2 Current algorithm

The utility generates a 64-bit hash represented as a hexadecimal string.

Similarity is calculated from Hamming distance:

```text
similarity = (1 - hammingDistance / 64) × 100
```

## 11.3 Review threshold

Current threshold:

```text
90% similarity
```

A match at or above the threshold does **not** automatically reject the issue.

Instead:

```text
needs_review = true
```

and the admin dashboard can identify it for manual review.

## 11.4 Current comparison strategy

The controller retrieves existing non-null pHashes from the issues table and compares the new hash against them.

This is simple and appropriate for a prototype, but a large production dataset should use a more scalable similarity-search strategy.

---

# 12. Admin Dashboard Flow

## 12.1 Admin login

```text
Admin/Staff
    |
    v
/admin login page
    |
    v
POST /api/auth/login
    |
    v
Check returned role
    |
    +---- citizen -> rejected
    |
    +---- staff -> allowed
    |
    +---- admin -> allowed
    |
    v
Store token + user
    |
    v
Dashboard
```

The role check exists in the client, but backend authorization remains the authoritative security boundary.

## 12.2 Dashboard data flow

```text
Dashboard.jsx
      |
      v
issuesAPI.getAll()
      |
      v
GET /api/issues
      |
      v
Issue.findAll(order by created_at DESC)
      |
      v
Dashboard DataGrid
```

## 12.3 Dashboard features

The dashboard currently supports:

- Issue listing.
- Search by title.
- Search by description.
- Search by status.
- Search by address.
- Manual-review filtering.
- Status badges.
- Issue image thumbnail.
- Created date.
- View action.
- Delete action.

## 12.4 Manual review

An issue with:

```text
needs_review = true
```

is shown as requiring manual review.

The issue detail page displays a warning and allows staff/admin users to inspect the evidence before continuing the workflow.

---

# 13. Issue Lifecycle

## 13.1 Open

Default status for a new issue:

```text
Open
```

Meaning:

> The issue has been submitted and is awaiting staff action.

## 13.2 In Progress

Meaning:

> Authorized staff/admin has acknowledged or started working on the issue.

## 13.3 Resolved

Meaning:

> The issue has been marked as resolved.

A resolution image can be uploaded and stored separately in:

```text
resolved_photo_url
```

## 13.4 Delete

Only `admin` users can delete issues.

The backend returns:

```http
204 No Content
```

on successful deletion.

Deletion is permanent at the issue-record level; the current controller does not implement a soft-delete field.

---

# 14. API Reference

Base URL for local development:

```text
http://localhost:5000
```

## 14.1 Health

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Service health check |

## 14.2 Authentication

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | Public citizen registration | Create citizen account |
| POST | `/api/auth/login` | No | Public | Authenticate user |
| GET | `/api/auth/users` | JWT | `admin` | List users |

## 14.3 Issues

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/issues` | JWT | Any authenticated user | Create issue |
| GET | `/api/issues` | No | Public | List issues |
| GET | `/api/issues/:id` | No | Public | Get one issue |
| PUT | `/api/issues/:id` | JWT | `staff`, `admin` | Update issue/status/upload image |
| DELETE | `/api/issues/:id` | JWT | `admin` | Delete issue |

## 14.4 Authentication matrix

```text
                    citizen     staff       admin
----------------------------------------------------
Register               ✓          -           -
Login                  ✓          ✓           ✓
Create Issue           ✓          ✓           ✓
View Issues            ✓          ✓           ✓
Update Issue           -          ✓           ✓
Delete Issue           -          -           ✓
List Users             -          -           ✓
Admin Portal           -          ✓           ✓
```

---

# 15. Data Model

## 15.1 User model

Table:

```text
users
```

Fields:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | STRING | User name |
| `email` | STRING | Unique email address |
| `password` | STRING | Bcrypt password hash |
| `role` | ENUM | `citizen`, `staff`, `admin` |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last model update time |

## 15.2 Issue model

Table:

```text
issues
```

Fields:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | STRING | Issue title |
| `description` | TEXT | Issue description |
| `photo_url` | STRING | Original issue image URL |
| `resolved_photo_url` | STRING | Resolution image URL |
| `latitude` | DECIMAL(9,6) | Issue latitude |
| `longitude` | DECIMAL(9,6) | Issue longitude |
| `address` | TEXT | Reverse-geocoded address |
| `phash` | STRING(255) | Perceptual image hash |
| `needs_review` | BOOLEAN | Manual-review flag |
| `status` | ENUM | `Open`, `In Progress`, `Resolved` |
| `created_at` | timestamp | Issue creation time |

## 15.3 Important data-model note

The current `issues` table does **not** contain a `reported_by` / `user_id` foreign key. The API authenticates the caller who creates an issue, but the current issue record does not persist that user's identity as an issue relationship.

If citizen-specific issue ownership, audit trails, notifications, or accountability are required, a future schema should add an explicit reporter relationship.

---

# 16. Repository Structure

```text
CivicGuardAI/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   └── issueController.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   ├── errorHandler.js
│   │   │   └── upload.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Issue.js
│   │   │   └── index.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   └── issueRoutes.js
│   │   └── utils/
│   │       ├── geocoding.js
│   │       └── phash.js
│   ├── scripts/
│   ├── uploads/
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
├── admin/
│   ├── src/
│   │   ├── api/
│   │   │   └── api.js
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── IssueDetails.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
│
├── mobile/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── navigation/
│   │   ├── screens/
│   │   │   └── ReportScreen.js
│   │   └── utils/
│   │       └── api.js
│   ├── README.md
│   └── package.json
│
└── README.md
```

---

# 17. Mobile Application

## 17.1 Technology

- React Native.
- Expo.
- React Navigation.
- React Native Paper.
- Axios.
- Expo Location.
- Expo Image Picker.
- React Native Maps.
- AsyncStorage.

## 17.2 API configuration

The mobile app prefers:

```text
EXPO_PUBLIC_API_URL
```

Example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:5000
```

The mobile API client removes a trailing slash and uses the configured value as its base URL.

The current code retains a development LAN-IP fallback for backward compatibility. For a clean deployment, configure `EXPO_PUBLIC_API_URL` explicitly.

## 17.3 API client

File:

```text
mobile/src/utils/api.js
```

Responsibilities:

- Configure Axios.
- Configure timeout.
- Store the current JWT in Axios defaults through `setAuthToken()`.
- Run a startup `/health` probe.
- Convert common connection and HTTP errors into application-friendly messages.

## 17.4 Authentication context

File:

```text
mobile/src/context/AuthContext.js
```

Responsibilities:

- Restore saved session.
- Login.
- Register.
- Persist token/user.
- Logout.
- Configure API authorization.

---

# 18. Admin Portal

## 18.1 Technology

- React 19.
- Vite.
- Material UI.
- MUI Data Grid.
- React Router.
- Axios.

## 18.2 Protected routing

`admin/src/App.jsx` checks:

```text
auth token exists
AND
stored role is staff/admin
```

before rendering protected pages.

## 18.3 Admin API client

File:

```text
admin/src/api/api.js
```

The Axios request interceptor automatically reads `admin_token` and adds:

```http
Authorization: Bearer <token>
```

The response interceptor clears the browser session when the backend returns `401`.

## 18.4 Issue details

The issue detail page provides:

- Status display.
- Review status.
- Description.
- Address.
- Latitude/longitude.
- Created date.
- Original issue image.
- Resolution image.
- Status update.
- Resolution image upload when status is `Resolved`.

---

# 19. Backend Service

## 19.1 Startup

`backend/server.js` performs the following sequence:

```text
dotenv.config()
      |
      v
Create Express app
      |
      v
Configure CORS
      |
      v
Configure JSON/urlencoded parsing
      |
      v
Serve /uploads
      |
      v
Register /api/auth
      |
      v
Register /api/issues
      |
      v
Register error handler
      |
      v
Connect PostgreSQL
      |
      v
sequelize.sync()
      |
      v
Listen on 0.0.0.0:<PORT>
```

## 19.2 Health endpoint

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

## 19.3 Database

Sequelize is used as the ORM.

The current backend connects to PostgreSQL using:

```text
DATABASE_URL
```

The models are synchronized at startup with:

```text
sequelize.sync()
```

## 19.4 Middleware order

The application currently applies:

1. CORS.
2. JSON parser.
3. URL-encoded parser.
4. Static uploads.
5. Root/health routes.
6. Authentication routes.
7. Issue routes.
8. Error handler.

Route-specific authentication and upload middleware are applied inside the route definitions.

---

# 20. Environment Configuration

## 20.1 Backend

Create:

```text
backend/.env
```

Example:

```env
PORT=5000
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>
JWT_SECRET=<strong-random-secret>
```

Optional public upload URL configuration:

```env
API_HOST=<reachable-api-host>
API_PROTOCOL=https
```

### Backend variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | Express listening port; defaults to `5000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing/verification secret |
| `API_HOST` | No | Public host used to construct image URLs |
| `API_PROTOCOL` | No | Public protocol used for image URLs |

## 20.2 Admin

Create:

```text
admin/.env
```

Example:

```env
VITE_API_URL=http://localhost:5000/api
```

## 20.3 Mobile

Configure:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:5000
```

Important:

> The mobile base URL should point to the backend root, not `/api`, because the mobile code adds `/api/...` to its requests.

## 20.4 Secrets

Never commit:

- Database passwords.
- JWT secrets.
- Private API credentials.
- Production environment files containing secrets.

The repository ignores environment files while keeping `.env.example` files available as templates.

---

# 21. Local Development Setup

## 21.1 Prerequisites

Recommended development environment:

- Node.js 18.x for the backend.
- PostgreSQL.
- npm.
- Expo-compatible development environment for mobile.
- Android emulator, iOS simulator, or physical device for mobile testing.

## 21.2 Start backend

```bash
cd backend
npm install
npm run dev
```

Expected service:

```text
http://localhost:5000
```

Verify:

```bash
curl http://localhost:5000/health
```

Expected:

```json
{"status":"ok"}
```

## 21.3 Start admin portal

```bash
cd admin
npm install
npm run dev
```

For the default Vite development server, use the URL printed by Vite in the terminal.

## 21.4 Start mobile app

```bash
cd mobile
npm install
```

Configure the API URL first:

```env
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:5000
```

Then:

```bash
npx expo start
```

The mobile device and development computer must be able to reach each other over the network when using a local LAN backend.

## 21.5 Development startup order

Recommended:

```text
PostgreSQL
   ↓
Backend API
   ↓
Admin portal / Mobile app
```

---

# 22. API Examples

## 22.1 Register citizen

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Santhosh",
  "email": "santhosh@example.com",
  "password": "example-password"
}
```

## 22.2 Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "santhosh@example.com",
  "password": "example-password"
}
```

Successful response shape:

```json
{
  "user": {
    "id": "uuid",
    "name": "Santhosh",
    "email": "santhosh@example.com",
    "role": "citizen"
  },
  "token": "JWT_TOKEN"
}
```

## 22.3 Create issue without image

```http
POST /api/issues
Authorization: Bearer JWT_TOKEN
Content-Type: multipart/form-data
```

Fields:

```text
title=Broken street light
description=Street light is not working.
latitude=12.345678
longitude=78.901234
```

The current backend permits issue creation without an uploaded file. If an image is supplied, the image-processing validation described above is applied.

## 22.4 Create issue with image

Form-data fields:

```text
title
 description
latitude
longitude
image=<image file>
```

The file field must be:

```text
image
```

## 22.5 Update status

```http
PUT /api/issues/<issue-id>
Authorization: Bearer STAFF_OR_ADMIN_JWT
Content-Type: application/json
```

```json
{
  "status": "In Progress"
}
```

## 22.6 Resolve issue

```http
PUT /api/issues/<issue-id>
Authorization: Bearer STAFF_OR_ADMIN_JWT
Content-Type: application/json
```

```json
{
  "status": "Resolved"
}
```

## 22.7 Upload resolution image

Use multipart form-data:

```text
image=<resolution image>
status=Resolved
```

The backend stores the uploaded image in `resolved_photo_url` when the effective issue status is `Resolved`.

## 22.8 Delete issue

```http
DELETE /api/issues/<issue-id>
Authorization: Bearer ADMIN_JWT
```

Successful response:

```http
204 No Content
```

---

# 23. Validation and Error Handling

## 23.1 Request validation

The backend uses `express-validator` for:

- Authentication fields.
- Issue title.
- Issue description.
- Issue URL fields.
- Latitude.
- Longitude.
- Status.
- Issue UUID.

## 23.2 Coordinate rules

Latitude:

```text
-90 to 90
```

Longitude:

```text
-180 to 180
```

## 23.3 Issue ID rules

Issue IDs must be valid UUIDs.

## 23.4 Common responses

| Status | Meaning |
|---:|---|
| `201` | Resource created |
| `204` | Resource deleted successfully |
| `400` | Validation/evidence/input failure |
| `401` | Missing/invalid/expired authentication |
| `403` | Authenticated but insufficient role |
| `404` | Resource/endpoint not found |
| `409` | Duplicate registration email |
| `503` | Service unavailable response handling in clients |

## 23.5 Mobile error handling

The mobile Axios client translates common cases including:

- Network failure.
- Timeout.
- `401` authentication failure.
- `404` endpoint failure.
- `503` service unavailable.
- Express-validator errors.

## 23.6 Admin error handling

The admin Axios client:

- Automatically attaches the JWT.
- Clears the session on `401`.
- Redirects the user to `/login` after authentication failure.

---

# 24. Security Architecture

## 24.1 Password security

Passwords are never intentionally stored as plaintext.

The backend uses:

```text
bcryptjs
```

for hashing and comparison.

## 24.2 JWT security

JWTs are signed with:

```text
JWT_SECRET
```

and expire after:

```text
12 hours
```

## 24.3 Server-side authorization

Role authorization is enforced on the API.

This prevents a citizen from gaining staff/admin capabilities simply by changing client-side UI state.

## 24.4 Input validation

Request validation is performed on the server for important fields, including coordinates and issue status.

## 24.5 File validation

Uploaded images are filtered by MIME type and extension and limited to 10 MB.

## 24.6 Transport security

Development can use HTTP on a local network.

Production should use:

```text
HTTPS
```

for all authenticated traffic and image delivery.

## 24.7 Current CORS configuration

The backend currently allows:

```text
origin: '*'
```

This is convenient for development but should be restricted to trusted application origins in production.

## 24.8 Token storage limitations

The mobile app currently uses AsyncStorage for the JWT, and the admin portal uses localStorage.

For a security-hardened production deployment, consider platform-secure mobile credential storage and an architecture using secure, HTTP-only cookies for browser sessions where appropriate.

---

# 25. Deployment Architecture

A production architecture should look like:

```text
             Internet
                 |
                 v
        ┌──────────────────┐
        │ HTTPS / TLS      │
        │ Reverse Proxy    │
        └────────┬─────────┘
                 |
       ┌─────────┴─────────┐
       |                   |
       v                   v
 Admin Web             Backend API
 Static hosting        Node/Express
       |                   |
       |                   +----------+
       |                              |
       |                              v
       |                       PostgreSQL
       |                              |
       |                              v
       |                         Image storage
       |
       v
 Citizen Mobile App
```

## Production recommendations

- Use HTTPS.
- Restrict CORS origins.
- Use a managed PostgreSQL instance where appropriate.
- Use durable object storage instead of local ephemeral uploads.
- Add database backups.
- Add structured application logging.
- Add rate limiting.
- Add monitoring and alerting.
- Add secret management.
- Add CI/CD.
- Add automated tests.
- Add database migrations rather than relying solely on `sequelize.sync()`.

---

# 26. Troubleshooting

## 26.1 Mobile cannot connect to backend

Check:

```text
1. Backend is running.
2. GET /health works from the development machine.
3. EXPO_PUBLIC_API_URL points to the computer's reachable LAN IP.
4. Phone/emulator can reach that IP.
5. Port 5000 is not blocked by the firewall.
6. The mobile URL does not incorrectly include /api.
```

## 26.2 Admin receives 401

The JWT may be invalid or expired.

Action:

```text
Log in again.
```

The admin client automatically clears its stored session when the API returns `401`.

## 26.3 Admin receives 403

Confirm the account role is:

```text
staff
```

or:

```text
admin
```

A citizen account is intentionally blocked from the admin portal.

## 26.4 Image upload fails

Check:

- File extension.
- MIME type.
- File size under 10 MB.
- Image metadata.
- Photo date.
- GPS consistency.
- Backend logs.

## 26.5 Photo rejected for metadata

The backend may reject an uploaded image when:

- No meaningful EXIF metadata exists.
- No valid date can be extracted.
- Photo age exceeds 24 hours.
- GPS coordinates are invalid.
- Photo/report coordinates differ by more than 200 meters.

## 26.6 Geocoding fails

The backend retries Nominatim requests and eventually uses a coordinate-based fallback address, so geocoding failure should not always block issue creation.

## 26.7 Duplicate image warning

A high pHash similarity does not automatically reject the report. It marks the issue for manual review.

---

# 27. Testing and Verification

## 27.1 Recommended end-to-end test

Test the exact business flow:

```text
1. Register citizen
2. Login
3. Receive JWT
4. Submit issue
5. Capture/select photo
6. Obtain GPS
7. Upload image
8. Validate EXIF/date/GPS
9. Reverse-geocode address
10. Compute pHash
11. Create issue
12. Login as staff/admin
13. Open dashboard
14. Find issue
15. Open issue details
16. Update status to In Progress
17. Update status to Resolved
18. Upload resolution image
19. Confirm resolved_photo_url
20. Login as admin
21. Delete issue
22. Confirm GET returns 404
```

## 27.2 Negative tests

Also test:

- Wrong password.
- Unknown email.
- Missing JWT.
- Expired JWT.
- Citizen calling staff endpoint.
- Staff calling admin-only delete endpoint.
- Invalid UUID.
- Invalid latitude.
- Invalid longitude.
- Unsupported image type.
- Image larger than 10 MB.
- Image without required metadata.
- Old image.
- Photo GPS farther than 200 meters from reported location.
- Duplicate/similar image.
- Missing issue ID.
- Database unavailable.
- Nominatim unavailable.

## 27.3 Current verification status

The repository has been source-audited and the documented architecture is based on the current implementation. A full production-like runtime test of all three applications, database, mobile device permissions, EXIF samples, and external geocoding service should still be executed before claiming the complete flow is integration-tested.

---

# 28. Known Limitations and Production Improvements

The following items are intentionally documented instead of being hidden behind high-level descriptions.

## 28.1 Issue ownership is not persisted

The authenticated user creates the issue, but the issue model does not currently store a `reported_by` user relationship.

Recommended improvement:

```text
issues.reported_by -> users.id
```

## 28.2 EXIF is not tamper-proof

EXIF metadata can be changed or removed.

Recommended future controls:

- Stronger capture-time attestation where platform capabilities permit.
- Server-side evidence scoring.
- Audit logs.
- Device/app provenance where feasible.

## 28.3 Local filesystem image storage

Images are currently stored in:

```text
backend/uploads/
```

For production, use durable object storage and store object identifiers/URLs in the database.

## 28.4 pHash comparison scalability

The current implementation compares a new hash against all stored non-null hashes.

For a large system, use a scalable similarity index or pre-filtering strategy.

## 28.5 CORS

Production should not use unrestricted `*` origins.

## 28.6 Browser/mobile token storage

localStorage and AsyncStorage are convenient but should be reviewed for the final threat model.

## 28.7 JWT lifecycle

The system currently uses short-lived access tokens but does not implement refresh-token rotation.

Potential improvement:

```text
Access token
      +
Refresh token rotation
      +
Token revocation strategy
```

## 28.8 Authentication hardening

Recommended additions:

- Rate limiting.
- Account lockout/abuse controls.
- Email verification.
- Password reset.
- Audit logging.
- Security monitoring.

## 28.9 Database migrations

The current startup uses Sequelize synchronization. Production deployments should use versioned database migrations for controlled schema changes.

## 28.10 Mobile image upload implementation

The mobile report screen currently constructs multipart FormData and explicitly supplies a multipart content type. This area should be integration-tested on the target Expo/React Native versions because multipart boundary handling can differ across clients.

## 28.11 Photo requirement consistency

The mobile UI is designed around reporting with a photo, but the backend currently permits issue creation without an uploaded file. If the product requirement is **photo mandatory**, enforce that requirement server-side as well.

---

# 29. Technology Stack

| Area | Technology |
|---|---|
| Mobile | React Native + Expo |
| Mobile navigation | React Navigation |
| Mobile UI | React Native Paper |
| Mobile HTTP | Axios |
| Mobile storage | AsyncStorage |
| Location | Expo Location |
| Image picker | Expo Image Picker |
| Map | React Native Maps |
| Admin UI | React |
| Admin build | Vite |
| Admin UI library | Material UI |
| Admin grid | MUI X Data Grid |
| Admin routing | React Router |
| Admin HTTP | Axios |
| Backend runtime | Node.js 18.x |
| Backend framework | Express 5 |
| Validation | express-validator |
| Authentication | JSON Web Token |
| Password hashing | bcryptjs |
| File upload | Multer |
| EXIF | exiftool-vendored |
| Geo distance | geolib |
| Image similarity | image-hash / pHash |
| ORM | Sequelize |
| Database | PostgreSQL |
| Reverse geocoding | OpenStreetMap Nominatim |

---

# 30. Maintainer Notes

## 30.1 Important files to understand first

If you are new to the project, read these files in this order:

```text
1. README.md
2. backend/server.js
3. backend/src/routes/authRoutes.js
4. backend/src/controllers/authController.js
5. backend/src/middleware/authMiddleware.js
6. backend/src/routes/issueRoutes.js
7. backend/src/controllers/issueController.js
8. backend/src/middleware/upload.js
9. backend/src/utils/geocoding.js
10. backend/src/utils/phash.js
11. backend/src/models/User.js
12. backend/src/models/Issue.js
13. mobile/src/context/AuthContext.js
14. mobile/src/utils/api.js
15. mobile/src/screens/ReportScreen.js
16. admin/src/api/api.js
17. admin/src/App.jsx
18. admin/src/pages/Login.jsx
19. admin/src/pages/Dashboard.jsx
20. admin/src/pages/IssueDetails.jsx
```

## 30.2 Architectural rule

The most important rule in CivicGuardAI is:

> **The client improves user experience; the backend is the authority for authentication, authorization, validation, evidence processing, and data persistence.**

Never rely on a mobile/admin UI check as the only security control.

## 30.3 Debugging the complete workflow

When debugging the complete flow, trace the request in this order:

```text
Client UI
  ↓
Axios configuration
  ↓
HTTP request
  ↓
Express route
  ↓
JWT middleware
  ↓
Role middleware
  ↓
Multer
  ↓
Request validation
  ↓
Controller
  ↓
EXIF/GPS validation
  ↓
Geocoding
  ↓
pHash
  ↓
Sequelize
  ↓
PostgreSQL
  ↓
JSON response
  ↓
Client state/UI
```

That sequence is the canonical mental model for maintaining the project.

---

## License

The repository currently does not declare a project-specific open-source license. Add an appropriate `LICENSE` file before distributing the project as open source.

---

## Project Status

CivicGuardAI is an actively developed full-stack project. The README documents the current implementation and its architecture, including authentication, issue reporting, photo evidence processing, GPS/EXIF validation, reverse geocoding, duplicate-image review, administration, resolution, and deletion.
