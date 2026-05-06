import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const snapshotPath = path.join(projectRoot, "data", "status-snapshot.json");

async function runStatus() {
  const { stdout } = await execFileAsync(process.execPath, [path.join(__dirname, "check-status.mjs")], {
    cwd: projectRoot,
    env: process.env,
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout);
}

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(snapshotPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeSnapshot(snapshot) {
  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
}

function issueKey(issue) {
  return String(issue.number);
}

function byLabel(items = []) {
  return new Map(items.map((item) => [item.label, item]));
}

function isBadCi(ci) {
  return ci?.status === "completed" && ci?.conclusion && ci.conclusion !== "success";
}

function isBadRender(render) {
  return render?.status && !["live", "build_in_progress", "update_in_progress"].includes(render.status);
}

function diffStatus(previous, current) {
  const changes = [];

  if (!previous) {
    changes.push({
      type: "baseline_created",
      severity: "info",
      message: "Created first SignalForge automation baseline."
    });
    return changes;
  }

  if (!current.health?.ok) {
    changes.push({
      type: "health_regression",
      severity: "high",
      message: `Live health is not OK: HTTP ${current.health?.status ?? "unknown"}.`
    });
  }

  if (isBadCi(current.ci) && current.ci?.sha !== previous.ci?.sha) {
    changes.push({
      type: "ci_regression",
      severity: "high",
      message: `CI failed on ${current.ci.sha}: ${current.ci.conclusion}.`,
      url: current.ci.url
    });
  }

  if (isBadRender(current.render)) {
    changes.push({
      type: "render_regression",
      severity: "high",
      message: `Render deploy status is ${current.render.status} on ${current.render.commit}.`
    });
  }

  const previousIssues = new Set((previous.issues || []).map(issueKey));
  const newIssues = (current.issues || []).filter((issue) => !previousIssues.has(issueKey(issue)));
  for (const issue of newIssues) {
    changes.push({
      type: "new_github_issue",
      severity: "medium",
      message: `New GitHub issue #${issue.number}: ${issue.title}`,
      url: issue.url
    });
  }

  const previousRequests = new Set((previous.reviewRequests || []).map(issueKey));
  const newRequests = (current.reviewRequests || []).filter((issue) => !previousRequests.has(issueKey(issue)));
  for (const issue of newRequests) {
    changes.push({
      type: "new_review_request",
      severity: "high",
      message: `New review request #${issue.number}: ${issue.title}`,
      url: issue.url
    });
  }

  const previousColony = byLabel(previous.colony);
  for (const post of current.colony || []) {
    const old = previousColony.get(post.label);
    if (!old) continue;
    const grew = Number(post.comments || 0) > Number(old.comments || 0);
    const newer = post.latestCommentAt && post.latestCommentAt !== old.latestCommentAt;
    const ownReply = post.latestCommentAuthor === "aya-9x";
    if (grew && newer) {
      if (!ownReply) {
        changes.push({
          type: "new_colony_comment",
          severity: "medium",
          message: `New Colony comment on ${post.label}: ${old.comments} -> ${post.comments}.`,
          url: post.url,
          author: post.latestCommentAuthor,
          commentId: post.latestCommentId
        });
      }
    }
  }

  return changes;
}

const current = await runStatus();
const previous = await readSnapshot();
const changes = diffStatus(previous, current);
await writeSnapshot(current);

console.log(JSON.stringify({
  checkedAt: current.checkedAt,
  meaningful: changes.some((change) => change.type !== "baseline_created"),
  changes,
  current: {
    ci: current.ci,
    render: current.render,
    health: current.health,
    openIssues: current.openIssues,
    openReviewRequests: current.openReviewRequests,
    colony: current.colony
  }
}, null, 2));
