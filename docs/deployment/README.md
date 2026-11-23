# Deployment

CivicFix has three deployable parts:

| Part | What it is | Built from |
|---|---|---|
| **API** | Node.js/Express service with PostgreSQL; also stores and serves photos | `apps/api/` (Docker image) |
| **Admin portal** | Static React site for staff and admins | `apps/admin/` (`npm run build`) |
| **Android app** | APK for citizens, published under GitHub **Releases** | `apps/mobile/` (Expo prebuild + Gradle) |

## Choose a hosting option

Also: [Oracle Cloud](oracle-cloud.md) — Docker Compose on one Always Free VM with free HTTPS, created from Oracle Cloud Shell (can also share a server with Medical Claim AI).

| | [AWS](aws.md) (recommended) | [Render + Vercel](render-vercel.md) |
|---|---|---|
| Purpose | Real use | Free trial |
| Database | RDS PostgreSQL 17, private, encrypted, 7-day point-in-time backups | Render free PostgreSQL, **deleted after ~6 weeks** |
| API | ECS Express Mode (Fargate), HTTPS, 1–2 tasks | Render free web service, sleeps after 15 idle minutes |
| Admin portal | S3 + CloudFront | Vercel |
| Deploys | GitHub Actions on every merge to `main` (OIDC, no keys) | Render/Vercel auto-deploy from Git |
| Email/SMS sign-in | Built in (SES/SNS task role) | Needs an IAM user's keys |
| Cost | ~USD 50–70/month at low traffic | Free |

Then:

1. [Build and publish the Android app](android-app.md) (automatic on AWS).
2. Optionally switch on [Forgot password, phone and Google sign-in](sign-in-providers.md).
3. Work through the [launch checklist](#launch-checklist).

## Launch checklist

- [ ] `<API URL>/health` returns `{"status":"ok","database":"ok"}`
- [ ] `<API URL>/api/auth/providers` lists the sign-in methods you expect
- [ ] Admin portal: sign in as admin works; signing in with a citizen account is refused
- [ ] APK: install it, register a citizen account, report an issue with a **fresh camera photo** taken at the spot
- [ ] The report appears in the admin portal with its photo, category and reporter
- [ ] Staff can move it to *In Progress* and *Resolved*, add a note and a resolution photo
- [ ] The citizen sees the new status, the note and both photos in **My Reports**
- [ ] Signing out in the app and the portal returns to the sign-in screen
- [ ] Backups: on AWS, RDS shows automated backups enabled ([Backup and recovery](../operations/backup-and-recovery.md))
- [ ] A budget alert is set in AWS Billing (AWS only)

## Environments

There is one deployment per hosting option; there is no separate staging stack yet. To test changes safely, the end-to-end workflow runs every pull request against a fresh API and database ([Testing](../testing/strategy.md)). The Android app can be pointed at another server from **Login → Server**.

## Rolling back

| Part | How |
|---|---|
| API and admin portal (AWS) | Revert the commit on `main`; the deploy workflow redeploys the previous code. A deploy whose API never becomes healthy fails the workflow before the admin portal is updated |
| API (Render) | Render dashboard → **Deploys** → previous deploy → **Rollback** |
| Admin portal (Vercel) | Vercel → **Deployments** → previous → **Promote to Production** |
| Android app | Publish the previous code as a new build (a higher build number is required; Android will not install an older one over a newer one) |

The API only *adds* database columns and never removes them ([Data model](../architecture/data-model.md#schema-changes)), so rolling the API back does not need a database rollback.
