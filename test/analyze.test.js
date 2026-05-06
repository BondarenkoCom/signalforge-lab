import test from "node:test";
import assert from "node:assert/strict";
import { analyzeScope } from "../src/core/analyze.js";

test("builds a useful control model from scope text", () => {
  const result = analyzeScope({
    scopeText: "Roles: user, admin. Objects: workspace, invoice, API key. Routes: /api/workspaces/:id /api/invoices/:invoiceId/export.",
    notes: "Check GraphQL mutation, webhook replay, and AI agent memory."
  });

  assert.equal(result.model.roles.includes("admin"), true);
  assert.equal(result.model.objects.includes("invoice"), true);
  assert.equal(result.model.surfaces.includes("GraphQL"), true);
  assert.equal(result.matrix.length > 0, true);
  assert.equal(result.queue.some((item) => item.bugClass.includes("LLM")), true);
});

test("returns default high-signal plan when input is empty", () => {
  const result = analyzeScope({});

  assert.equal(result.model.roles.length >= 4, true);
  assert.equal(result.queue[0].bugClass, "BOLA");
  assert.match(result.reportSkeleton, /Broken Boundary/);
});

test("limits untrusted text size", () => {
  const result = analyzeScope({ scopeText: "user ".repeat(50000) });

  assert.equal(result.inputStats.characters <= 60000, true);
});
