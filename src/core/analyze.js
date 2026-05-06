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
  ["provider token", /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{12,}|sk_(?:live|test)_[A-Za-z0-9]{12,}|xox[baprs]-[A-Za-z0-9-]{20,}|rnd_[A-Za-z0-9]+|col_[A-Za-z0-9_-]+|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+|gl(?:pat|oauth|proj|rt|cbt|agent|soat)-[0-9A-Za-z_-]{10,}|npm_[0-9A-Za-z_-]{20,}|pypi-[0-9A-Za-z_-]{20,}|SG\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+|AC[a-f0-9]{32}|SK[a-f0-9]{32})\b/i],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/i],
  ["authorization header", /\bauthorization\s*:\s*bearer\s+[A-Za-z0-9._-]{12,}/i]
];

const MATRIX_SCHEMA = {
  type: "array",
  itemFields: ["priority", "interface", "object", "action", "role", "state", "tenant"],
  priority: "P1-P5, higher means test earlier",
  boundaryColumns: ["role", "state", "tenant"]
};

const TOKEN_CONTEXT_PATTERN = /\b(token|secret|credential|password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|authorization|bearer)\b/i;

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

function shannonEntropy(value) {
  if (!value) return 0;
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  return [...counts.values()].reduce((sum, count) => {
    const probability = count / value.length;
    return sum - probability * Math.log2(probability);
  }, 0);
}

function findHighEntropyToken(text) {
  const candidatePattern = /\b[A-Za-z0-9][A-Za-z0-9._-]{23,}\b/g;
  for (const match of text.matchAll(candidatePattern)) {
    const token = match[0];
    const context = text.slice(Math.max(0, match.index - 48), match.index + token.length + 16);
    const hasTokenContext = TOKEN_CONTEXT_PATTERN.test(context);
    const hasMixedShape = /[A-Z]/.test(token) && /[a-z]/.test(token) && /[0-9]/.test(token);
    const hasTokenSeparator = /[._-]/.test(token);

    if (hasTokenContext && hasMixedShape && (hasTokenSeparator || token.length >= 32) && shannonEntropy(token) >= 3.7) {
      return token.slice(0, 6);
    }
  }
  return null;
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

function extractLabeledSegment(text, labelPattern) {
  const sectionPattern = "\\b(?:roles?|objects?|routes?|surfaces?|interfaces?|workflows?|authorization|safety|review goal|goal|notes?)\\s*:";
  const pattern = new RegExp(`\\b(?:${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=${sectionPattern}|$)`, "i");
  return pattern.exec(text)?.[1] || "";
}

function detectObjects(text) {
  const lower = text.toLowerCase();
  const explicitObjects = extractLabeledSegment(text, "objects?");
  if (explicitObjects) {
    const explicitLower = explicitObjects.toLowerCase();
    const objects = OBJECT_HINTS.map((item) => ({ item, index: explicitLower.indexOf(item) }))
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index)
      .map(({ item }) => item);
    if (objects.length) return unique(objects).slice(0, 12);
  }

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
  const hasRouteSection = /\b(routes?|surfaces?|interfaces?|workflows?)\s*:/i.test(text) || extractUrls(text).length > 0 || extractPaths(text).length > 0;
  const hasAuthorizationBoundary = /\b(safe[- ]?harbor|authorized|authorization|owned accounts?|owned objects?|permission|access control)\b/i.test(text);
  const hasSafetyLimit = /\b(out of scope|rate limits?|throttle|manual testing|no brute force|dos|spam|social engineering|destructive|persistence)\b/i.test(text);
  const hasSafetyBoundary = hasAuthorizationBoundary && hasSafetyLimit;
  const hasTenantBoundaryDetail = /\b(tenant|org|organization|workspace|team|account|owned accounts?|owned objects?|same tenant|foreign tenant|cross-tenant)\b/i.test(text);
  const hasReviewGoal = /\b(goal|check|review|audit|triage|test|verify|validate|suspicious flows?)\b/i.test(text);
  const hasAuthDetail = /\b(authentication|auth method|session|cookie|oauth|sso|saml|jwt|bearer|api key|authorization|owned accounts?|owned objects?)\b/i.test(text);
  const hasRateLimitDetail = /\b(rate limits?|throttle|request limit|safe pace|manual testing|no brute force|no automation|normal manual)\b/i.test(text);
  const hasDataSensitivity = /\b(data sensitivity|sensitive data|personal data|pii|confidential|public data|sandbox|test data|owned data|third-party data|customer data)\b/i.test(text);
  const secretHit = SECRET_PATTERNS.find(([, pattern]) => pattern.test(text));
  const highEntropyToken = findHighEntropyToken(text);

  if (secretHit) {
    errors.push(`Secret-like material detected (${secretHit[0]}). Remove credentials before analysis.`);
  }

  if (highEntropyToken) {
    errors.push(`Secret-like material detected (high-entropy token near "${highEntropyToken}..."). Remove credentials before analysis.`);
  }

  const score = [hasRoleSection, hasObjectSection, hasRouteSection, hasSafetyBoundary, hasReviewGoal]
    .filter(Boolean).length;

  if (!hasRouteSection) {
    errors.push("Missing route, surface, interface, or workflow hints.");
  }

  if (!hasSafetyBoundary) {
    errors.push("Missing explicit authorization and out-of-scope rules.");
  }

  if (!hasReviewGoal) {
    errors.push("Missing concrete review goal or suspicious workflow.");
  }

  if (!hasRoleSection) {
    errors.push("Missing role boundary details.");
  }

  if (!hasObjectSection) {
    errors.push("Missing protected objects.");
  }

  if (hasRouteSection && !hasTenantBoundaryDetail) {
    errors.push("Missing tenant or ownership boundary details for the route/workflow.");
  }

  if (score < 4) {
    errors.push("Input is too ambiguous. Provide roles or objects, routes or surfaces, authorization/safety rules, and a review goal.");
  }

  if (hasRouteSection && !hasAuthDetail && !hasRateLimitDetail && !hasDataSensitivity) {
    errors.push("Route or workflow is present, but authentication method, rate-limit guidance, and data sensitivity are all unspecified.");
  }

  if (!hasSafetyBoundary) warnings.push("Add explicit authorization and out-of-scope rules.");
  if (!hasRouteSection) warnings.push("Add route, API, UI, workflow, or interface hints.");
  if (!hasReviewGoal) warnings.push("Add a concrete review goal or suspicious workflow.");
  if (!hasRoleSection) warnings.push("Add role boundary details, such as user, owner, billing admin, support admin, service account, or anonymous.");
  if (!hasObjectSection) warnings.push("Add protected objects, such as invoice, file, workspace, API key, invite, webhook, memory, or agent.");
  if (hasRouteSection && !hasTenantBoundaryDetail) warnings.push("Add tenant or ownership boundary details, such as owned account, workspace, organization, same tenant, or foreign tenant.");
  if (hasRouteSection && !hasAuthDetail) warnings.push("Add authentication or authorization method details.");
  if (hasRouteSection && !hasRateLimitDetail) warnings.push("Add rate-limit or safe testing pace guidance.");
  if (hasRouteSection && !hasDataSensitivity) warnings.push("Add data sensitivity classification, such as sandbox, public, owned, confidential, or customer data.");

  return {
    accepted: errors.length === 0,
    status: errors.length === 0 ? "accepted" : "rejected",
    score,
    errors,
    warnings,
    boundarySources: {
      role: hasRoleSection ? "input" : "missing",
      tenant: hasTenantBoundaryDetail ? "input" : "missing",
      matrix: errors.length === 0 ? "derived from accepted input roles, objects, routes, surfaces, actions, and ownership hints" : "not generated"
    }
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
    "## Warnings",
    "",
    ...(intake.warnings.length ? intake.warnings.map((warning) => `- ${warning}`) : ["- None."]),
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

function roleBoundaryFor(roles, object, action, surface) {
  if (surface === "admin surface" || action === "execute") return "non-admin user vs admin/operator";
  if (["invoice", "payment", "subscription"].includes(object)) return "member vs billing admin";
  if (["api key", "secret", "webhook"].includes(object)) return "regular user vs workspace owner/service account";
  if (["read", "export"].includes(action)) return "owner vs shared viewer vs outsider";
  if (["update", "delete"].includes(action)) return "owner/editor vs viewer";
  return roles.includes("admin") ? "non-admin user vs admin" : "owner vs non-owner";
}

function stateBoundaryFor(object, action) {
  if (action === "delete") return "active vs archived/soft-deleted";
  if (object === "invite") return "pending vs accepted/expired";
  if (object === "export" || action === "export") return "generated vs expired/regenerated";
  if (object === "invoice") return "draft vs finalized/void";
  if (object === "file" || object === "document") return "normal vs shared/soft-deleted";
  if (object === "agent" || object === "memory") return "enabled vs disabled/tool-attached";
  return "draft vs active/archived";
}

function tenantBoundaryFor(object, surface) {
  if (["organization", "workspace", "project", "team"].includes(object)) return "same workspace vs foreign workspace";
  if (["invoice", "payment", "subscription"].includes(object)) return "same billing account vs foreign billing account";
  if (["api key", "secret", "webhook"].includes(object)) return "same workspace integration vs foreign integration";
  if (surface === "AI/agent surface" || ["agent", "memory", "embedding"].includes(object)) return "same memory namespace vs foreign tenant memory";
  return "owner tenant vs foreign tenant";
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
          role: roleBoundaryFor(roles, object, action, surface),
          object,
          action,
          state: stateBoundaryFor(object, action),
          tenant: tenantBoundaryFor(object, surface),
          interface: surface,
          priority: priorityFor(surface, action, object)
        });
      }
    }
  }

  return rows.sort((a, b) => b.priority - a.priority).slice(0, 24);
}

function buildQueue(model, paths, urls) {
  const primaryObject = model.objects[0] || "object";
  const secondaryObject = model.objects[1] || primaryObject;
  const primaryRoute = model.routes[0] || "the highest-risk route or workflow";
  const privilegedSurface = model.surfaces.find((surface) => surface.includes("admin") || surface.includes("billing") || surface.includes("AI")) || model.surfaces[0] || "primary interface";

  const queue = [
    {
      title: `Prove ${primaryObject} ownership checks independently for read, update, export, and delete.`,
      bugClass: "BOLA",
      boundary: `actor identity x ${primaryObject} owner x action`,
      method: `Start with ${primaryRoute}. Create a ${primaryObject} as account A, replay the smallest request as account B, compare status, body, and side effects.`
    },
    {
      title: `Mutate hidden ownership, role, status, billing, and callback fields on ${secondaryObject}.`,
      bugClass: "BOPLA",
      boundary: `client-provided ${secondaryObject} properties x server-authoritative properties`,
      method: `Replay valid create/update requests for ${secondaryObject} with one extra sensitive field at a time. Prefer PATCH and bulk variants.`
    },
    {
      title: `Probe role-only helpers around ${privilegedSurface}.`,
      bugClass: "BFLA",
      boundary: `normal role x privileged action on ${privilegedSurface}`,
      method: "Test export, resend, approve, replay, rotate, impersonate, unlock, refund, and disable actions separately."
    },
    {
      title: `Compare interfaces for the same ${primaryObject} action.`,
      bugClass: "interface drift",
      boundary: `${primaryObject} operation x alternate interface`,
      method: `Find where one interface blocks a ${primaryObject} action, then test the underlying endpoint and adjacent method variants directly.`
    }
  ];

  if (model.surfaces.includes("AI/agent surface")) {
    queue.unshift({
      title: `Check whether untrusted ${primaryObject} content can steer tool use or leak scoped data.`,
      bugClass: "LLM/agent control failure",
      boundary: `untrusted ${primaryObject} content x tool authority x tenant data`,
      method: `Use owned files/prompts around ${primaryRoute} only. Confirm whether tool calls require scoped identity and human approval for high-impact actions.`
    });
  }

  if (paths.length || urls.length) {
    queue.push({
      title: `Cluster discovered routes for ${primaryObject} and retest nested identifiers.`,
      bugClass: "nested BOLA",
      boundary: `${primaryObject} parent authorization x child object reference`,
      method: `Use ${primaryRoute} as the seed. Swap child IDs while keeping the parent ID stable, then swap parent IDs while keeping the child ID stable.`
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
      formatVersion: "signalforge.analysis.v1",
      matrixSchema: MATRIX_SCHEMA,
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
    formatVersion: "signalforge.analysis.v1",
    matrixSchema: MATRIX_SCHEMA,
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
