## Summary

<!-- What changed and why. Link the issue: "Closes #123". -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Security fix
- [ ] Refactor (no behaviour change)
- [ ] Documentation
- [ ] Infrastructure / CI

## How it was tested

<!-- Tests added or changed, and anything checked by hand (device, browser, deployment). -->

- [ ] `npm test` in `apps/api/` passes (needs `TEST_DATABASE_URL`)
- [ ] `npm run lint && npm run build` in `apps/admin/` pass
- [ ] End-to-end tests updated if a user journey changed (`e2e/`)

## Checklist

- [ ] No secrets, keystores or real personal data committed
- [ ] Authorization and input validation reviewed for new or changed endpoints
- [ ] API reference updated if the API contract changed (`docs/api/reference.md`)
- [ ] Data model updated if the schema changed (`docs/architecture/data-model.md`)
- [ ] Configuration reference updated if environment variables changed (`docs/reference/configuration.md`)
- [ ] `CHANGELOG.md` updated under **Unreleased**

## Deployment notes

<!-- New environment variables, schema changes, required app update, rollback concerns. Write "None" if there are none. -->
