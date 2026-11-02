import assert from "node:assert/strict";
import { test } from "node:test";

import { ltxEntries } from "../../../server/ltx-workflows";
import { workflowDecision, workflowRoute } from "./workflow-route";
import { HAGGS_PREVIEWS } from "../../../comfy/haggs-preview";
import { LTX_WORKFLOWS } from "../../../comfy/ltx";
import { CONTEST_EFFECTS, contestName } from "../../../comfy/contest-lab";

test("reserved workflow routes keep their dedicated pages", () => {
  assert.equal(workflowRoute("import", []), "import");
  assert.equal(workflowRoute("build", []), "build");
  assert.equal(workflowRoute("mine", []), "mine");
  assert.equal(workflowRoute("haggs_scene_forge", []), "scene-forge");
});

test("catalog workflows open as apps by exact name", () => {
  const entries = [...ltxEntries(), { name: "library_example" } as never];
  for (const entry of ltxEntries()) assert.equal(workflowRoute(entry.name, entries), "app");
  assert.equal(workflowRoute("library_example", entries), "app");
});

test("unknown workflow names resolve to not-found instead of a connection gate", () => {
  const entries = ltxEntries();
  assert.equal(workflowRoute("definitely-not-a-workflow", entries), "not-found");
  assert.equal(workflowRoute("HAGGS_LTX_REPAIR_CUT", entries), "not-found");
  assert.equal(workflowRoute("haggs_ltx_repair_cut/extra", entries), "not-found");
});

// Regression: a catalog outage must not turn valid remote workflow URLs into 404s.

test("a known workflow opens as an app even while the catalog is unreachable", () => {
  const entries = ltxEntries();
  assert.equal(workflowDecision(entries[0]!.name, entries, false), "app");
  assert.equal(workflowDecision("library_example", [{ name: "library_example" }], false), "app");
});

test("an unknown name is still a 404 when the catalog answered", () => {
  const entries = ltxEntries();
  assert.equal(workflowDecision("definitely-not-a-workflow", entries, true), "not-found");
  assert.equal(workflowDecision("HAGGS_LTX_REPAIR_CUT", entries, true), "not-found");
  assert.equal(workflowDecision("haggs_ltx_repair_cut/extra", entries, true), "not-found");
});

test("an unknown name shows an unavailable state, not a 404, when the catalog did not answer", () => {
  const entries = ltxEntries();
  assert.equal(workflowDecision("definitely-not-a-workflow", entries, false), "unavailable");
  assert.equal(workflowDecision("import", entries, false), "import");
});

test("bundled workflow apps remain reachable without the remote catalog", () => {
  for (const item of HAGGS_PREVIEWS) assert.equal(workflowDecision(item.name, [], false), "app");
  for (const item of LTX_WORKFLOWS) assert.equal(workflowDecision(item.name, [], false), "app");
  for (const item of CONTEST_EFFECTS) for (const kind of ["reuse", "ltx"] as const) assert.equal(workflowDecision(contestName(item.slug, kind), [], false), "app");
  assert.equal(workflowDecision("haggs_preview_not_real", [], true), "not-found");
});
