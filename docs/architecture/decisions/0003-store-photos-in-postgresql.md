# ADR 0003: Store photo bytes in PostgreSQL

- **Status:** Accepted
- **Date:** 2026-11

## Context

Photos were first written to the API's local `uploads/` folder. Containers on Render's free tier and on ECS Fargate have ephemeral disks, so photos disappeared on every restart or redeploy, and two API instances could not see each other's files.

## Decision

Store each uploaded photo in a `photos` table (`bytea`) and serve `/uploads/:name` from it, with the local folder as a cache and a fallback for files from older versions.

## Alternatives considered

- S3 or another object store with signed or CDN URLs: the long-term scalable option, but adds a second storage system, credentials and lifecycle management on every host, including the free trial.
- A persistent disk volume: not available on the free tiers, and does not work with more than one instance.

## Consequences

Photos survive restarts and are included in database backups and point-in-time restore. API containers are stateless. The database grows by roughly 2–5 MB per report; past a few tens of GB, move photos to S3 + CloudFront and keep the same `/uploads/:name` URLs as redirects.
