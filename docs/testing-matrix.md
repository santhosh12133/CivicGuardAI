# Testing Matrix

## 1. Purpose

This matrix converts the architecture and security requirements into repeatable verification scenarios. A feature is not considered verified merely because the code exists.

## 2. Test layers

| Layer | Goal | Examples |
|---|---|---|
| Static | Catch syntax/config errors | `node --check`, Expo config, build |
| Unit | Validate isolated rules | validators, distance/hash helpers |
| Integration | Validate API + DB behavior | auth, issue CRUD, persistence |
| Security | Validate negative paths | RBAC, malformed JWT, upload abuse |
| Contract | Validate request/response compatibility | endpoint payloads |
| E2E | Validate user journeys | mobile/admin -> API -> database |
| Operational | Validate deployment behavior | health, backup/restore, rate limit |

## 3. Authentication cases

| ID | Scenario | Expected |
|---|---|---|
| AUTH-001 | Valid citizen login | 200 + sanitized user + JWT |
| AUTH-002 | Invalid password | 401 |
| AUTH-003 | Unknown user | Safe authentication failure |
| AUTH-004 | Missing Authorization header | 401 |
| AUTH-005 | Malformed Bearer token | 401 |
| AUTH-006 | Expired JWT | 401 |
| AUTH-007 | Citizen attempts staff action | 403 |
| AUTH-008 | Staff attempts admin-only delete | 403 |
| AUTH-009 | Public registration submits privileged role | Rejected / role forced to citizen |

## 4. Issue API cases

| ID | Scenario | Expected |
|---|---|---|
| ISSUE-001 | Valid issue + valid image + coordinates | 201 |
| ISSUE-002 | Missing title | 400 |
| ISSUE-003 | Missing description | 400 |
| ISSUE-004 | Latitude outside range | 400 |
| ISSUE-005 | Longitude outside range | 400 |
| ISSUE-006 | Invalid issue UUID | 400 |
| ISSUE-007 | Staff update | Success |
| ISSUE-008 | Admin update | Success |
| ISSUE-009 | Citizen update | 403 |
| ISSUE-010 | Admin delete | Success |
| ISSUE-011 | Staff delete | 403 |
| ISSUE-012 | Citizen delete | 403 |

## 5. Upload/evidence cases

| ID | Scenario | Expected |
|---|---|---|
| FILE-001 | JPEG <= 10 MB | Accepted if evidence checks pass |
| FILE-002 | PNG <= 10 MB | Accepted if evidence checks pass |
| FILE-003 | Disallowed MIME | Rejected |
| FILE-004 | Oversized upload | Rejected |
| FILE-005 | Malformed image | Safe rejection |
| EXIF-001 | Valid recent EXIF date | Continue |
| EXIF-002 | Missing significant EXIF | Rejection/manual policy according to current controller |
| EXIF-003 | Photo older than 24 hours | Rejected by current rule |
| GPS-001 | Valid coordinates within 200 m | Continue |
| GPS-002 | Coordinate mismatch > 200 m | Rejected by current rule |
| PHASH-001 | Similar image >= 90% | `needs_review` flagged, not automatically blocked |

Current implementation details for date, GPS distance, and pHash thresholds are documented in the evidence guide. fileciteturn263file0L2-L2

## 6. API abuse cases

| ID | Scenario | Expected |
|---|---|---|
| SEC-001 | Request burst below limiter | Normal response |
| SEC-002 | Rate-limit threshold exceeded | 429 |
| SEC-003 | Untrusted production CORS origin | Rejected |
| SEC-004 | Missing JWT on protected route | 401 |
| SEC-005 | Client attempts role spoofing | Authorization based on verified token, not body |
| SEC-006 | Error injection | Generic production 5xx response |

## 7. Mobile tests

- Login and logout.
- Session restoration.
- Camera permission denial.
- Gallery permission denial.
- Location permission denial.
- Location acquisition timeout.
- Issue submission on poor connectivity.
- Retry after transient API failure.
- Upload on Android and iOS representative devices.
- API base URL points to intended environment.

## 8. Admin tests

- Login.
- Staff/admin role gate.
- Issue listing.
- Issue detail view.
- Search/filter behavior.
- Status updates.
- Resolution image upload.
- Admin delete action.
- Automatic logout on 401.
- SPA deep-link refresh.

## 9. Database tests

- Connection succeeds with expected environment.
- Required models initialize.
- User/issue relationships work.
- Unique user email constraint behaves correctly.
- Issue status values remain valid.
- Migration/upgrade path is repeatable.
- Backup restore produces a usable schema and data set.

## 10. Evidence requirements

A release should record:

```text
Test ID
Environment
Commit SHA
Timestamp
Input fixture/reference
Expected result
Observed result
Pass/Fail
Defect reference
```

For production sign-off, automated CI is only one evidence source. The deployment guide explicitly requires runtime checks such as authentication, issue creation, image upload, and admin workflow verification. fileciteturn255file0L2-L2
