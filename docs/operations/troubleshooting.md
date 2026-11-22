# Troubleshooting

Find the symptom, check the likely causes in order. For outages follow [Incident response](incident-response.md); for local setup problems see also [Local development](../getting-started/local-development.md#common-problems).

## API

| Symptom | Likely cause | Fix |
|---|---|---|
| API won't start: `JWT_SECRET must be configured with at least 32 characters` | Missing/short secret | Set a 32+ character `JWT_SECRET` |
| `Failed to start server: … ECONNREFUSED` / `getaddrinfo ENOTFOUND` | Database not running or wrong host | Check `DATABASE_URL` / `DB_HOST`; is PostgreSQL up? |
| `self-signed certificate` / `unable to verify the first certificate` | Database TLS verification | AWS: `DATABASE_SSL_CA` must point at the bundled RDS CA. Other hosts: `DATABASE_SSL=true`; as a last resort `DATABASE_SSL_REJECT_UNAUTHORIZED=false` |
| `/health` → `503` | Database unreachable | See [Database unavailable](incident-response.md#database-unavailable) |
| `relation "…" does not exist` or `column … does not exist` | Schema not created/upgraded in production | Set `DB_SYNC=true` (the AWS and Render templates do) and restart |
| Many `429 Too many requests` | Many users behind one IP (an office), or abuse | Raise `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX`, or block the source |
| Photos return 404 after a redeploy | Very old photos saved only to disk before photos moved to the database | Nothing to recover unless you have the files; new photos are stored in PostgreSQL |
| Photo URLs point at `localhost` or the wrong host | Proxy rewrites `Host` | Set `API_HOST` (and `API_PROTOCOL=https`) |

## Sign-in

| Symptom | Likely cause | Fix |
|---|---|---|
| *Invalid credentials* for a correct password | Different account email (case is ignored), or a phone/Google-only account with no password | Use *Forgot password*, or sign in the original way |
| *Too many wrong passwords. Try again in 15 minutes* | Lockout | Wait, reset by email, or an admin resets the password |
| Portal: *restricted to staff and admin* | Citizen account | An admin must create the staff account or promote it |
| Users signed out unexpectedly | Password changed elsewhere, *sign out everywhere*, admin reset, a reused refresh token, `JWT_SECRET` changed together with sessions cleared, or 30 days unused | Sign in again. Repeated unexplained sign-outs for one user: their refresh token may have been copied — reset their password |
| *Forgot password* link or phone button missing | Provider not configured | `GET /api/auth/providers`; see [Sign-in providers](../deployment/sign-in-providers.md) |
| `503 Email is not configured` | `EMAIL_PROVIDER` unset in production | Configure SES |
| Reset email never arrives | SES sandbox (recipient not verified), spam folder, sender not verified | Request SES production access; check SES → Reputation metrics |
| SMS code never arrives | SNS sandbox, spend limit reached, DLT template mismatch (India) | SNS → Text messaging → Delivery status logs; the message text must match the registered template exactly |
| Google: `redirect_uri_mismatch` | Redirect URI not registered | Add `<API URL>/api/auth/google/callback` to the OAuth client |
| Google in the portal: `error=not_staff` | No staff/admin account with that Google email | Create the staff account with the same email first |
| Google in the app returns to the browser, not the app | App built before the `civicfix://` scheme was added | Install the latest APK |

## Admin portal

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser console: *blocked by CORS policy* / API says `Origin not allowed by CORS` | Portal origin not in `CORS_ORIGINS` | Add the exact origin (scheme + host, no trailing slash) |
| Build fails: `VITE_API_URL is not set` / `must be a full URL ending in /api` | Build variable | Set `VITE_API_URL=<API URL>/api` |
| Blank page or 404 on refresh of `/issue/…` | Host not rewriting to `index.html` | Vercel uses `vercel.json`; CloudFront is configured for it by `base.yml` |
| Old version still showing after deploy | Browser/CDN cache | Hard refresh; the deploy invalidates CloudFront, allow a few minutes |

## Android app

| Symptom | Likely cause | Fix |
|---|---|---|
| *Cannot connect to server* | Wrong server address, server asleep (Render free), no internet | Check **Login → Server**; open `<API URL>/health` in the phone's browser |
| *Photo is older than 24 hours* | Gallery photo too old | Take a new photo with the camera |
| *Photo was taken N m away from reported location* | Location services off/inaccurate when reporting, or photo from elsewhere | Turn on precise location, wait for a GPS fix, report from the spot |
| *Photo has no camera metadata* / *no date metadata* | Screenshot, downloaded or edited image, or a messaging app stripped the metadata | Use the camera button, or the original photo from the camera roll |
| *Capture date is in the future* | Phone clock wrong | Turn on automatic date and time |
| Upload fails on some phones only | Old APK with the multipart bug | Install the latest APK |
| *App not installed* when updating | New APK signed with a different key (e.g. a test build) | Uninstall the old app first; keep using the release key |
| No map on the report screen | No Google Maps key in the build | Expected; coordinates and *Open in Maps* are shown instead |

## Deployment (AWS)

| Message in the failed run | Fix |
|---|---|
| `No default VPC` | VPC console → **Actions → Create default VPC**, then re-run |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `AWS_DEPLOY_ROLE_ARN` is wrong, the run wasn't on `main`, or the repository name in the bootstrap stack doesn't match exactly (case-sensitive) |
| `backup retention period exceeds the maximum available to free tier` | Repository variable `DB_BACKUP_DAYS` = `1`, re-run |
| `Provider with url https://token.actions.githubusercontent.com already exists` (bootstrap) | Delete the failed bootstrap stack, recreate it with `CreateGitHubOidcProvider` = `false` |
| `The API did not become healthy` | CloudWatch `/civicfix/api` shows why; on a first run the database may still be creating — re-run |
| Stack in `UPDATE_ROLLBACK_FAILED` | CloudFormation → stack → **Continue update rollback**, then re-run |

## Collecting information for a bug report

- What happened, expected behaviour, time (with time zone), and the user's role
- API address and the deployed commit (Actions → latest deploy run)
- Relevant API log lines (remove emails, phone numbers and tokens)
- Browser console errors, or Android version and app build number (shown in the release name)
- Steps to reproduce; then open a [bug report](https://github.com/santhosh12133/CivicGuardAI/issues/new/choose)
