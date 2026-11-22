# ADR 0009: Call SES, SNS and Google without SDKs

- **Status:** Accepted
- **Date:** 2026-11

## Context

Email codes, SMS codes and Google sign-in need three external APIs. The AWS SDK and Google auth libraries add many megabytes of dependencies to a small API.

## Decision

Call SES v2 and SNS over HTTPS with a small, tested Signature Version 4 implementation (`backend/src/services/aws.js`), reading credentials from the ECS task role or environment. Verify Google ID tokens with Node's `crypto` against Google's published keys. Every provider is optional and reported by `GET /api/auth/providers`; outside production a `log` provider prints codes instead of sending them.

## Alternatives considered

- AWS SDK v3 (`@aws-sdk/client-ses`, `client-sns`) and `google-auth-library`: well maintained, but larger and more to audit.
- A third-party OTP service: less code, but sends phone numbers to another processor.

## Consequences

Fewer dependencies and a smaller image. The SigV4 code is checked against AWS's published example signature in `test/unit/awsSigV4.test.js`, and Google verification against a fake identity provider with real RS256 keys. Adding a new AWS service needs only a new request, not a new package.
