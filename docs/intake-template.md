# Intake Template

Use this shape when requesting a plan. Do not include secrets, tokens, private keys, cookies, or third-party personal data.

```text
Roles:
- user
- workspace owner
- support admin

Objects:
- workspace
- project
- file
- invoice
- API key

Routes or surfaces:
- /api/workspaces/:workspaceId/projects/:projectId
- /api/files/:fileId/download
- GraphQL mutations
- export pipeline

Authorization and safety:
- owned accounts only
- authentication: session cookie and workspace role checks
- owned objects only
- out of scope: DoS, spam, social engineering, destructive actions, persistence
- rate limits: normal manual testing only
- data sensitivity: sandbox or owned test data only

Review goal:
- Find the highest-signal access-control and workflow checks before manual validation.
```

## Rejection Diagnostics

SignalForge rejects intake before plan generation when the input is too ambiguous or unsafe.

Returned diagnostics include:

- `intake.status`: `accepted`, `rejected`, or `demo`.
- `intake.errors`: blocking problems that prevent plan generation.
- `intake.warnings`: non-blocking gaps that should be fixed for a better plan.

Current blocking errors:

- Secret-like material detected, such as private keys, provider tokens, or bearer authorization headers.
- Missing route, surface, interface, or workflow hints.
- Missing explicit authorization and out-of-scope rules.
- Missing concrete review goal or suspicious workflow.
- Missing roles or protected objects.
- Route or workflow is present, but authentication method, rate-limit guidance, and data sensitivity are all unspecified.
- Input is too ambiguous because it does not provide enough of the required shape.

Current warnings:

- Missing explicit authorization and out-of-scope rules.
- Missing route, API, UI, workflow, or interface hints.
- Missing concrete review goal or suspicious workflow.
- Missing authentication or authorization method details.
- Missing rate-limit or safe testing pace guidance.
- Missing data sensitivity classification, such as sandbox, public, owned, confidential, or customer data.

If intake is rejected, the markdown output starts with `# Intake Rejected`, includes the errors and warnings, and does not return an authorization matrix.

For downstream agents, `/api/analyze` returns `formatVersion`, `matrixSchema`, and a machine-readable `matrix[]` array with `priority`, `interface`, `object`, `action`, `role`, `state`, and `tenant` fields.
