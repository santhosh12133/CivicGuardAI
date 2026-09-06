# CivicGuardAI Documentation Hub

CivicGuardAI (CivicFix) is documented as a production-oriented civic reporting platform. The documentation is organized so that a new engineer, security reviewer, operator, or hiring manager can understand the system without reading the entire codebase first.

## Documentation map

### 01 — Product and Requirements
- [Product and System Overview](product-system-overview.md) — users, responsibilities, business flow, boundaries, and non-goals.
- [Glossary](glossary.md) — shared civic, geospatial, security, and engineering terminology.

### 02 — Architecture
- [System Architecture](system-architecture.md) — components, boundaries, request flows, and deployment topology.
- [Diagrams](diagrams.md) — Mermaid sequence, state, ER, deployment, and trust-boundary diagrams.
- [Architecture Decision Records](architecture-decision-records.md) — durable rationale for important technical decisions.

### 03 — Data and API
- [Data Model](data-model.md) — entities, ownership, constraints, lifecycle, and persistence rules.
- [API Reference](api-reference.md) — endpoint contract, authentication, validation, examples, and error semantics.
- [Environment Reference](environment-reference.md) — every supported environment variable, type, default, sensitivity, and operational effect.

### 04 — Evidence and Geospatial Validation
- [Evidence Validation](evidence-validation.md) — upload validation, EXIF, time checks, GPS checks, reverse geocoding, and duplicate detection.

### 05 — Security and Privacy
- [Security Architecture](security.md) — authentication, authorization, secure defaults, and secret handling.
- [Threat Model](security-threat-model.md) — assets, trust boundaries, threats, mitigations, and residual risks.
- [Privacy and Data Governance](privacy-data-governance.md) — data classification, retention design, deletion, logging, and privacy boundaries.

### 06 — Quality and Performance
- [Testing Strategy](testing.md) — test layers, fixtures, local commands, and release gates.
- [Testing Matrix](testing-matrix.md) — scenario-level requirements and expected outcomes.
- [Performance](performance.md) — workload definitions, benchmark methodology, bottlenecks, and evidence standards.

### 07 — Operations and Reliability
- [Observability](observability.md) — logs, metrics, health checks, dashboards, alerts, and correlation IDs.
- [Operations Runbook](operations-runbook.md) — routine operations, diagnostics, and recovery actions.
- [Incident Response](incident-response.md) — severity model, containment, evidence preservation, communication, and postmortems.
- [Disaster Recovery](disaster-recovery.md) — backup, restore, RPO/RTO, and recovery drills.
- [Troubleshooting](troubleshooting.md) — common failures and systematic diagnosis.

### 08 — Deployment and Release
- [Production Deployment](../DEPLOYMENT.md) — deployment procedures for API, admin, and mobile applications.
- [Production Readiness](../PRODUCTION_READINESS.md) — release prerequisites and explicit caveats.
- [Release Management](release-management.md) — release gates, rollback, hotfixes, and evidence.

### 09 — Engineering Governance
- [Developer Guide](developer-guide.md) — repository orientation, local setup, change workflow, and definition of done.
- [Contributing](../CONTRIBUTING.md) — contribution standards and pull request expectations.
- [Changelog](../CHANGELOG.md) — user-visible and engineering-significant changes.

## Recommended reading paths

### New engineer
1. Product and System Overview
2. System Architecture
3. Data Model
4. API Reference
5. Developer Guide
6. Testing Strategy

### Backend engineer
1. System Architecture
2. API Reference
3. Data Model
4. Evidence Validation
5. Security Architecture
6. Observability

### Mobile/admin engineer
1. Product and System Overview
2. API Reference
3. Security Architecture
4. Deployment Guide
5. Testing Matrix

### Security reviewer
1. Security Architecture
2. Threat Model
3. Privacy and Data Governance
4. API Reference
5. Production Readiness

### DevOps/SRE reviewer
1. Deployment Guide
2. Observability
3. Operations Runbook
4. Disaster Recovery
5. Incident Response
6. Production Readiness

## Documentation rules

Documentation must distinguish four evidence levels:

| Level | Meaning |
|---|---|
| Source | Behavior derived directly from the current repository implementation. |
| Automated | Verified by repeatable automated checks such as CI or tests. |
| Staging | Verified against a deployed non-production environment. |
| Production | Verified in the actual production environment. |

Never present source-level behavior as production evidence. Do not publish performance, fraud-detection, availability, or accuracy numbers unless the methodology and measurements are recorded.

## Change-to-documentation matrix

| Change | Required documentation | Required verification |
|---|---|---|
| API endpoint | API Reference | Contract/integration test |
| Database schema | Data Model | Migration + persistence test |
| Evidence rule | Evidence Validation | Representative fixture test |
| Auth/security behavior | Security + Threat Model | Positive and negative security tests |
| Environment variable | Environment Reference | Startup/config validation |
| Deployment topology | Deployment + Architecture | Deployment smoke test |
| Operational behavior | Runbook + Observability | Failure-mode test |
| Major architecture decision | ADR | Architecture review |

## Documentation ownership

The repository is the source of truth for implementation behavior. When implementation and documentation diverge, fix the documentation in the same change as the implementation whenever practical. Every production-impacting behavior should have an explicit operational owner or escalation path.
