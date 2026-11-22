# ADR 0004: Validate photo evidence on the server

- **Status:** Accepted
- **Date:** recorded 2026-11; the decision predates this record

## Context

Citizens can modify or replace the app, so checks done only on the phone can be bypassed.

## Decision

All evidence checks (metadata present, capture date at most 24 h old, photo GPS within 200 m of the reported location) run in the API before anything is stored. Only dates embedded in the image are trusted. Cases that cannot be decided are saved but flagged `needs_review` rather than rejected. See [Evidence validation](../evidence-validation.md).

## Alternatives considered

- Client-side checks only: cheaper, trivially bypassed.
- Reject all uncertain cases: fewer bad reports, but rejects genuine photos from phones that omit timezones.

## Consequences

Upload requests are slower (ExifTool and hashing) and the rules need careful tests. Staff review remains part of the process.
