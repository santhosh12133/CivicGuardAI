# ADR 0007: Deploy to AWS with ECS Express Mode, deployed by GitHub Actions through OIDC

- **Status:** Accepted
- **Date:** 2026-11

## Context

Free hosting deletes the database after weeks. The owner has an AWS account but should not hand out long-lived access keys.

## Decision

Two CloudFormation stacks (`civicfix-base`: RDS, Secrets Manager, ECR, S3 + CloudFront, IAM roles; `civicfix-api`: an ECS Express Mode service) deployed by `.github/workflows/deploy-aws.yml`. GitHub Actions assumes an IAM role through OpenID Connect, restricted to this repository's `main` branch. Secrets are generated inside AWS.

## Alternatives considered

- Elastic Beanstalk or App Runner: simpler for some cases, but each needs more configuration for HTTPS, Docker and secrets than ECS Express Mode.
- EC2 with Docker Compose: cheapest, but manual patching, TLS and backups.
- Terraform: popular, but needs state storage; CloudFormation needs nothing beyond the AWS account.

## Consequences

No AWS keys exist outside AWS. ECS Express Mode provides HTTPS, load balancing and scaling without managing a load balancer. The deploy role has broad permissions within the account (PowerUser plus scoped IAM), so the `main` branch must be protected.
