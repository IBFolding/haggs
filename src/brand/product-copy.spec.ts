import assert from "node:assert/strict";
import { test } from "node:test";

import { ACADEMY_MINUTES, ACCOUNT_BENEFITS, AGENT_OPEN_PAGE_DESCRIPTION, READY_MADE_APPS_SUMMARY } from "./product-copy";
import { LESSONS } from "../academy/lessons";
import { QUICK_APPS } from "../comfy/quick";

test("public app count comes from the actual ready-made app catalog", () => {
  assert.equal(READY_MADE_APPS_SUMMARY, `${QUICK_APPS.length} ready-made apps: swap, relight, try on, upscale.`);
  assert.match(AGENT_OPEN_PAGE_DESCRIPTION, new RegExp(`/workflows \\(${QUICK_APPS.length} ready-made apps\\)`));
  assert.doesNotMatch(AGENT_OPEN_PAGE_DESCRIPTION, /26 ready-made apps/);
});

test("public Academy duration comes from the actual lessons", () => {
  assert.equal(ACADEMY_MINUTES, LESSONS.reduce((total, lesson) => total + lesson.minutes, 0));
  assert.equal(ACADEMY_MINUTES, 80);
});

test("account copy distinguishes synced results from device-local projects", () => {
  assert.equal(ACCOUNT_BENEFITS, "An account holds your plan and credits and can keep finished results available on every device. Projects stay on this device.");
});
