# Release process

How changes reach production, how versions are numbered, and how a release is recorded.

## Branching

- `main` is always deployable; on AWS every merge to `main` deploys the API and admin portal.
- Work happens on short-lived branches (`feat/…`, `fix/…`, `docs/…`, `chore/…`) merged through pull requests after CI and the end-to-end suites pass.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat(auth): …`, `fix(mobile): …`, `docs: …`. The type and scope make the changelog easy to write.

## Versions

CivicFix uses [Semantic Versioning](https://semver.org) for the product as a whole, recorded in [`CHANGELOG.md`](../../CHANGELOG.md):

| Change | Bump | Example |
|---|---|---|
| Breaking: older apps or integrations stop working, or operators must act before upgrading | Major | `2.0.0` |
| New features, backwards compatible | Minor | `1.2.0` |
| Fixes only | Patch | `1.1.1` |

| Part | Where the version lives |
|---|---|
| Android app | `expo.version` in `apps/mobile/app.json` (shown in the release name); build number = workflow run number |
| API | `version` in `apps/api/package.json` |
| Admin portal | Deployed with the API from the same commit |

Because installed APKs can be old, the API must stay compatible with the last released app version ([API compatibility rules](../api/reference.md#9-api-compatibility-rules)).

## Releasing

1. **Prepare** — on a branch:
   - Move the *Unreleased* entries in `CHANGELOG.md` under a new heading `## [x.y.z] - YYYY-MM-DD`.
   - Bump `apps/api/package.json` and, if the app changed, `apps/mobile/app.json`.
   - Open a pull request titled `chore(release): x.y.z`.
2. **Merge** — CI and end-to-end tests must pass. On AWS the merge deploys the API and portal; watch the *Deploy to AWS* run.
3. **Verify** — run the [launch checklist](README.md#launch-checklist) against production.
4. **App** (if `apps/mobile/` changed) — Actions → *Deploy to AWS* → Run workflow with *build APK* ticked (or *Android APK* with the API URL). Check the new release under **Releases** installs over the previous version.
5. **Tag** — create a GitHub release `vX.Y.Z` on the merge commit (Releases → Draft a new release), pasting the changelog section. Android builds have their own `mobile-v…` tags created by the workflow.
6. **Announce** — tell staff what changed; tell citizens if they should update the app.

## Hotfixes

For a SEV1/SEV2 bug: branch from `main`, fix with a test, open a pull request marked `fix:`, merge as soon as checks pass, then follow steps 3–6 with a patch version. If the fix will take long, revert the offending change first ([Rolling back](README.md#rolling-back)).

## Database changes in a release

Schema changes are additive and applied when the new API starts ([Data model](../architecture/data-model.md#schema-changes)). If a release needs a data migration or manual step, write it in the pull request's *Deployment notes* and in the changelog under **Operational**, and run it right after the deploy.
