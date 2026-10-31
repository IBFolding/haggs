import assert from "node:assert/strict";
import { test } from "node:test";

import { ltxEntries } from "../../../server/ltx-workflows";
import { workflowRoute } from "./workflow-route";

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
