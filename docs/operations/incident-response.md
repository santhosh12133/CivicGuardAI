# Incident response

What to do when something goes wrong in production. Keep calm, communicate, and write things down as you go.

## Severity

| Level | Examples | Response |
|---|---|---|
| **SEV1** | API down for everyone; data loss; personal data exposed; an admin account compromised | Start immediately, any hour. Update stakeholders every 30 minutes |
| **SEV2** | Reports cannot be submitted; admin portal unusable; sign-in failing for many users | Start within 1 hour during working hours |
| **SEV3** | One feature degraded (SMS codes delayed, map missing, slow pages) | Next working day |
| **SEV4** | Cosmetic, single user | Normal backlog |

## Process

1. **Acknowledge** — one person is the incident lead. Note the start time.
2. **Assess** — what is broken, for whom, since when? Check `/health`, the latest deploy (GitHub → Actions), and the logs ([runbook queries](runbook.md#useful-cloudwatch-logs-insights-queries)).
3. **Mitigate first, fix later** — roll back, restart, or switch off the failing feature. Restoring service beats finding the root cause.
4. **Communicate** — tell staff (and citizens, for SEV1/2) what is affected and when the next update comes.
5. **Resolve** — confirm with the [launch checklist](../deployment/README.md#launch-checklist) items that apply.
6. **Review** — within 5 working days for SEV1/2, write a blameless postmortem (template below) and file follow-up issues.

## Playbooks

### API down or `/health` returns 503

1. `curl -i <API URL>/health`. `503` with `"database":"unavailable"` → database problem (next playbook). No response → the service.
2. ECS → `civicfix` → `civicfix-api`: are tasks running? Open the latest stopped task → *Stopped reason*.
3. CloudWatch `/civicfix/api`: the last lines before a crash. `Failed to start server: …` names the cause (missing secret, database unreachable).
4. If it started with a deploy: revert the commit on `main`.
5. Otherwise: force a new deployment ([runbook](runbook.md#deploying)).

### Database unavailable

1. RDS → `civicfix-db`: status (`available`, `modifying`, `storage-full`, `rebooting`).
2. *Storage full* → Modify → raise allocated storage (no downtime).
3. *Rebooting / maintenance* → wait; check RDS → Events.
4. Credentials changed? The password in `civicfix/database` must match RDS; then force a new API deployment.
5. Data corrupted or deleted → [Backup and recovery](backup-and-recovery.md).

### Bad deploy

1. GitHub → the merged pull request → **Revert** → merge. The deploy workflow redeploys the previous version.
2. If the admin portal alone is broken, the revert also republishes it.
3. If citizens received a broken APK, publish a new build from the previous code (a higher build number is needed).

### Compromised account

1. Admin portal → Staff → **Reset password** for the account (signs it out everywhere). For an admin you cannot reach, use *AWS admin task* → `create-staff` for that email.
2. Demote it to `citizen` if the person should not have access.
3. Review what it changed: `SELECT * FROM issue_updates WHERE user_id = '<id>' ORDER BY created_at DESC;` and deleted issues (missing rows can be recovered from a backup).
4. Check other accounts for the same password-reuse risk; ask staff to change passwords.

### Leaked secret

| Secret | Do now |
|---|---|
| `JWT_SECRET` | Rotate ([runbook](runbook.md#rotating-secrets)). Anyone holding it could have forged tokens for any user; review recent changes |
| Database password | Rotate; check RDS for unusual connections (it is not reachable from the internet, which limits exposure) |
| Google client secret | Reset it in Google Cloud and update Secrets Manager |
| Android keystore | Treat as permanent: attackers could sign look-alike updates. Publish warnings, consider a new app identity |
| AWS deploy role ARN | Not a secret on its own (only `main` of this repository can use it) |

Committed a secret to Git? Rotating it is what matters; removing it from history does not undo the exposure.

### SMS or email abuse (cost spike)

1. SNS → Text messaging → lower the monthly spend limit, or set `ENABLE_SMS=false` and redeploy.
2. Logs: which numbers/IPs requested codes (`otp/request` errors and `429`s).
3. Lower `AUTH_RATE_LIMIT_MAX`; consider AWS WAF rate rules in front of the API.

### Personal data exposed

1. Stop the exposure (roll back, disable the feature, delete the public data).
2. Record what data, whose, for how long, and who could have accessed it.
3. Notify the data protection lead; legal notification duties may apply within short deadlines (for example under India's DPDP Act, 2023).

## Postmortem template

```markdown
# Postmortem: <title> (<date>)

**Severity:** SEV<n> · **Duration:** <start> – <end> (<minutes>) · **Lead:** <name>

## Summary
What happened and who was affected, in three sentences.

## Timeline (UTC)
- hh:mm — first signal
- hh:mm — mitigation
- hh:mm — resolved

## Root cause
Why it happened. Ask "why" until you reach something you can change.

## What went well / what didn't

## Action items
| Action | Owner | Issue |
|---|---|---|
```
