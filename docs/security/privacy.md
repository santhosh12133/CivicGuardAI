# Privacy and personal data

What personal data CivicFix collects, why, who can see it, where it goes, and how long it is kept. Operators deploying CivicFix are the data controller and must publish a privacy notice for citizens that matches their deployment; this page is the technical basis for it. It is not legal advice — check obligations under applicable law, such as India's Digital Personal Data Protection Act, 2023.

## Data inventory

| Data | Source | Purpose | Stored in | Visible to |
|---|---|---|---|---|
| Name | Sign-up, Google profile | Identify reporter to staff; greet user | `users.name` | Staff, admins; the user |
| Email | Sign-up, Google | Sign-in, password reset | `users.email` | Staff, admins; the user |
| Phone number | Phone sign-in | Sign-in | `users.phone` | Admins (account list); the user |
| Password | Sign-up | Sign-in | `users.password` (bcrypt hash only) | Nobody |
| Google account ID | Google sign-in | Link account | `users.google_id` | Nobody (internal) |
| Report text, category | Citizen | The report | `issues` | **Public** |
| Report location (coordinates, address) | Device GPS | Locate the problem | `issues.latitude/longitude/address` | **Public** |
| Photo, including its EXIF metadata | Camera / gallery | Evidence | `photos.data` | **Public** (anyone with the URL; listed with public issues) |
| Who reported an issue | Session | Follow-up, accountability | `issues.user_id` | Staff, admins; the reporter |
| Staff notes, status changes | Staff | Public accountability | `issue_updates` | **Public** (staff names shown; citizen names hidden) |
| Device / sign-in info: IP, user agent, times | Requests | Security (sessions, investigation) | `sessions`, API logs | Operators |
| Email/SMS codes | Generated | Verification | `otp_codes` (hashes only) | Nobody |

CivicFix does not use analytics, advertising or tracking SDKs, and does not sell or share data beyond the processors below.

## Public by design

Issue reports are public: anyone can list issues and see their description, category, location, photos and timeline. Citizens' **identities** are not public (reporter name/email and citizen timeline-author names are only returned to staff and admins). The app should make clear that a report and its photo are public before submission.

**Photos keep their original EXIF metadata**, which can include the exact GPS position (already public as the report location), capture time and camera model. Stripping metadata after validation is a planned improvement ([threat model](threat-model.md#prioritised-improvements)).

## Third parties (processors)

| Service | Receives | When |
|---|---|---|
| AWS (RDS, ECS, S3, CloudWatch) | All stored data and logs | Hosting on AWS; region set by `AWS_REGION` (default Mumbai, `ap-south-1`) |
| Amazon SES | Email address, reset code | "Forgot password" |
| Amazon SNS and mobile carriers | Phone number, sign-in code | Phone sign-in |
| Google | That the user signs in to CivicFix (OAuth) | Google sign-in |
| OpenStreetMap Nominatim | Report coordinates (no user identity) | Each new report, unless `GEOCODING_ENABLED=false` |
| Render / Vercel | All stored data / static portal | Only on the trial hosting option |
| GitHub | Source code, CI logs, APK releases (no user data) | Always |

## Retention

| Data | Default retention | How to change |
|---|---|---|
| Issues, photos, timeline | Until an admin deletes the issue | Define a policy (e.g. delete resolved issues after N years) and run it as a scheduled job |
| Accounts | Until deleted by an operator | See "Requests from individuals" |
| Sessions | Active up to 30 days after last use; rows kept | Purge expired rows periodically |
| One-time codes | Valid 2–15 minutes; rows kept | Purge expired rows periodically |
| API logs (CloudWatch) | 30 days | `RetentionInDays` in `infra/aws/base.yml` |
| Database backups | 7 days (+ final snapshot on stack deletion) | `DB_BACKUP_DAYS`; delete old snapshots in RDS |

## Requests from individuals

There is no self-service account deletion yet. Operators handle requests manually:

| Request | How |
|---|---|
| Access: "what do you have about me?" | Look up the user by email/phone (`npm run view-users` or SQL) and export their `users` row and issues (`SELECT * FROM issues WHERE user_id = …`) |
| Correction | Update the `users` row |
| Deletion of an account | `DELETE FROM users WHERE id = …` — sessions are deleted with it; their issues stay but are no longer linked to them (`user_id` becomes null). Delete their issues first (admin portal) if the reports should go too |
| Deletion of a report | Admin portal → issue → Delete (removes timeline and photos) |

Backups still contain deleted data until they expire (7 days by default).

## Engineering rules

- Collect only what a feature needs; document any new personal field in this inventory before merging.
- Never log passwords, tokens, codes, full request bodies or `Authorization` headers.
- Personal data must not appear in test fixtures, screenshots in issues, or CI artifacts; use `example.com` addresses and the `+9199999…` test number.
- New third-party services must be added to the processors table.
