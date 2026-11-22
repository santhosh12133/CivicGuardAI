# Security overview

The security controls CivicFix implements, where they live in the code, and what operators must do. Risks and gaps are analysed in the [threat model](threat-model.md); personal data in [Privacy](privacy.md). To report a vulnerability, see [SECURITY.md](../../SECURITY.md).

## Controls

### Identity and sessions

| Control | Implementation |
|---|---|
| Password storage | bcrypt, cost 10; minimum 8 characters (12 for staff passwords set by script) |
| Account enumeration | Same `401` message for unknown email and wrong password; "forgot password" always answers the same |
| Brute force | Lockout after 5 wrong passwords (15 min); `AUTH_RATE_LIMIT_MAX` per IP on sign-in, refresh, code and reset routes; one-time codes allow 5 tries, 60 s cooldown, 5 per hour |
| Token design | 15-minute HS256 access tokens bound to a server-side session; `alg=none` and other algorithms rejected |
| Revocation | Every request checks the session; sign-out, password change/reset and admin reset revoke sessions immediately |
| Refresh token theft | Tokens rotate on every use and are stored only as SHA-256 hashes; reuse of an old token revokes all the user's sessions |
| One-time codes | Random (`crypto.randomInt`), hashed at rest, single use, short expiry |
| Google sign-in | Server-side code flow; signed `state` with nonce; ID token signature (JWKS), issuer, audience, expiry, nonce and `email_verified` checked; client only receives a 2-minute hand-over code |

Details: [Authentication](../architecture/authentication.md).

### Authorization

| Role | Allowed |
|---|---|
| Anonymous | Read issues (without reporter details), categories, health |
| Citizen | Report issues; see own reports and their timeline author names |
| Staff | Everything a citizen can, plus view reporters, update issues, view statistics |
| Admin | Everything staff can, plus delete issues and manage accounts |

- Roles are enforced in route definitions (`authorizeRoles('staff', 'admin')`) and read from the database on each request, never trusted from the token alone.
- Public sign-up cannot create staff or admin accounts; an admin cannot change their own role.
- The admin portal refuses citizen accounts (and ends their session), but the API is the real boundary.
- Responses are shaped per viewer (`serializeIssue`): reporter identity is only returned to staff and admins.

### Input handling

| Control | Implementation |
|---|---|
| Validation | `express-validator` on every route (UUIDs, coordinates, status, category, lengths); unknown statuses rejected |
| Body size | 1 MB JSON/form |
| Uploads | One file, ≤ 10 MB, JPEG/PNG/GIF/WebP by MIME type; server-generated random file names; served from a strict name pattern only; rejected uploads deleted |
| EXIF parsing | ExifTool in a separate process with a 5 s timeout |
| SQL | Sequelize parameterised queries; the one raw `ALTER TABLE` uses fixed identifiers |
| Evidence | Server-side checks; clients are untrusted ([Evidence validation](../architecture/evidence-validation.md)) |

### Transport and browser

- HTTPS everywhere in production (ECS Express Mode endpoint, CloudFront; Render and Vercel terminate TLS). HSTS one year.
- Database TLS verified against the RDS CA bundle on AWS.
- CORS allow-list (`CORS_ORIGINS`); credentials are bearer tokens, not cookies, so CSRF does not apply.
- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, no `X-Powered-By`.
- Errors: 5xx details hidden in production.

### Secrets and infrastructure

- No secrets in the repository; `.gitignore` covers `.env`, keystores and certificates.
- AWS: database password and JWT secret generated in Secrets Manager and injected into the container; the deploy logs never contain them.
- GitHub → AWS via OIDC; the deploy role trusts only `main` of this repository. No long-lived AWS keys exist.
- The API task role may only send email (`ses:SendEmail`) and SMS (`sns:Publish`).
- RDS: not publicly accessible (no public IP, in the default VPC), encrypted storage, deletion protection, automated backups; its security group accepts PostgreSQL connections only from inside the VPC.
- Container runs as the image's non-root `node` user.

## Operator responsibilities

- [ ] Protect the `main` branch (required reviews and checks) — anything merged there can deploy ([CI/CD](../reference/ci-cd.md#recommended-branch-protection-for-main)).
- [ ] Keep the Android signing keystore and its password backed up and private.
- [ ] Give admin rights only to people who need them; review accounts quarterly (`GET /api/auth/users?role=staff,admin`).
- [ ] Merge Dependabot updates; act on GitHub security alerts.
- [ ] Restrict the Google Maps key to the app's package and certificate.
- [ ] Set an AWS budget alert, and SNS monthly spend limits (SMS can be abused for cost).
- [ ] Rotate `JWT_SECRET` and the database password if they may have leaked ([Incident response](../operations/incident-response.md#leaked-secret)).

## Security testing

Automated: authentication and authorization tests for every role, forged/expired/`alg=none` tokens, refresh reuse, lockout, code limits, Google token tampering (audience, issuer, nonce, signature, expiry), CORS allow/deny, body and upload limits, evidence bypass attempts (stripped or future dates). See [Testing](../testing/strategy.md).

Not yet automated: dependency vulnerability scanning beyond Dependabot alerts, dynamic scanning (e.g. OWASP ZAP) against a staging deployment, and penetration testing.
