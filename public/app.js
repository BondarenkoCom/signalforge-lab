const form = document.querySelector("#analyze-form");
const leadForm = document.querySelector("#lead-form");
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

const sample = {
  scopeText: [
    "Program allows testing own accounts only. Out of scope: DoS, spam, social engineering.",
    "Roles: anonymous, user, workspace owner, support admin.",
    "Objects: user, workspace, project, file, invoice, invite, webhook, api key, AI agent memory.",
    "Routes: /api/workspaces/:workspaceId/projects/:projectId, /api/files/:fileId/download, /api/invoices/:invoiceId/export, /api/admin/users/:userId/impersonate, /graphql."
  ].join("\n"),
  notes: "Suspicious flows: export generation, invite resend, webhook replay, PATCH workspace settings, agent tool calls from retrieved documents."
};

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
  queue.innerHTML = data.queue.map((item) => `
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

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const contact = new FormData(leadForm).get("contact");
  if (!contact) return;

  const button = leadForm.querySelector("button");
  const original = button.textContent;
  button.textContent = "Opening";
  button.disabled = true;

  const title = encodeURIComponent(`Review request: ${String(contact).slice(0, 64)}`);
  const body = encodeURIComponent([
    `Contact: ${contact}`,
    "",
    "Scope:",
    scopeText.value || "TBD",
    "",
    "Goal:",
    notes.value || "TBD",
    "",
    "Plan:",
    lastResult?.reportMarkdown || "TBD"
  ].join("\n"));
  window.location.href = `https://github.com/BondarenkoCom/signalforge-lab/issues/new?title=${title}&body=${body}`;

  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1200);
});

sampleButton.addEventListener("click", () => {
  scopeText.value = sample.scopeText;
  notes.value = sample.notes;
  analyze(sample).catch((error) => {
    summary.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  });
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

analyze({ scopeText: "", notes: "" }).catch(() => {});
