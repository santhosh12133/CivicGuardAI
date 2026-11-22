# Operations runbook

Routine procedures for running CivicFix. Commands assume the AWS deployment in region `ap-south-1`; substitute your region. AWS CLI commands need credentials for the account (use the AWS console's CloudShell, which is already signed in). For problems, see [Troubleshooting](troubleshooting.md); for outages, [Incident response](incident-response.md).

## Where things are

| What | Where |
|---|---|
| API address | Deploy workflow run → **Summary**; or CloudFormation → `civicfix-api` → Outputs |
| Admin portal address | Same (`civicfix-base` → Outputs → admin URL) |
| API logs | CloudWatch → Log groups → `/civicfix/api` (30 days) |
| API service | ECS → Clusters → `civicfix` → service `civicfix-api` |
| Database | RDS → `civicfix-db` (PostgreSQL 17, private) |
| Secrets | Secrets Manager → `civicfix/jwt-secret`, `civicfix/database`, `civicfix/staff/<email>`, optional `civicfix/google-client-secret` |
| Android releases | GitHub → Releases |

## Daily / weekly checks

| Check | How | Healthy |
|---|---|---|
| API health | `curl -s <API URL>/health` | `{"status":"ok","database":"ok"}` |
| Errors | Logs Insights query *errors* below | Near zero |
| Review queue | Admin portal → Overview → *Needs review* and *Overdue* | Being worked down |
| Database storage | RDS → `civicfix-db` → Monitoring → *Free storage space* | > 20 % free (storage also auto-grows up to the configured maximum) |
| Cost | AWS Billing → Bills | Within budget |
| Dependency updates | GitHub → Pull requests from Dependabot | Merged or triaged weekly |

### Useful CloudWatch Logs Insights queries

Logs Insights → log group `/civicfix/api`:

```text
# Errors passed to the error handler (all 5xx, plus some 4xx such as bad uploads)
fields @timestamp, @message
| filter @message like /Unhandled error/
| sort @timestamp desc | limit 50

# Rejected evidence (why reports fail)
fields @timestamp, @message
| filter @message like /older than 24 hours|away from reported location|no camera metadata|no date metadata/
| stats count() by bin(1h)

# Email / SMS / Google sign-in problems
fields @timestamp, @message
| filter @message like /ses request failed|sns request failed|AWS credentials|Google sign-in failed/
| sort @timestamp desc
```

## Accounts

| Task | How |
|---|---|
| Add a staff member | Admin portal → **Staff** → Add. Share the one-time password privately; they change it after signing in |
| First admin, or recover admin access | GitHub → Actions → **AWS admin task** → `create-staff` with role `apps/admin`. Password: Secrets Manager → `civicfix/staff/<email>` |
| Reset someone's password | Admin portal → Staff → Reset password (signs them out everywhere) |
| Remove staff access | Admin portal → Staff → change role to `citizen` |
| Citizen locked out | They wait 15 minutes, or use *Forgot password*, or an admin resets the password |
| Delete an account | See [Privacy → Requests from individuals](../security/privacy.md#requests-from-individuals) |

Review staff and admin accounts every quarter and demote people who no longer need access.

## Deploying

- **Normal path:** merge a pull request into `main`; changes under `apps/api/`, `apps/admin/` or `infra/aws/` deploy automatically. Watch GitHub → Actions → *Deploy to AWS*.
- **Re-run a deploy / build the APK:** Actions → *Deploy to AWS* → Run workflow.
- **Roll back:** revert the commit on `main` (GitHub → the merged PR → **Revert**), merge the revert. See [Deployment → Rolling back](../deployment/README.md#rolling-back).
- **Restart the API without a code change** (e.g. after changing a secret): ECS → Clusters → `civicfix` → `civicfix-api` → **Update service** → *Force new deployment*, or:

  ```bash
  aws ecs update-service --cluster civicfix --service civicfix-api --force-new-deployment
  ```

## Configuration changes

| Change | How |
|---|---|
| Switch on email / SMS / Google sign-in | Repository variables, then re-run the deploy ([Sign-in providers](../deployment/sign-in-providers.md)) |
| Allow another admin portal origin | Add it to `CorsOrigins` in the deploy (by default it is the CloudFront URL) |
| Bigger database | Repository variable `DB_INSTANCE_CLASS` (e.g. `db.t4g.small`), re-run deploy. Causes a few minutes of downtime |
| More API capacity | Change `Cpu`, `Memory` or `MaxTasks` in `infra/aws/api.yml` via a pull request |
| Longer log retention | `RetentionInDays` in `infra/aws/base.yml` |

## Rotating secrets

| Secret | Procedure | User impact |
|---|---|---|
| `JWT_SECRET` (`civicfix/jwt-secret`) | Secrets Manager → *Retrieve secret value* → *Edit* → paste a new 64-character random value → save → force a new API deployment | Current access tokens stop working; apps renew silently with their refresh tokens |
| Database password (`civicfix/database`) | 1. RDS → `civicfix-db` → Modify → new master password → apply immediately. 2. Put the same password in the secret's `password` field. 3. Force a new API deployment | API errors between steps 1 and 3 (about a minute) |
| Google client secret | Google Cloud → Credentials → reset secret → update `civicfix/google-client-secret` → force a new deployment | Google sign-in fails until the restart |
| Android signing key | Cannot be rotated without every citizen reinstalling. Protect it instead | — |

## Housekeeping

| Task | Frequency | How |
|---|---|---|
| Remove unreferenced photos | Monthly | Actions → *AWS admin task* → `prune-uploads (list only)`, then `(delete)` |
| Purge expired sessions and codes | Quarterly (optional; rows are small) | `DELETE FROM sessions WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'; DELETE FROM otp_codes WHERE expires_at < now() - interval '1 day';` (run through a database client with access to the private database) |
| Restore drill | Twice a year | [Backup and recovery](backup-and-recovery.md#restore-drill) |
| Review this runbook | After every incident | Update the steps that were wrong |

## Render (trial hosting)

| Task | How |
|---|---|
| Logs | Render → `civicfix-api` → Logs |
| Create staff | `DATABASE_URL="<External Database URL>" DATABASE_SSL=true npm run create-staff -- …` from `apps/api/` |
| Restart | Render → Manual Deploy → *Deploy latest commit* |
| Back up before the free database expires | `pg_dump "<External Database URL>" -Fc -f civicfix.dump` |
