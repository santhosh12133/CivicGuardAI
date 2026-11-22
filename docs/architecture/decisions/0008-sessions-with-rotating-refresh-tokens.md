# ADR 0008: Short-lived access tokens with server-side sessions and rotating refresh tokens

- **Status:** Accepted
- **Date:** 2026-11

## Context

Long-lived JWTs could not be revoked: signing out or changing a password left old tokens working until they expired.

## Decision

Access tokens are JWTs valid for 15 minutes carrying a session id; every request checks that session is still active. Refresh tokens are random, stored only as SHA-256 hashes, rotate on every use, and reuse of an old one revokes all of the user's sessions. See [Authentication](../authentication.md).

## Alternatives considered

- Long-lived JWT only: simple, no revocation.
- Opaque session tokens only: one database lookup per request (which the chosen design also does), but no stateless expiry.
- Managed identity (Amazon Cognito, Auth0): offloads auth, but adds a dependency, cost and migration of existing accounts.

## Consequences

Sign-out, password changes and admin resets take effect immediately. Each authenticated request costs one extra indexed lookup. Clients must handle `TOKEN_EXPIRED` by refreshing.
