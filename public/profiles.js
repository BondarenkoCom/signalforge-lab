export const profiles = {
  api: {
    scopeText: [
      "Program allows testing owned accounts only.",
      "Out of scope: DoS, spam, social engineering, destructive actions, persistence.",
      "Rate limits: normal manual testing only.",
      "Data sensitivity: owned test data only.",
      "Authentication: session cookie and workspace role checks.",
      "Roles: anonymous, user, workspace owner, support admin.",
      "Objects: user, workspace, project, file, invoice, invite, webhook, api key.",
      "Routes: /api/workspaces/:workspaceId/projects/:projectId, /api/files/:fileId/download, /api/invoices/:invoiceId/export, /api/admin/users/:userId/impersonate, /graphql."
    ].join("\n"),
    notes: "Suspicious flows: export generation, invite resend, webhook replay, PATCH workspace settings, bulk update arrays, archived objects."
  },
  agent: {
    scopeText: [
      "Program allows testing owned prompts, owned files, and owned connected tools only.",
      "Out of scope: DoS, spam, social engineering, destructive actions, persistence, third-party data access.",
      "Rate limits: normal manual testing only.",
      "Data sensitivity: owned test data and owned files only.",
      "Authentication: session cookie, workspace role checks, and scoped tool identity.",
      "Authorization: owned objects only and scoped workspace tools only.",
      "Roles: user, workspace owner, service account, admin.",
      "Objects: agent, memory, embedding, document, message, webhook, api key, tool.",
      "Routes: /api/agents/:agentId/messages, /api/tools/:toolId/run, /api/files/:fileId/preview, /api/memory/search."
    ].join("\n"),
    notes: "Suspicious flows: retrieved content steering tools, cross-user memory, tool identity scope, file preview output handling, replayed tool calls."
  },
  billing: {
    scopeText: [
      "Program allows testing owned customer accounts and sandbox billing objects only.",
      "Out of scope: DoS, spam, social engineering, destructive actions, real payment attempts, third-party data access.",
      "Rate limits: normal manual testing only.",
      "Data sensitivity: sandbox and owned test billing data only.",
      "Authentication: session cookie, team role checks, and billing admin permissions.",
      "Authorization: owned accounts and sandbox billing objects only.",
      "Roles: user, team owner, billing admin, support admin.",
      "Objects: invoice, subscription, payment, coupon, export, report, organization.",
      "Routes: /api/billing/invoices/:invoiceId, /api/billing/export, /api/subscriptions/:subscriptionId, /api/refunds/:paymentId."
    ].join("\n"),
    notes: "Suspicious flows: invoice export, coupon mutation, plan downgrade/upgrade state, refund helpers, support-only actions, stale download URLs."
  }
};
