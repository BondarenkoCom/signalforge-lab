import { createServer as createHttpServer } from "node:http";
import { appendFile, readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeScope } from "./core/analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(projectRoot, "data");
const PORT = Number.parseInt(process.env.PORT || "4177", 10);
const BODY_LIMIT_BYTES = 128 * 1024;

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".png", "image/png"],
  [".ico", "image/x-icon"]
]);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT_BYTES) {
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function safeContact(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 180);
}

async function handleLead(req, res) {
  const body = await readJson(req);
  const contact = safeContact(body.contact);
  const note = safeContact(body.note);

  if (!contact || contact.length < 3) {
    sendJson(res, 400, { error: "contact_required" });
    return;
  }

  const entry = {
    createdAt: new Date().toISOString(),
    contact,
    note,
    source: safeContact(body.source || "web")
  };

  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(path.join(dataDir, "leads.jsonl"), line, "utf8");

  if (process.env.LEAD_WEBHOOK_URL) {
    fetch(process.env.LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    }).catch(() => {});
  }

  sendJson(res, 202, { ok: true, id: Buffer.from(entry.createdAt).toString("base64url") });
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const decodedPath = decodeURIComponent(requested);
  const target = path.resolve(publicDir, `.${decodedPath}`);

  if (!target.startsWith(publicDir + path.sep)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }

    const type = CONTENT_TYPES.get(path.extname(target).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": info.size,
      "Cache-Control": type.startsWith("text/html") ? "no-store" : "public, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin"
    });
    createReadStream(target).pipe(res);
  } catch {
    sendText(res, 404, "Not found");
  }
}

export function createServer() {
  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true, service: "signalforge" });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/analyze") {
        const body = await readJson(req);
        sendJson(res, 200, analyzeScope(body));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/lead") {
        await handleLead(req, res);
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        await serveStatic(req, res);
        return;
      }

      sendJson(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: status === 500 ? "internal_error" : error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await readFile(path.join(publicDir, "index.html"), "utf8");
  createServer().listen(PORT, "127.0.0.1", () => {
    console.log(`signalforge listening on http://127.0.0.1:${PORT}`);
  });
}
