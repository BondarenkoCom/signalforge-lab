import test from "node:test";
import assert from "node:assert/strict";
import { analyzeScope } from "../src/core/analyze.js";

test("builds a useful control model from scope text", () => {
  const result = analyzeScope({
    scopeText: "Roles: user, admin. Objects: workspace, invoice, API key. Routes: /api/workspaces/:id /api/invoices/:invoiceId/export. Authentication: session cookie. Authorization: owned accounts only. Data sensitivity: owned test data. Out of scope: DoS. Rate limits: manual testing only.",
    notes: "Check GraphQL mutation, webhook replay, and AI agent memory."
  });

  assert.equal(result.formatVersion, "signalforge.analysis.v1");
  assert.deepEqual(result.matrixSchema.itemFields, ["priority", "interface", "object", "action", "role", "state", "tenant"]);
  assert.equal(result.model.roles.includes("admin"), true);
  assert.equal(result.model.objects.includes("invoice"), true);
  assert.equal(result.model.objects.includes("workspace"), true);
  assert.equal(result.model.objects.includes("user"), false);
  assert.equal(result.model.surfaces.includes("GraphQL"), true);
  assert.equal(result.intake.accepted, true);
  assert.equal(result.matrix.length > 0, true);
  assert.equal(result.queue.some((item) => item.bugClass.includes("LLM")), true);
  assert.match(result.reportMarkdown, /Authorization Matrix/);
  assert.match(result.queue[0].title, /workspace|invoice|api key/i);
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

test("rejects keyword stuffing that satisfies categories without real scope", () => {
  const result = analyzeScope({ scopeText: "goal user file route authorized" });

  assert.equal(result.intake.accepted, false);
  assert.equal(result.matrix.length, 0);
  assert.match(result.intake.errors.join(" "), /Missing route/);
});

test("rejects route-only scope when auth, rate limits, and data sensitivity are absent", () => {
  const result = analyzeScope({
    scopeText: "Roles: user. Objects: invoice. Routes: /api/invoices/:id/export. Review goal: check invoice export."
  });

  assert.equal(result.intake.accepted, false);
  assert.equal(result.matrix.length, 0);
  assert.match(result.intake.errors.join(" "), /authentication method, rate-limit guidance, and data sensitivity/);
  assert.match(result.intake.warnings.join(" "), /authentication|rate-limit|data sensitivity/i);
});

test("rejects route scope with missing role or tenant boundary details", () => {
  const missingRole = analyzeScope({
    scopeText: "Objects: invoice. Routes: /api/invoices/:id/export. Authentication: session cookie. Authorization: owned objects only. Data sensitivity: owned test data. Rate limits: manual testing only. Review goal: check invoice export."
  });

  assert.equal(missingRole.intake.accepted, false);
  assert.match(missingRole.intake.errors.join(" "), /Missing role boundary details/);

  const missingTenant = analyzeScope({
    scopeText: "Roles: user, admin. Objects: invoice. Routes: /api/invoices/:id/export. Authentication: session cookie. Authorization: allowed testing. Data sensitivity: test data. Rate limits: manual testing only. Review goal: check invoice export."
  });

  assert.equal(missingTenant.intake.accepted, false);
  assert.equal(missingTenant.matrix.length, 0);
  assert.match(missingTenant.intake.errors.join(" "), /tenant or ownership boundary/);
  assert.equal(missingTenant.intake.boundarySources.tenant, "missing");
});

test("rejects secret-like material in intake", () => {
  const result = analyzeScope({
    scopeText: "Roles: user. Objects: api key. Routes: /api/keys. Authentication: session cookie. Authorization: owned account. Data sensitivity: owned test data. Rate limits: manual testing only. Review goal: check key handling. Token: rnd_abcdefghijklmnopqrstuvwxyz"
  });

  assert.equal(result.intake.accepted, false);
  assert.match(result.intake.errors.join(" "), /Secret-like material/);
});

test("rejects common provider token shapes before plan generation", () => {
  const examples = [
    "AIzaSyD12345678901234567890123456789012345",
    "glpat-1234567890abcdefghij",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepart123",
    "ya29.A0AfH6SM1234567890abcdef"
  ];

  for (const token of examples) {
    const result = analyzeScope({
      scopeText: `Roles: user. Objects: api key. Routes: /api/keys. Authentication: session cookie. Authorization: owned account only. Data sensitivity: owned test data. Rate limits: manual testing only. Review goal: check key handling. Token: ${token}`
    });

    assert.equal(result.intake.accepted, false, token);
    assert.match(result.intake.errors.join(" "), /Secret-like material|jwt/);
  }
});

test("rejects high-entropy token-shaped values near credential labels", () => {
  const result = analyzeScope({
    scopeText: "Roles: user. Objects: api key. Routes: /api/keys. Authentication: session cookie. Authorization: owned account only. Data sensitivity: owned test data. Rate limits: manual testing only. Review goal: check key handling. Access token: Ab9xK2LmN8pQ4rT7vY1zC3dE6fG0hJ5kL8mP"
  });

  assert.equal(result.intake.accepted, false);
  assert.match(result.intake.errors.join(" "), /high-entropy token/);
});

test("varies matrix boundary columns instead of using decorative constants", () => {
  const result = analyzeScope({
    scopeText: "Roles: user, billing admin, admin. Objects: invoice, file, api key, invite. Routes: /api/invoices/:id/export /api/files/:id. Authentication: session cookie. Authorization: owned objects only. Data sensitivity: owned test data. Rate limits: manual testing only. Review goal: verify export and update boundaries."
  });

  assert.equal(result.intake.accepted, true);
  assert.equal(result.intake.boundarySources.role, "input");
  assert.equal(result.intake.boundarySources.tenant, "input");
  assert.equal(new Set(result.matrix.map((row) => row.role)).size > 1, true);
  assert.equal(new Set(result.matrix.map((row) => row.state)).size > 1, true);
  assert.equal(new Set(result.matrix.map((row) => row.tenant)).size > 1, true);
  assert.match(result.queue[0].title, /invoice/i);
});

test("limits untrusted text size", () => {
  const result = analyzeScope({ scopeText: "user ".repeat(50000) });

  assert.equal(result.inputStats.characters <= 60000, true);
});
