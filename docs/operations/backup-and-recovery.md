# Backup and recovery

All CivicFix state — accounts, sessions, issues, timelines and photos — is in one PostgreSQL database, so backing up the database backs up everything. The API containers, admin portal and APKs can be rebuilt from Git.

## What is backed up

| Hosting | Backups | Point-in-time restore | Retention |
|---|---|---|---|
| AWS RDS | Automated daily snapshots + transaction logs | Yes, to any second within the retention window (typically up to ~5 minutes ago) | `DB_BACKUP_DAYS` (default 7). Deleting the stack keeps a final snapshot |
| Render (free) | None on the free plan | No | — Take your own `pg_dump` |

| Objective | Target on AWS |
|---|---|
| RPO (data that may be lost) | ≤ 5 minutes |
| RTO (time to restore) | ≤ 2 hours (restoring a small database takes 15–30 minutes; plus reconnecting the API) |

Not backed up automatically: CloudWatch logs (30-day retention), GitHub Releases (kept by GitHub), and the Android signing keystore (**keep your own copies**).

## Restore on AWS

Use this for deleted or corrupted data, or a failed database.

1. **Pick the time** just before the problem (UTC).
2. RDS → `civicfix-db` → **Actions → Restore to point in time**:
   - *Custom date and time*: the time from step 1
   - DB instance identifier: `civicfix-db-restored`
   - Same instance class, VPC, **DB subnet group** (`civicfix-…`) and **security group** as `civicfix-db`; *Public access: No*
3. Wait until `civicfix-db-restored` is *Available*.
4. **Partial recovery** (a few deleted issues): connect to both databases from a machine inside the VPC (e.g. a temporary ECS task or CloudShell VPC environment) and copy the rows back with `pg_dump --data-only -t issues -t issue_updates -t photos --where …` or SQL `INSERT … SELECT`. Then delete the restored instance.
5. **Full recovery** (replace the database):
   1. Note the restored instance's endpoint.
   2. Rename the old instance (`civicfix-db` → `civicfix-db-broken`; turn off deletion protection first) and the restored one to `civicfix-db`, so the endpoint the API uses (stored in the `civicfix-base` stack) points at the restored data.
   3. Force a new API deployment and run the [launch checklist](../deployment/README.md#launch-checklist).
   4. Turn deletion protection back on for the new `civicfix-db`. Keep the broken instance for a few days, then delete it.
6. Record what was done in the incident postmortem.

Renaming instances changes resources outside CloudFormation; afterwards, check the `civicfix-base` stack with **Detect drift**. If in doubt, restore with a new name and update the database host parameter through a pull request instead.

## Restore drill

Twice a year, and after major infrastructure changes:

1. Restore to point in time as `civicfix-db-drill` (steps 1–3 above).
2. Connect read-only and compare counts with production:
   `SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM issues) issues, (SELECT count(*) FROM photos) photos;`
3. Open a restored photo (`SELECT name, size FROM photos ORDER BY created_at DESC LIMIT 1;`).
4. Delete `civicfix-db-drill`.
5. Record the date, duration and any problems in [Production readiness](production-readiness.md).

## Manual backups (any host)

```bash
# Back up (custom format, compressed)
pg_dump "$DATABASE_URL" -Fc -f civicfix-$(date +%F).dump

# Restore into an empty database
pg_restore --no-owner -d "$TARGET_DATABASE_URL" civicfix-YYYY-MM-DD.dump
```

On Render's free plan do this at least weekly, and before the database's expiry date. Store dumps encrypted (they contain personal data) and delete them according to your retention policy.

## Losing the whole AWS region or account

Not covered by the default setup. To prepare: copy automated snapshots to another region (RDS → Snapshots → *Copy snapshot*, or enable *cross-Region automated backups*), and keep a recent `pg_dump` outside AWS. Recovery is then: bootstrap a new account/region ([Deploy on AWS](../deployment/aws.md)), restore the snapshot as `civicfix-db`, deploy, and publish a new APK if the API address changed.
