# ADR 0006: In-process rate limiting

- **Status:** Accepted (revisit when scaling out)
- **Date:** recorded 2026-11; the decision predates this record

## Context

The API needs basic protection against brute force and abuse without adding infrastructure.

## Decision

Use an in-memory, per-IP fixed-window limiter: a global limit (`RATE_LIMIT_MAX`, default 300/min) and a stricter one on sign-in and code endpoints (`AUTH_RATE_LIMIT_MAX`, default 30/min), plus per-account lockout and per-target code limits stored in the database.

## Alternatives considered

- Redis-backed limiter: exact across instances; needs a Redis service on every host.
- Only an edge WAF: not available on all hosts.

## Consequences

With N API instances an IP can make up to N times the limit. Account lockout and code limits live in PostgreSQL and are exact regardless. Move to a shared store before running many instances.
