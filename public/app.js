const form = document.querySelector("#analyze-form");
const scopeText = document.querySelector("#scopeText");
const notes = document.querySelector("#notes");
const summary = document.querySelector("#summary");
const queue = document.querySelector("#queue");
const matrix = document.querySelector("#matrix");
const report = document.querySelector("#report");
const sampleButton = document.querySelector("#sample-button");
const clearButton = document.querySelector("#clear-button");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");

let lastResult = null;

const profiles = {
  api: {
    scopeText: [
      "Program allows testing own accounts only. Out of scope: DoS, spam, social engineering.",
      "Roles: anonymous, user, workspace owner, support admin.",
      "Objects: user, workspace, project, file, invoice, invite, webhook, api key.",
      "Routes: /api/workspaces/:workspaceId/projects/:projectId, /api/files/:fileId/download, /api/invoices/:invoiceId/export, /api/admin/users/:userId/impersonate, /graphql."
    ].join("\n"),
    notes: "Suspicious flows: export generation, invite resend, webhook replay, PATCH workspace settings, bulk update arrays, archived objects."
  },
  agent: {
    scopeText: [
      "Program allows testing owned prompts, owned files, and owned connected tools only.",
      "Roles: user, workspace owner, service account, admin.",
      "Objects: agent, memory, embedding, document, message, webhook, api key, tool.",
      "Routes: /api/agents/:agentId/messages, /api/tools/:toolId/run, /api/files/:fileId/preview, /api/memory/search."
    ].join("\n"),
    notes: "Suspicious flows: retrieved content steering tools, cross-user memory, tool identity scope, file preview output handling, replayed tool calls."
  },
  billing: {
    scopeText: [
      "Program allows testing owned customer accounts and sandbox billing objects only.",
      "Roles: user, team owner, billing admin, support admin.",
      "Objects: invoice, subscription, payment, coupon, export, report, organization.",
      "Routes: /api/billing/invoices/:invoiceId, /api/billing/export, /api/subscriptions/:subscriptionId, /api/refunds/:paymentId."
    ].join("\n"),
    notes: "Suspicious flows: invoice export, coupon mutation, plan downgrade/upgrade state, refund helpers, support-only actions, stale download URLs."
  }
};

let activeProfile = "api";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function renderSummary(data) {
  const metrics = [
    ["intake", data.intake?.status || "unknown"],
    ["roles", data.model.roles.length],
    ["objects", data.model.objects.length],
    ["surfaces", data.model.surfaces.length],
    ["checks", data.matrix.length]
  ];

  summary.innerHTML = metrics.map(([label, value]) => `
    <div class="metric">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `).join("");
}

function renderQueue(data) {
  const intakeItems = data.intake?.errors?.length || data.intake?.warnings?.length
    ? `<article class="item intake ${data.intake.accepted ? "" : "is-rejected"}">
        <span class="badge">${escapeHtml(data.intake.status)}</span>
        ${data.intake.errors.map((error) => `<p><strong>Error:</strong> ${escapeHtml(error)}</p>`).join("")}
        ${data.intake.warnings.map((warning) => `<p><strong>Warning:</strong> ${escapeHtml(warning)}</p>`).join("")}
      </article>`
    : "";

  queue.innerHTML = intakeItems + data.queue.map((item) => `
    <article class="item">
      <span class="badge">${escapeHtml(item.bugClass)}</span>
      <h2>${escapeHtml(item.title)}</h2>
      <p><strong>Boundary:</strong> ${escapeHtml(item.boundary)}</p>
      <p>${escapeHtml(item.method)}</p>
    </article>
  `).join("");
}

function renderMatrix(data) {
  matrix.innerHTML = data.matrix.map((row) => `
    <div class="matrix-row">
      <div class="priority">P${escapeHtml(row.priority)}</div>
      <div>
        <strong>${escapeHtml(row.interface)} / ${escapeHtml(row.action)} / ${escapeHtml(row.object)}</strong><br>
        <span>${escapeHtml(row.role)} | ${escapeHtml(row.state)} | ${escapeHtml(row.tenant)}</span>
      </div>
    </div>
  `).join("");
}

async function analyze(payload) {
  summary.innerHTML = "<div class=\"empty\">forging</div>";
  queue.innerHTML = "";
  matrix.innerHTML = "";
  report.textContent = "";

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`analysis failed: ${response.status}`);
  const data = await response.json();
  lastResult = data;
  renderSummary(data);
  renderQueue(data);
  renderMatrix(data);
  report.textContent = data.reportMarkdown || data.reportSkeleton;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await analyze({ scopeText: scopeText.value, notes: notes.value });
  } catch (error) {
    summary.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
});

function loadProfile(name) {
  const profile = profiles[name] || profiles.api;
  activeProfile = name;
  scopeText.value = profile.scopeText;
  notes.value = profile.notes;
  document.querySelectorAll(".profile").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.profile === name);
  });
  analyze(profile).catch((error) => {
    summary.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  });
}

sampleButton.addEventListener("click", () => {
  loadProfile(activeProfile);
});

clearButton.addEventListener("click", () => {
  scopeText.value = "";
  notes.value = "";
  summary.innerHTML = "";
  queue.innerHTML = "";
  matrix.innerHTML = "";
  report.textContent = "";
  lastResult = null;
});

copyButton.addEventListener("click", async () => {
  const text = lastResult?.reportMarkdown || report.textContent;
  if (!text) return;

  const original = copyButton.textContent;
  await navigator.clipboard.writeText(text);
  copyButton.textContent = "Copied";
  setTimeout(() => {
    copyButton.textContent = original;
  }, 1000);
});

downloadButton.addEventListener("click", () => {
  const text = lastResult?.reportMarkdown || report.textContent;
  if (!text) return;

  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "signalforge-review-plan.md";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    document.querySelectorAll(".tab-view").forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`#${tab.dataset.tab}`).classList.add("is-active");
  });
});

document.querySelectorAll(".profile").forEach((profile) => {
  profile.addEventListener("click", () => loadProfile(profile.dataset.profile));
});

analyze({ scopeText: "", notes: "" }).catch(() => {});
