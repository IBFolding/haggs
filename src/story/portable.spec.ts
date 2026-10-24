import assert from "node:assert/strict";
import { test } from "node:test";

import { localLinks, withLinks } from "./portable";

test("every file on this machine is found once, wherever it sits in the project", () => {
  const project = { shots: [{ picture: "/api/local/a.png", clip: "/api/local/b.mp4" }, { picture: "/api/local/a.png" }], refs: ["/api/local/c.png", "https://x.test/d.png", "data:image/png;base64,AAA"], name: "Local files" };
  assert.deepEqual(localLinks(project).sort(), ["/api/local/a.png", "/api/local/b.mp4", "/api/local/c.png"]);
});

test("links with spaces and brackets come through as they are written", () => {
  assert.deepEqual(localLinks({ u: "/api/local/haggs-renders/a%20b.png" }), ["/api/local/haggs-renders/a%20b.png"]);
});

test("known links are swapped for their cloud copy and the rest are left alone, without touching the original", () => {
  const project = { shots: [{ picture: "/api/local/a.png" }, { picture: "/api/local/b.png" }] };
  const swapped = withLinks(project, { "/api/local/a.png": "https://store.test/a.png" });
  assert.deepEqual(swapped, { shots: [{ picture: "https://store.test/a.png" }, { picture: "/api/local/b.png" }] });
  assert.equal(project.shots[0]!.picture, "/api/local/a.png");
});

test("the same swap works inside a JSON string such as the sheets", () => {
  const sheets = JSON.stringify({ look: "/api/local/a.png" });
  assert.equal(withLinks(sheets, { "/api/local/a.png": "https://store.test/a.png" }), JSON.stringify({ look: "https://store.test/a.png" }));
});
