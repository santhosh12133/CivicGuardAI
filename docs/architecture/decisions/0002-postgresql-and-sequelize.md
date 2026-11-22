# ADR 0002: PostgreSQL as the single source of truth, accessed through Sequelize

- **Status:** Accepted
- **Date:** recorded 2026-11; the decision predates this record

## Context

Users, issues, timelines and review flags are relational and need integrity (foreign keys, unique emails/phones) and filtering by status, category and reporter.

## Decision

Use PostgreSQL for all state, accessed through the Sequelize ORM. Schema changes are additive and applied at start-up by `syncSchema` (see [Data model](../data-model.md#schema-changes)).

## Alternatives considered

- MongoDB or another document store: flexible, but relations (reporter, timeline, sessions) and uniqueness would move into code.
- A migration framework (Sequelize CLI, Umzug): more control over destructive changes; worth adopting when the first non-additive change is needed.

## Consequences

Managed PostgreSQL is available on every target host (RDS, Render, Neon). The additive-only schema rule keeps rollbacks safe but means renames and removals need manual, staged migrations.
