import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repo = "BondarenkoCom/signalforge-lab";
const liveUrl = "https://signalforge-lab.onrender.com";
const serviceId = "srv-d7tdljbeo5us73b9dfj0";
const renderKeyPath = "C:\\Users\\Honor\\.claude\\projects\\C--Users-Honor\\memory\\reference_render.md";

async function gh(args) {
  const { stdout } = await execFileAsync("gh", args, { maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout);
}

async function getRenderToken() {
  const text = await readFile(renderKeyPath, "utf8");
  const match = text.match(/rnd_[A-Za-z0-9]+/);
  if (!match) throw new Error("Render API key not found");
  return match[0];
}

async function getLatestDeploy() {
  const token = await getRenderToken();
  const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys?limit=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });

  if (!response.ok) throw new Error(`Render deploy check failed: ${response.status}`);
  const deploys = await response.json();
  const deploy = deploys[0]?.deploy || deploys[0];
  return {
    status: deploy?.status || "unknown",
    commit: deploy?.commit?.id?.slice(0, 7) || "unknown",
    finishedAt: deploy?.finishedAt || null
  };
}

async function getHealth() {
  const response = await fetch(`${liveUrl}/health`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: body.ok === true };
}

const [runs, issues, deploy, health] = await Promise.all([
  gh(["run", "list", "--repo", repo, "--limit", "1", "--json", "headSha,status,conclusion,url"]),
  gh(["issue", "list", "--repo", repo, "--limit", "10", "--json", "number,title,state,createdAt,url"]),
  getLatestDeploy(),
  getHealth()
]);

const latestRun = runs[0] || {};

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  repo,
  liveUrl,
  ci: {
    status: latestRun.status || "unknown",
    conclusion: latestRun.conclusion || null,
    sha: latestRun.headSha?.slice(0, 7) || "unknown",
    url: latestRun.url || null
  },
  render: deploy,
  health,
  openIssues: issues.filter((issue) => issue.state === "OPEN").length,
  issues: issues.slice(0, 5)
}, null, 2));
