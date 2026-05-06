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
  assert.equal(result.intake.accepted, true);
  assert.equal(result.matrix.length > 0, true);
  assert.equal(result.queue.some((item) => item.bugClass.includes("LLM")), true);
  assert.match(result.reportMarkdown, /Authorization Matrix/);
});

test("returns default high-signal plan when input is empty", () => {
  const result = analyzeScope({});

  assert.equal(result.model.roles.length >= 4, true);
  assert.equal(result.intake.status, "demo");
  assert.equal(result.queue[0].bugClass, "BOLA");
  assert.match(result.reportSkeleton, /Broken Boundary/);
  assert.match(result.reportMarkdown, /Safety Boundary/);
});

test("rejects ambiguous user input instead of producing a plausible plan", () => {
  const result = analyzeScope({ scopeText: "please check my app" });

  assert.equal(result.intake.accepted, false);
  assert.equal(result.matrix.length, 0);
  assert.equal(result.queue[0].bugClass, "intake validation");
  assert.match(result.reportMarkdown, /Intake Rejected/);
  assert.match(result.reportMarkdown, /Warnings/);
  assert.match(result.reportMarkdown, /Add explicit authorization/);
});

test("rejects secret-like material in intake", () => {
  const result = analyzeScope({
    scopeText: "Roles: user. Objects: api key. Routes: /api/keys. Authorization: owned account. Review goal: check key handling. Token: rnd_abcdefghijklmnopqrstuvwxyz"
  });

  assert.equal(result.intake.accepted, false);
  assert.match(result.intake.errors.join(" "), /Secret-like material/);
});

test("limits untrusted text size", () => {
  const result = analyzeScope({ scopeText: "user ".repeat(50000) });

  assert.equal(result.inputStats.characters <= 60000, true);
});
