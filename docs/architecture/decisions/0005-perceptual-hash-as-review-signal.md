# ADR 0005: Perceptual hash similarity flags reports for review

- **Status:** Accepted
- **Date:** recorded 2026-11; the decision predates this record

## Context

The same photo is sometimes reported twice, deliberately or by accident. Perceptual hashes detect visually similar images but produce false positives (similar streets, same pothole from the same spot).

## Decision

Compute a 64-bit pHash for every photo. A photo at least 90 % similar to an existing one sets `needs_review`; it never rejects the report.

## Alternatives considered

- Exact file hash: misses resized or recompressed copies.
- Automatic rejection: blocks genuine repeat reports of a still-unfixed problem.

## Consequences

Staff decide whether a flagged report is a duplicate. The comparison is linear in the number of issues.
