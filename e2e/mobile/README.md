# Android end-to-end flows (Maestro)

Run by `.github/workflows/e2e.yml` (via `.github/scripts/mobile-e2e.sh`) on an Android emulator against a real API seeded by `apps/api/test/e2e/seed.js` with `SEED_RESOLVED=1` (adds a report the city team resolved with a photo; the browser tests run without it). Flows run in file-name order.

| Flow | Checks |
|---|---|
| `01-signup-and-browse.yaml` | New account, issue list, category filter, issue detail |
| `02-my-reports-and-timeline.yaml` | My Reports badge, staff note in the timeline |
| `03-report-issue.yaml` | Report with category and a gallery photo through the real evidence checks |
| `04-profile-password.yaml` | Change password; old one refused, new one works |
| `05-server-address.yaml` | Server address validation |
| `06-phone-sign-in.yaml` | Phone number + SMS code, new account by phone, sign out everywhere |
| `07-resolution-photo.yaml` | A fixed report shows the city team's photo on its card and on the issue screen, and the image really loads |
| `_dismiss-system-dialogs.yaml` | Shared: closes Android "app not responding" dialogs |

Environment passed with `-e`: `ASHA_EMAIL`, `ASHA_PASSWORD`, `RAVI_EMAIL`, `RAVI_PASSWORD`, `NEW_EMAIL`, `TEST_PHONE_NUMBER`, `TEST_PHONE_CODE`.

Run locally: start an emulator, then

```bash
.github/scripts/mobile-e2e.sh <app.apk> <fresh-photo.jpg> <seed.json> <output-dir>
```
