/**
 * A model declares the settings it accepts, and the composer renders exactly
 * those — no parallel hardcoded list of controls to drift out of step.
 *
 * The important consequence is at the seam: a setting the endpoint never
 * declared cannot reach it. Switching model while holding the old model's
 * settings is the ordinary case, not an edge one, and silently posting a
 * stale field is how a request fails with a message about a parameter the
 * user never knowingly set.
 */

/**
 * `input` is the name the endpoint itself declares. It matters more than it
 * looks: fal is not uniform, and the same idea is `aspect_ratio` on Nano Banana
 * and Kling but `image_size` on every FLUX. Sending the wrong one is silent —
 * the control appears to work and changes nothing.
 */
type Wire = { label: string; input?: string };

export type SettingField =
  | ({ type: "enum"; values: readonly string[]; default: string } & Wire)
  | ({ type: "range"; min: number; max: number; default: number; step?: number; unit?: string } & Wire)
  | ({ type: "boolean"; default: boolean } & Wire);

export type Settings = Record<string, string | number | boolean>;

export type SettingFields = Record<string, SettingField>;

export function defaultSettings(fields: SettingFields): Settings {
  const out: Settings = {};
  for (const [key, field] of Object.entries(fields)) out[key] = field.default;
  return out;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Returns settings that the given model actually accepts: declared keys only,
 * every value in range, and the field's default wherever the held value is
 * missing, the wrong type, or out of bounds.
 *
 * A range clamps rather than resets, because a duration of 99 on a model that
 * tops out at 10 means "as long as possible" far more often than it means
 * "start over at 5".
 */
export function coerceSettings(fields: SettingFields, held: Record<string, unknown>): Settings {
  const out: Settings = {};

  for (const [key, field] of Object.entries(fields)) {
    const value = held[key];

    if (field.type === "enum") {
      out[key] =
        typeof value === "string" && field.values.includes(value) ? value : field.default;
      continue;
    }

    if (field.type === "range") {
      out[key] =
        typeof value === "number" && Number.isFinite(value)
          ? clamp(value, field.min, field.max)
          : field.default;
      continue;
    }

    out[key] = typeof value === "boolean" ? value : field.default;
  }

  return out;
}

/**
 * Renames settings to the keys the endpoint declares, and drops anything it
 * does not. Only declared fields are sent, so a setting left over from the
 * previously selected model cannot reach the request.
 */
export function toWireSettings(
  fields: SettingFields,
  held: Record<string, unknown>,
): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  const settings = coerceSettings(fields, held);
  for (const [key, field] of Object.entries(fields)) {
    wire[field.input ?? key] = settings[key];
  }
  return wire;
}
