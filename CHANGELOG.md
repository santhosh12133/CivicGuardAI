# Changelog

All notable engineering and product changes are recorded here.

## [Unreleased]

### Documentation

- Added a centralized documentation hub under `docs/`.
- Added product/system overview and architecture documentation.
- Added detailed API contract documentation with request examples and authorization semantics.
- Added data-model documentation and migration guidance.
- Added evidence-validation documentation covering EXIF, date, GPS, reverse geocoding, and pHash behavior.
- Added environment-variable reference and secret-management rules.
- Added security architecture, threat model, and privacy/data-governance documentation.
- Added testing strategy and scenario-level testing matrix.
- Added observability, incident-response, and disaster-recovery guidance.
- Added developer guide, release-management guide, ADRs, glossary, and contribution standards.

### Engineering posture

CivicGuardAI is documented as a **production-oriented** system. Documentation intentionally does not claim full production sign-off until runtime integration tests, representative mobile evidence tests, durable storage architecture, backup/restore drills, and target-environment verification have been completed.

## Release format

Future releases should use:

```text
## [x.y.z] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Security
### Operational
### Breaking
```
