# Glossary

| Term | Meaning |
|---|---|
| Civic issue | A citizen-submitted report describing a problem with public infrastructure or services. |
| Report | The persisted representation of a civic issue in the backend. |
| Citizen | A user intended to submit civic reports. |
| Staff | Authorized operational user who reviews and updates issues. |
| Admin | Privileged user with staff capabilities plus administrative operations. |
| Issue status | Workflow state: `Open`, `In Progress`, or `Resolved`. |
| Needs review | A signal that additional human investigation is required. |
| EXIF | Image metadata containing information such as capture time, camera, and GPS. |
| GPS | Geographic coordinates associated with a device or image. |
| Reverse geocoding | Converting latitude/longitude into a human-readable address. |
| pHash | Perceptual image hash used to identify visually similar images. |
| Similarity threshold | Rule controlling when two pHash values are considered sufficiently similar to flag a report. |
| RBAC | Role-based access control. |
| JWT | Signed token used to represent an authenticated session. |
| CORS | Browser-origin access policy enforced by the API. |
| Source of truth | Authoritative system of record; PostgreSQL for core application data. |
| Object storage | Durable storage service for uploaded images, such as S3-compatible storage. |
| RPO | Maximum acceptable amount of data loss measured in time. |
| RTO | Maximum acceptable recovery time. |
| p50/p95/p99 | Percentile latency measurements used to describe typical and tail performance. |
| Correlation ID | Identifier shared across logs/events for one request or workflow. |
| Audit record | Durable record of a business/security-relevant action. |
| Residual risk | Known risk that remains after current mitigations. |
| Production evidence | Runtime proof that a behavior works in the deployed production environment. |
