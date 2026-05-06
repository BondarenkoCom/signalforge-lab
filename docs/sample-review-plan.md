# Sample Review Plan

This sample uses synthetic scope notes. It is not a report and does not claim a vulnerability.

## Input Shape

- Roles: anonymous, user, workspace owner, support admin
- Objects: workspace, project, file, invoice, invite, webhook, API key
- Surfaces: REST API, GraphQL, export pipeline, admin helper routes
- Safety: owned accounts and owned objects only

## High-Signal Queue

1. Prove object ownership checks independently for read, update, export, and delete.
2. Mutate hidden ownership, role, status, billing, and callback fields.
3. Probe role-only helpers that are not visibly admin routes.
4. Compare web, API, background, and mobile-like interfaces for the same action.
5. Retest nested identifiers where parent and child objects are selected independently.

## Authorization Matrix Excerpt

| Priority | Interface | Object | Action | Role Boundary |
| --- | --- | --- | --- | --- |
| P5 | admin surface | API key | execute | non-admin user vs admin |
| P4 | export pipeline | invoice | export | user A vs user B |
| P4 | webhook/job surface | webhook | update | owner vs support-only action |
| P3 | REST API | file | read | same tenant vs foreign tenant |
| P3 | GraphQL | project | update | parent object vs child object |

## Strong Boundary Statement

The issue becomes reportable only if a disallowed identity can read, change, export, or trigger an object/action that should be restricted by owner, role, tenant, or workflow state.

## Safe Validation Notes

- Create all test objects with owned accounts.
- Compare one allowed request and one disallowed request.
- Stop before accessing third-party data or making destructive state changes.
- Keep the smallest request/response diff that proves the failed boundary.
