# Disaster Recovery

## 1. Recovery objective

Disaster recovery protects against loss of service or data caused by infrastructure failure, accidental deletion, deployment failure, database corruption, or storage loss.

RPO and RTO must be defined by the deployment owner; this repository does not claim a measured recovery target until backup/restore drills exist.

## 2. Criticality

| Component | Criticality | Recovery priority |
|---|---|---:|
| PostgreSQL | Critical | 1 |
| API | Critical | 2 |
| Issue images | High | 3 |
| Admin portal | High | 4 |
| Mobile build pipeline | Medium | 5 |
| Geocoding enrichment | Medium | 6 |

## 3. Backup requirements

Back up:

- PostgreSQL database;
- production object storage once adopted;
- deployment/configuration metadata that is safe to retain;
- migration history.

Do not back up secrets in plaintext as part of source-controlled application artifacts.

## 4. Restore sequence

```text
Provision infrastructure
        |
        v
Restore PostgreSQL
        |
        v
Apply/verify schema
        |
        v
Restore object storage
        |
        v
Deploy API
        |
        v
Verify /health
        |
        v
Verify authentication
        |
        v
Verify issue creation/read/update
        |
        v
Re-enable clients/traffic
```

## 5. Database recovery validation

After restore verify:

- application can connect;
- user accounts exist as expected;
- issue counts and timestamps are plausible;
- role values are valid;
- issue-to-user relationships remain intact;
- status values remain valid;
- critical indexes/constraints exist;
- application migrations are compatible.

## 6. File recovery

The current deployment stores uploads on the API filesystem and documents this as a limitation for ephemeral deployments. Production architecture should move images to durable object storage. fileciteturn255file0L2-L2

A recovery plan must verify both database references and object existence. Restoring the database without the corresponding images creates broken evidence links.

## 7. Recovery drills

At least once per release cycle appropriate to the service's criticality:

1. Restore a database backup into an isolated environment.
2. Deploy the application against the restored database.
3. Verify `/health`.
4. Verify login.
5. Verify issue reads.
6. Verify a test issue lifecycle.
7. Verify image references/object retrieval.
8. Record duration and failures.
9. Update RPO/RTO evidence.

## 8. Disaster scenarios

### Database unavailable

Use the incident response runbook, preserve the last known-good state, and restore/fail over according to the hosting provider's managed PostgreSQL procedure.

### Application host lost

Recreate the API from the repository/deployment definition and restore durable data. This is another reason not to depend on local filesystem uploads in the target production architecture.

### Accidental issue deletion

Use a database/object-storage recovery strategy rather than assuming the application delete endpoint can be undone.

## 9. Recovery evidence

Record:

```text
backup identifier
test environment
restore start/end time
application commit SHA
migration version
validation results
RPO observed
RTO observed
defects discovered
```

## 10. Current readiness statement

The repository has deployment and production-readiness documentation, but a documented recovery procedure is not proof that a restore drill has succeeded. Actual recovery readiness requires a successful repeatable restore test. fileciteturn256file0L2-L4
