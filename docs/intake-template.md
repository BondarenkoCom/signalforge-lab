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
