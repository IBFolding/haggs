import assert from "node:assert/strict";
import { test } from "node:test";

import { coerceSettings, defaultSettings, type SettingField } from "./settings";

const FIELDS: Record<string, SettingField> = {
  aspectRatio: { type: "enum", label: "Aspect", values: ["1:1", "16:9"], default: "1:1" },
  duration: { type: "range", label: "Duration", min: 4, max: 10, default: 5, unit: "s" },
  audio: { type: "boolean", label: "Audio", default: false },
};

test("defaultSettings reads every field's default", () => {
  assert.deepEqual(defaultSettings(FIELDS), {
    aspectRatio: "1:1",
    duration: 5,
    audio: false,
  });
});

test("coerceSettings keeps values that are valid", () => {
  const kept = coerceSettings(FIELDS, { aspectRatio: "16:9", duration: 8, audio: true });
  assert.deepEqual(kept, { aspectRatio: "16:9", duration: 8, audio: true });
});

// Switching model is the real case: the settings you were holding belong to the
// model you just left, and anything the new one does not declare must not reach
// the endpoint.
test("coerceSettings drops fields the model does not declare", () => {
  const coerced = coerceSettings(FIELDS, { aspectRatio: "1:1", resolution: "4k" });
  assert.equal("resolution" in coerced, false);
});

test("coerceSettings falls back to the default for a value outside the enum", () => {
  assert.equal(coerceSettings(FIELDS, { aspectRatio: "21:9" }).aspectRatio, "1:1");
});

test("coerceSettings clamps a range instead of dropping it", () => {
  assert.equal(coerceSettings(FIELDS, { duration: 99 }).duration, 10);
  assert.equal(coerceSettings(FIELDS, { duration: 1 }).duration, 4);
});

test("coerceSettings fills in anything missing", () => {
  assert.deepEqual(coerceSettings(FIELDS, {}), defaultSettings(FIELDS));
});

test("coerceSettings rejects a value of the wrong type", () => {
  assert.equal(coerceSettings(FIELDS, { duration: "eight" }).duration, 5);
  assert.equal(coerceSettings(FIELDS, { audio: "yes" }).audio, false);
});

import { toWireSettings } from "./settings";

// The bug this exists to kill: haggs sent `aspect_ratio` to every model, but
// FLUX and Z-Image take `image_size`. The control looked like it worked and
// silently did nothing on four of ten models.
const WIRE: Record<string, SettingField> = {
  imageSize: {
    type: "enum",
    label: "Size",
    values: ["square_hd", "landscape_16_9"],
    default: "square_hd",
    input: "image_size",
  },
  generateAudio: { type: "boolean", label: "Audio", default: false, input: "generate_audio" },
  duration: { type: "range", label: "Duration", min: 4, max: 10, default: 5 },
};

test("toWireSettings renames each field to the key the endpoint declares", () => {
  assert.deepEqual(toWireSettings(WIRE, { imageSize: "landscape_16_9", generateAudio: true, duration: 7 }), {
    image_size: "landscape_16_9",
    generate_audio: true,
    duration: 7,
  });
});

test("toWireSettings falls back to the setting's own name when no input is declared", () => {
  assert.equal("duration" in toWireSettings(WIRE, { duration: 6 }), true);
});

test("toWireSettings sends nothing the model did not declare", () => {
  const wire = toWireSettings(WIRE, { aspectRatio: "16:9", imageSize: "square_hd" });
  assert.equal("aspect_ratio" in wire, false);
  assert.equal("aspectRatio" in wire, false);
});
