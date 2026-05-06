import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

test("serves health and analysis API", async () => {
  const server = createServer();
  const baseUrl = await listen(server);

  try {
    const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
    assert.deepEqual(health, { ok: true, service: "signalforge" });

    const analysisResponse = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeText: "admin export invoice /api/invoices/:id/export" })
    });
    const analysis = await analysisResponse.json();

    assert.equal(analysisResponse.status, 200);
    assert.equal(analysis.model.objects.includes("invoice"), true);
    assert.equal(analysis.matrix.length > 0, true);
    assert.match(analysis.reportMarkdown, /SignalForge Review Plan/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("serves text metadata with explicit content types", async () => {
  const server = createServer();
  const baseUrl = await listen(server);

  try {
    const privacy = await fetch(`${baseUrl}/privacy.txt`);
    assert.equal(privacy.status, 200);
    assert.match(privacy.headers.get("content-type"), /text\/plain/);

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("content-type"), /application\/xml/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("rejects invalid JSON", async () => {
  const server = createServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });

    assert.equal(response.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
