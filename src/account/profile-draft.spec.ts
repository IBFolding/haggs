import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_PROFILE } from "./profile";
import { syncProfileDraft } from "./profile-draft";
test("refresh and user metadata events preserve unsaved name, bio, links and picture", () => {
  const initial = syncProfileDraft({ owner: null, draft: EMPTY_PROFILE, saved: EMPTY_PROFILE }, { id: "one", user_metadata: { profile: { name: "Saved" } } });
  const editing = { ...initial, draft: { ...initial.draft, name: "Unsaved", bio: "Draft", picture: "https://example.test/new.png", links: { website: "https://example.test" } } };
  assert.equal(syncProfileDraft(editing, { id: "one", user_metadata: { profile: { name: "Saved" } } }), editing);
  const switched = syncProfileDraft(editing, { id: "two", user_metadata: { profile: { name: "Other" } } });
  assert.equal(switched.draft.name, "Other");
  assert.equal(syncProfileDraft(editing, null).draft, EMPTY_PROFILE);
});
