import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repo = "BondarenkoCom/signalforge-lab";
const liveUrl = "https://signalforge-lab.onrender.com";
const serviceId = "srv-d7tdljbeo5us73b9dfj0";
const renderKeyPath = process.env.SIGNALFORGE_RENDER_KEY_FILE || "";
const colonyPosts = [
  {
    label: "agent-economy",
    id: "a3c9487e-ca51-4696-8cea-a2477fa27d31"
  },
  {
    label: "product-review",
    id: "12ed1436-f930-44a9-ac56-5a9031d07c9e"
  }
];

async function gh(args) {
  const { stdout } = await execFileAsync("gh", args, { maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(400 * attempt);
    }
  }
  throw lastError;
}

async function getRenderToken() {
  if (process.env.RENDER_API_KEY) return process.env.RENDER_API_KEY;
  if (!renderKeyPath) return null;

  const text = await readFile(renderKeyPath, "utf8");
  const match = text.match(/rnd_[A-Za-z0-9]+/);
  if (!match) throw new Error("Render API key not found");
  return match[0];
}

async function getLatestDeploy() {
  const token = await getRenderToken();
  if (!token) {
    return {
      status: "skipped",
      commit: "unknown",
      finishedAt: null,
      reason: "Set RENDER_API_KEY or SIGNALFORGE_RENDER_KEY_FILE to check Render deploys."
    };
  }

  let response;
  try {
    response = await fetchWithRetry(`https://api.render.com/v1/services/${serviceId}/deploys?limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
  } catch (error) {
    return {
      status: "check_failed",
      commit: "unknown",
      finishedAt: null,
      error: error.message
    };
  }

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
  try {
    const response = await fetchWithRetry(`${liveUrl}/health`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, ok: body.ok === true };
  } catch (error) {
    return { status: 0, ok: false, error: error.message };
  }
}

async function getColonyPost(post) {
  let detailsResponse;
  let commentsResponse;
  try {
    [detailsResponse, commentsResponse] = await Promise.all([
      fetchWithRetry(`https://thecolony.cc/api/v1/posts/${post.id}`),
      fetchWithRetry(`https://thecolony.cc/api/v1/posts/${post.id}/comments`)
    ]);
  } catch (error) {
    return {
      label: post.label,
      id: post.id,
      title: "unknown",
      status: "check_failed",
      comments: 0,
      latestCommentAt: null,
      url: `https://thecolony.cc/post/${post.id}`,
      error: error.message
    };
  }

  const details = detailsResponse.ok ? await detailsResponse.json() : {};
  const commentsRaw = commentsResponse.ok ? await commentsResponse.json() : {};
  const comments = commentsRaw.items || commentsRaw.comments || (Array.isArray(commentsRaw) ? commentsRaw : []);
  const latestCommentAt = comments
    .map((comment) => comment.created_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    label: post.label,
    id: post.id,
    title: details.title || "unknown",
    status: details.status || "unknown",
    comments: comments.length,
    latestCommentAt,
    url: `https://thecolony.cc/post/${post.id}`
  };
}

const [runs, issues, reviewRequests, deploy, health, colony] = await Promise.all([
  gh(["run", "list", "--repo", repo, "--limit", "1", "--json", "headSha,status,conclusion,url"]),
  gh(["issue", "list", "--repo", repo, "--limit", "10", "--json", "number,title,state,createdAt,url,labels"]),
  gh(["issue", "list", "--repo", repo, "--label", "review-request", "--limit", "10", "--json", "number,title,state,createdAt,url,labels"]),
  getLatestDeploy(),
  getHealth(),
  Promise.all(colonyPosts.map(getColonyPost))
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
  openReviewRequests: reviewRequests.filter((issue) => issue.state === "OPEN").length,
  issues: issues.slice(0, 5),
  reviewRequests: reviewRequests.slice(0, 5),
  colony
}, null, 2));
