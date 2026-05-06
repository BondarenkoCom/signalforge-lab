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
- owned objects only
- out of scope: DoS, spam, social engineering, destructive actions, persistence
- rate limits: normal manual testing only

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
- Input is too ambiguous because it does not provide enough of the required shape.

Current warnings:

- Missing explicit authorization and out-of-scope rules.
- Missing route, API, UI, workflow, or interface hints.
- Missing concrete review goal or suspicious workflow.

If intake is rejected, the markdown output starts with `# Intake Rejected`, includes the errors and warnings, and does not return an authorization matrix.
