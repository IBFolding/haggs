import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { memoryKv } from "../story/kv";
import { createTemplateStore, templateRules, MY_FORMAT } from "./custom";
import { seriesRequest } from "./series";

describe("your own series templates", () => {
  it("saves a template with how each video is built and an idea to start from, newest first", async () => {
    const store = createTemplateStore(memoryKv());
    const a = await store.save({ label: "My favorite cars", how: "Each video counts down my ten favorite cars, one shot per car, best last.", topic: "Ten cars I would drive forever", count: 2 });
    await new Promise((r) => setTimeout(r, 3));
    await store.save({ label: "Top ten", how: "A countdown from ten to one.", topic: "Ten wonders", count: 1 });
    assert.deepEqual((await store.list()).map((t) => t.label), ["Top ten", "My favorite cars"]);
    await store.remove(a.id);
    assert.equal((await store.list()).length, 1);
  });

  it("needs a name and some words on how each video is built, and keeps the video count between one and eight", async () => {
    const store = createTemplateStore(memoryKv());
    await assert.rejects(store.save({ label: " ", how: "x".repeat(20), topic: "", count: 3 }), /name/i);
    await assert.rejects(store.save({ label: "Mine", how: "short", topic: "", count: 3 }), /how/i);
    assert.equal((await store.save({ label: "Mine", how: "Each video is a countdown of ten.", topic: "", count: 99 })).count, 8);
  });

  it("becomes the writer's rules, so the series is written your way", () => {
    const how = "Each video counts down ten favorite cars, best last.";
    const rules = templateRules(how);
    assert.match(rules, /countdown|counts down/);
    const req = seriesRequest({ label: "My favorite cars", rules }, "Ten cars I'd drive forever", 2);
    assert.match(req.system, /counts down ten favorite cars/);
    assert.match(req.user, /Format: My favorite cars/);
    assert.ok(MY_FORMAT.startsWith("my-"));
  });
});
