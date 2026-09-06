# Architecture Decision Records

This file records decisions that materially affect system behavior, security, operations, or future maintenance.

## ADR-001 — Three-application monorepo

**Status:** Accepted

**Decision:** Keep the citizen mobile app, admin portal, and backend API in a single repository.

**Reasoning:** The applications have a tightly coupled API contract and are maintained as one product. A monorepo simplifies coordinated changes, shared documentation, and deployment configuration.

**Trade-off:** Independent services cannot use completely independent release tooling without additional repository automation.

## ADR-002 — PostgreSQL as transactional source of truth

**Status:** Accepted

**Decision:** Store users, issues, lifecycle fields, evidence references, and review metadata in PostgreSQL through Sequelize.

**Reasoning:** Relational integrity, queryability, role/user relationships, and durable persistence are central to the workflow.

**Trade-off:** Horizontal scaling requires deliberate connection pooling, indexing, migration management, and backup design.

## ADR-003 — Server-side evidence validation

**Status:** Accepted

**Decision:** EXIF, date, GPS, and image-similarity checks run in the API rather than trusting mobile/browser validation.

**Reasoning:** Clients are untrusted and can be modified.

**Trade-off:** Upload processing increases API cost/latency; asynchronous processing becomes attractive as volume grows.

## ADR-004 — pHash as a manual-review signal

**Status:** Accepted

**Decision:** Similar-image detection flags reports for review instead of automatically declaring fraud.

**Reasoning:** Perceptual similarity is heuristic and can produce false positives.

**Trade-off:** Human review remains necessary.

## ADR-005 — Local uploads are transitional

**Status:** Transitional

**Decision:** The current repository stores uploads on the API filesystem while documenting durable object storage as the target architecture.

**Reasoning:** Local storage is simple for development and early deployment.

**Trade-off:** Ephemeral/containerized environments can lose files and multiple API instances cannot safely share local state.

## ADR-006 — Process-local rate limiting is not sufficient for scaled deployment

**Status:** Transitional

**Decision:** Keep a process-local limiter for baseline abuse protection, but require shared Redis/equivalent rate limiting before horizontal scaling.

**Reasoning:** The current limiter protects a process but counters are not shared between replicas. fileciteturn256file0L2-L4

## ADR-007 — Explicit production readiness evidence

**Status:** Accepted

**Decision:** Documentation distinguishes source implementation, automated verification, staging verification, and production verification.

**Reasoning:** A production claim must be supported by runtime evidence, not source inspection alone.

## ADR template

Use the following format for future significant decisions:

```markdown
## ADR-NNN — <decision title>

**Status:** Proposed | Accepted | Deprecated | Superseded

**Context:**

What problem or constraint led to this decision?

**Decision:**

What was chosen?

**Alternatives considered:**

- Option A
- Option B

**Consequences:**

What becomes easier/harder?

**Security impact:**

What changes in the threat model?

**Operational impact:**

What changes in deployment/monitoring/recovery?

**Evidence:**

Link to tests, benchmark results, incidents, or deployment records.
```
