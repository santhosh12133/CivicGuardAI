# Architecture decision records

Significant technical decisions are recorded here, one file per decision, so future maintainers know not just *what* was chosen but *why*. The format follows Michael Nygard's [ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-with-three-apps.md) | Keep the API, admin portal and Android app in one repository | Accepted |
| [0002](0002-postgresql-and-sequelize.md) | PostgreSQL as the single source of truth, accessed through Sequelize | Accepted |
| [0003](0003-store-photos-in-postgresql.md) | Store photo bytes in PostgreSQL | Accepted |
| [0004](0004-server-side-evidence-validation.md) | Validate photo evidence on the server | Accepted |
| [0005](0005-perceptual-hash-as-review-signal.md) | Perceptual hash similarity flags reports for review | Accepted |
| [0006](0006-in-process-rate-limiting.md) | In-process rate limiting | Accepted (revisit when scaling out) |
| [0007](0007-aws-ecs-express-and-github-oidc.md) | Deploy to AWS with ECS Express Mode, deployed by GitHub Actions through OIDC | Accepted |
| [0008](0008-sessions-with-rotating-refresh-tokens.md) | Short-lived access tokens with server-side sessions and rotating refresh tokens | Accepted |
| [0009](0009-provider-calls-without-sdks.md) | Call SES, SNS and Google without SDKs | Accepted |

## Adding a decision

1. Copy [`template.md`](template.md) to `NNNN-short-title.md` with the next number.
2. Fill it in and open a pull request; discuss it there.
3. Once merged, the decision is **Accepted**. Never rewrite an accepted ADR: if a decision changes, add a new one and mark the old one **Superseded by ADR NNNN**.

Write an ADR when a choice is hard to reverse, affects security or data, adds a service or dependency, or when reviewers keep asking "why did we do it this way?".
