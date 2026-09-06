# Incident Response Runbook

## 1. Purpose

This runbook defines the minimum process for detecting, containing, investigating, recovering from, and learning from production incidents.

## 2. Severity model

| Severity | Definition | Initial objective |
|---|---|---|
| SEV-0 | Confirmed major security/data-integrity event or total service loss | Immediate containment |
| SEV-1 | Major user workflow unavailable | Restore critical path quickly |
| SEV-2 | Significant degradation with workaround | Stabilize and investigate |
| SEV-3 | Limited defect or operational issue | Resolve in normal engineering cycle |

The exact escalation target and response window should be agreed by the deploying organization.

## 3. Incident lifecycle

```text
Detect
  |
  v
Triage
  |
  v
Contain
  |
  v
Preserve evidence
  |
  v
Mitigate / restore
  |
  v
Validate recovery
  |
  v
Communicate closure
  |
  v
Postmortem / corrective actions
```

## 4. Immediate response checklist

- Identify affected service and environment.
- Capture current deployment/commit SHA.
- Determine whether authentication, authorization, data integrity, availability, or uploads are affected.
- Preserve relevant logs and timestamps.
- Avoid changing evidence unnecessarily.
- Rotate credentials if compromise is suspected.
- Disable or narrow a risky feature when safe to do so.
- Record all major actions in the incident timeline.

## 5. Security incident

For suspected credential or token compromise:

1. Revoke/rotate affected secrets.
2. Review recent authentication and authorization events.
3. Review privileged issue operations.
4. Identify accessed or modified data.
5. Verify no secrets were emitted to logs or build artifacts.
6. Assess whether public issue/image data was exposed.
7. Follow the organization's legal/privacy notification requirements.

## 6. Upload incident

For a malicious-file or parser-abuse event:

1. Stop accepting the affected file pattern if possible.
2. Preserve a safe forensic identifier, not unrestricted binary copies in logs.
3. Inspect upload processing and ExifTool behavior.
4. Review storage access logs.
5. Scan affected objects with the chosen malware scanner.
6. Remove/quarantine unsafe files.
7. Patch or tighten validation before reopening the path.

## 7. Database incident

For database corruption/unavailability:

1. Check `/health`.
2. Confirm database connectivity from the deployed API environment.
3. Check managed database status and connection saturation.
4. Stop destructive writes if data integrity is uncertain.
5. Determine last known-good backup.
6. Restore into an isolated environment first where practical.
7. Validate schema, user accounts, issue counts, and critical references.
8. Reconnect application traffic only after verification.

## 8. Deployment rollback

Rollback when a release causes material regression and a safe forward fix is not immediately available.

Record:

```text
current release
rollback target
reason
observed impact
verification result
follow-up issue
```

## 9. Postmortem

Every SEV-0/SEV-1 incident should produce a blameless postmortem containing:

- summary;
- impact;
- timeline;
- detection;
- root/contributing causes;
- what worked;
- what failed;
- customer/user impact;
- corrective actions;
- owners and due dates;
- links to logs, metrics, commits, and deployment records.

## 10. Operational evidence

The production deployment documentation already requires post-deployment verification of health, authentication, issue creation, uploads, role restrictions, and admin workflow. fileciteturn255file0L2-L2

Incident recovery must extend those smoke tests with the specific failure condition that triggered the incident.
