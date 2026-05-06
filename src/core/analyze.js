const DEFAULT_ROLES = ["anonymous", "basic user", "privileged user", "admin", "service account"];

const ROLE_HINTS = [
  ["anonymous", /\b(anonymous|unauthenticated|guest|public)\b/i],
  ["basic user", /\b(user|member|customer|account)\b/i],
  ["privileged user", /\b(manager|owner|moderator|support|operator)\b/i],
  ["admin", /\b(admin|administrator|superuser|root)\b/i],
  ["service account", /\b(service account|api key|token|integration|bot)\b/i]
];

const OBJECT_HINTS = [
  "user",
  "organization",
  "workspace",
  "project",
  "team",
  "file",
  "document",
  "invoice",
  "payment",
  "subscription",
  "message",
  "comment",
  "report",
  "ticket",
  "api key",
  "secret",
  "webhook",
  "invite",
  "export",
  "job",
  "agent",
  "memory",
  "embedding"
];

const ACTION_HINTS = [
  ["read", /\b(read|view|get|fetch|download|preview|search|list)\b/i],
  ["create", /\b(create|add|upload|import|invite|send)\b/i],
  ["update", /\b(update|edit|patch|change|approve|transfer|assign)\b/i],
  ["delete", /\b(delete|remove|archive|disable|revoke)\b/i],
  ["export", /\b(export|download|csv|pdf|report)\b/i],
  ["execute", /\b(execute|run|trigger|replay|rotate|impersonate)\b/i]
];

const SURFACE_HINTS = [
  ["REST API", /\b(rest|api|endpoint|route|http|json)\b/i],
  ["GraphQL", /\b(graphql|mutation|query|resolver|schema)\b/i],
  ["file pipeline", /\b(file|upload|download|attachment|preview|import)\b/i],
  ["export pipeline", /\b(export|csv|pdf|report|backup)\b/i],
  ["invite/share flow", /\b(invite|share|link|token|collaborator)\b/i],
  ["admin surface", /\b(admin|support|impersonate|moderator|approve)\b/i],
  ["billing surface", /\b(billing|payment|invoice|subscription|refund|coupon)\b/i],
  ["webhook/job surface", /\b(webhook|callback|queue|job|replay|worker)\b/i],
  ["AI/agent surface", /\b(ai|llm|agent|tool|rag|embedding|memory|prompt|mcp)\b/i]
];

const ID_PATTERNS = [
  ["uuid", /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi],
  ["numeric id", /\b(?:id|user_id|org_id|workspace_id|project_id|file_id|invoice_id)\s*[:=]\s*["']?\d+/gi],
  ["opaque token", /\b(?:token|key|secret|code|invite|cursor)\s*[:=]\s*["']?[A-Za-z0-9_.\-]{12,}/gi]
];

const SECRET_PATTERNS = [
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ["provider token", /\b(?:gh[pousr]_|sk-[A-Za-z0-9]|xox[baprs]-|rnd_[A-Za-z0-9]+|col_[A-Za-z0-9_-]+|AKIA[0-9A-Z]{16})/i],
  ["authorization header", /\bauthorization\s*:\s*bearer\s+[A-Za-z0-9._-]{12,}/i]
];

function cleanText(value, maxLength = 60000) {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").slice(0, maxLength).trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function extractUrls(text) {
  return unique(text.match(/https?:\/\/[^\s"'<>),]+/gi) || []).slice(0, 25);
}

function extractPaths(text) {
  const paths = [];
  const regex = /(^|[\s"`'])(\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{2,})(?=[$\s"`'<>,)]?)/gm;
  for (const match of text.matchAll(regex)) {
    const path = match[2];
    if (!path.startsWith("//") && !path.includes("://")) paths.push(path);
  }
  return unique(paths).slice(0, 40);
}

function detectRoles(text) {
  const roles = ROLE_HINTS.filter(([, pattern]) => pattern.test(text)).map(([role]) => role);
  return roles.length ? unique(roles) : DEFAULT_ROLES;
}

function detectObjects(text) {
  const lower = text.toLowerCase();
  const objects = OBJECT_HINTS.filter((item) => lower.includes(item));
  return objects.length ? unique(objects).slice(0, 12) : ["user", "organization", "file", "invite", "export"];
}

function detectActions(text) {
  const actions = ACTION_HINTS.filter(([, pattern]) => pattern.test(text)).map(([action]) => action);
  return actions.length ? unique(actions) : ["read", "update", "export"];
}

function detectSurfaces(text) {
  const surfaces = SURFACE_HINTS.filter(([, pattern]) => pattern.test(text)).map(([surface]) => surface);
  return surfaces.length ? unique(surfaces) : ["REST API", "invite/share flow", "export pipeline"];
}

function detectIdentifiers(text) {
  return ID_PATTERNS.map(([type, pattern]) => ({ type, count: countMatches(text, pattern) }))
    .filter((item) => item.count > 0);
}

function evaluateIntake(text, hasUserInput) {
  if (!hasUserInput) {
    return {
      accepted: true,
      status: "demo",
      score: 4,
      errors: [],
      warnings: ["Demo plan generated from default scope. Add concrete roles, objects, routes, and safety rules before relying on it."]
    };
  }

  const errors = [];
  const warnings = [];
  const lower = text.toLowerCase();
  const hasRoleSection = /\broles?\s*:/i.test(text) || ROLE_HINTS.some(([, pattern]) => pattern.test(text));
  const hasObjectSection = /\bobjects?\s*:/i.test(text) || OBJECT_HINTS.some((item) => lower.includes(item));
  const hasRouteSection = /\broutes?\s*:/i.test(text) || extractUrls(text).length > 0 || extractPaths(text).length > 0;
  const hasSafetyBoundary = /\b(out of scope|safe[- ]?harbor|authorized|authorization|owned accounts?|owned objects?|rate limits?)\b/i.test(text);
  const hasReviewGoal = /\b(goal|check|review|audit|triage|test|verify|validate|suspicious flows?)\b/i.test(text);
  const secretHit = SECRET_PATTERNS.find(([, pattern]) => pattern.test(text));

  if (secretHit) {
    errors.push(`Secret-like material detected (${secretHit[0]}). Remove credentials before analysis.`);
  }

  const score = [hasRoleSection, hasObjectSection, hasRouteSection, hasSafetyBoundary, hasReviewGoal]
    .filter(Boolean).length;

  if (score < 3) {
    errors.push("Input is too ambiguous. Provide at least roles, objects, routes or surfaces, and authorization/safety rules.");
  }

  if (!hasSafetyBoundary) warnings.push("Add explicit authorization and out-of-scope rules.");
  if (!hasRouteSection) warnings.push("Add route, API, UI, workflow, or interface hints.");
  if (!hasReviewGoal) warnings.push("Add a concrete review goal or suspicious workflow.");

  return {
    accepted: errors.length === 0,
    status: errors.length === 0 ? "accepted" : "rejected",
    score,
    errors,
    warnings
  };
}

function buildRejectedPlan(intake) {
  const queue = [
    {
      title: "Fix intake before generating a review plan.",
      bugClass: "intake validation",
      boundary: "scope quality x safety constraints",
      method: "Provide roles, objects, routes or surfaces, authorization rules, and a concrete review goal. Remove secrets."
    }
  ];

  const reportMarkdown = [
    "# Intake Rejected",
    "",
    "SignalForge did not generate a security review plan because the submitted scope was unsafe or too ambiguous.",
    "",
    "## Errors",
    "",
    ...intake.errors.map((error) => `- ${error}`),
    "",
    "## Required Shape",
    "",
    "- Roles: user types and privilege boundaries.",
    "- Objects: records or resources being protected.",
    "- Routes or surfaces: API paths, UI flows, GraphQL, files, exports, tools, jobs, or agents.",
    "- Authorization and safety rules: owned accounts, out-of-scope actions, rate limits, safe-harbor notes.",
    "- Review goal: the boundary or workflow you want pressure-tested."
  ].join("\n");

  return { queue, reportMarkdown };
}

function priorityFor(surface, action, object) {
  let score = 1;
  if (["admin surface", "billing surface", "AI/agent surface"].includes(surface)) score += 2;
  if (["export", "execute", "update", "delete"].includes(action)) score += 1;
  if (["api key", "secret", "invoice", "payment", "webhook", "agent", "memory"].includes(object)) score += 1;
  return Math.min(score, 5);
}

function buildMatrix(roles, objects, actions, surfaces) {
  const selectedObjects = objects.slice(0, 8);
  const selectedActions = actions.slice(0, 6);
  const selectedSurfaces = surfaces.slice(0, 6);
  const rows = [];

  for (const surface of selectedSurfaces) {
    for (const object of selectedObjects) {
      for (const action of selectedActions) {
        rows.push({
          role: roles.includes("admin") ? "non-admin user vs admin" : "user A vs user B",
          object,
          action,
          state: action === "delete" ? "active vs archived/soft-deleted" : "normal vs shared/transferred",
          tenant: "same tenant vs foreign tenant",
          interface: surface,
          priority: priorityFor(surface, action, object)
        });
      }
    }
  }

  return rows.sort((a, b) => b.priority - a.priority).slice(0, 24);
}

function buildQueue(model, paths, urls) {
  const queue = [
    {
      title: "Prove object ownership checks independently for read, update, export, and delete.",
      bugClass: "BOLA",
      boundary: "actor identity x object owner x action",
      method: "Create object as account A, replay the smallest request as account B, compare status, body, and side effects."
    },
    {
      title: "Mutate hidden ownership, role, status, billing, and callback fields.",
      bugClass: "BOPLA",
      boundary: "client-provided properties x server-authoritative properties",
      method: "Replay valid create/update requests with one extra sensitive field at a time. Prefer PATCH and bulk variants."
    },
    {
      title: "Probe role-only helpers that are not visibly admin routes.",
      bugClass: "BFLA",
      boundary: "normal role x privileged action",
      method: "Test export, resend, approve, replay, rotate, impersonate, unlock, refund, and disable endpoints separately."
    },
    {
      title: "Compare web, API, background, and mobile-like interfaces for the same action.",
      bugClass: "interface drift",
      boundary: "same operation x alternate interface",
      method: "Find where the UI blocks an action, then test the underlying endpoint and adjacent method variants directly."
    }
  ];

  if (model.surfaces.includes("AI/agent surface")) {
    queue.unshift({
      title: "Check whether untrusted retrieved content can steer tool use or leak scoped data.",
      bugClass: "LLM/agent control failure",
      boundary: "untrusted content x tool authority x tenant data",
      method: "Use owned files/prompts only. Confirm whether tool calls require scoped identity and human approval for high-impact actions."
    });
  }

  if (paths.length || urls.length) {
    queue.push({
      title: "Cluster discovered routes by parent object and retest nested identifiers.",
      bugClass: "nested BOLA",
      boundary: "parent authorization x child object reference",
      method: "Swap child IDs while keeping the parent ID stable, then swap parent IDs while keeping the child ID stable."
    });
  }

  return queue;
}

function buildReportSkeleton(model, queue) {
  const top = queue[0];
  return [
    "# Report Draft",
    "",
    `## Title`,
    `[${top.bugClass}] in [feature] allows [impact]`,
    "",
    "## Asset",
    "TBD",
    "",
    "## Broken Boundary",
    top.boundary,
    "",
    "## Preconditions",
    `- Roles considered: ${model.roles.join(", ")}`,
    `- Objects considered: ${model.objects.slice(0, 8).join(", ")}`,
    "",
    "## Minimal Reproduction",
    "1. Create owned object as allowed identity.",
    "2. Replay the same request from disallowed identity with only the authorization context changed.",
    "3. Record the smallest response or state diff that proves the missing check.",
    "",
    "## Expected Result",
    "The disallowed identity cannot read, change, export, or trigger the protected object/action.",
    "",
    "## Observed Result",
    "TBD",
    "",
    "## Impact",
    "TBD in one plain-English sentence tied to attacker value.",
    "",
    "## Safety Notes",
    "Used only owned accounts and owned objects. Stopped before third-party data access or destructive state changes."
  ].join("\n");
}

function buildPlanMarkdown(model, matrix, queue, routes) {
  const lines = [
    "# SignalForge Review Plan",
    "",
    "## Control Model",
    "",
    `- Roles: ${model.roles.join(", ")}`,
    `- Objects: ${model.objects.slice(0, 12).join(", ")}`,
    `- Actions: ${model.actions.join(", ")}`,
    `- Surfaces: ${model.surfaces.join(", ")}`,
    "",
    "## Priority Queue",
    ""
  ];

  queue.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(`   - Bug class: ${item.bugClass}`);
    lines.push(`   - Boundary: ${item.boundary}`);
    lines.push(`   - Method: ${item.method}`);
  });

  lines.push("", "## Authorization Matrix", "");
  lines.push("| Priority | Interface | Object | Action | Role Boundary | State | Tenant |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");

  matrix.forEach((row) => {
    lines.push(`| P${row.priority} | ${row.interface} | ${row.object} | ${row.action} | ${row.role} | ${row.state} | ${row.tenant} |`);
  });

  if (routes.length) {
    lines.push("", "## Route Hints", "");
    routes.slice(0, 20).forEach((route) => lines.push(`- ${route}`));
  }

  lines.push(
    "",
    "## Safety Boundary",
    "",
    "- Use owned accounts and owned objects only.",
    "- Stop before third-party data access, destructive actions, spam, persistence, or denial-of-service.",
    "- A finding is reportable only after the broken security boundary is stated in one sentence and proven with the smallest safe diff."
  );

  return lines.join("\n");
}

export function analyzeScope(input = {}) {
  const scopeText = cleanText(input.scopeText);
  const notes = cleanText(input.notes, 20000);
  const text = `${scopeText}\n${notes}`.trim();
  const hasUserInput = text.length > 0;
  const source = text || "generic multi-tenant web application with anonymous, basic user, privileged user, admin, service account, API, users, files, invites, exports, and admin workflows";
  const intake = evaluateIntake(source, hasUserInput);

  const urls = extractUrls(source);
  const paths = extractPaths(source);
  const roles = detectRoles(source);
  const objects = detectObjects(source);
  const actions = detectActions(source);
  const surfaces = detectSurfaces(source);
  const identifiers = detectIdentifiers(source);

  const model = {
    roles,
    objects,
    actions,
    surfaces,
    identifiers,
    routes: unique([...urls, ...paths]).slice(0, 50)
  };

  if (!intake.accepted) {
    const rejected = buildRejectedPlan(intake);
    return {
      generatedAt: new Date().toISOString(),
      inputStats: {
        characters: source.length,
        urls: urls.length,
        paths: paths.length,
        identifierKinds: identifiers.length
      },
      intake,
      model,
      matrix: [],
      queue: rejected.queue,
      reportSkeleton: rejected.reportMarkdown,
      reportMarkdown: rejected.reportMarkdown
    };
  }

  const matrix = buildMatrix(roles, objects, actions, surfaces);
  const queue = buildQueue(model, paths, urls);
  const reportSkeleton = buildReportSkeleton(model, queue);
  const reportMarkdown = buildPlanMarkdown(model, matrix, queue, model.routes);

  return {
    generatedAt: new Date().toISOString(),
    inputStats: {
      characters: source.length,
      urls: urls.length,
      paths: paths.length,
      identifierKinds: identifiers.length
    },
    intake,
    model,
    matrix,
    queue,
    reportSkeleton,
    reportMarkdown
  };
}
