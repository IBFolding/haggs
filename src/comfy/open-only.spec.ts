import assert from "node:assert/strict";
import { test } from "node:test";

import { OPEN_COOKIE, openOnlyIn, workflowRefusal } from "./open-only";

const jar = (value?: string) => ({ get: (name: string) => (name === OPEN_COOKIE && value !== undefined ? { value } : undefined) });

test("the switch is on only when its cookie says 1", () => {
  assert.equal(openOnlyIn(jar("1")), true);
  assert.equal(openOnlyIn(jar("0")), false);
  assert.equal(openOnlyIn(jar()), false);
});

test("a workflow with partner nodes is refused only while the switch is on, and the refusal names them", () => {
  assert.equal(workflowRefusal(false, ["KlingImage2Video"]), null);
  assert.equal(workflowRefusal(true, []), null);
  const why = workflowRefusal(true, ["KlingImage2Video", "KlingImage2Video", "GeminiNode", "FluxPro", "RunwayNode"])!;
  assert.match(why, /KlingImage2Video, GeminiNode, FluxPro, …/);
  assert.match(why, /nothing was started/);
});
