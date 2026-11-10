"use server";

import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { CLAUDE_COOKIE, claudeWorkspaceIn, keyIn } from "../../server/keys";
import { anthropicErrorReason, anthropicOptions } from "../../writer/anthropic-config";
import { validateWorld, type WorldSpec } from "../../worlds/spec";
import type { ShotIdea } from "../../film/plan";

export type PlanResult = { ok: true; ideas: ShotIdea[] } | { ok: false; reason: string; needsKey?: boolean };

/**
 * A real, explicit user-initiated Claude planning call using the existing Haggs key.
 * This action only returns text metadata. It cannot submit renders or spend Comfy credits.
 */
export async function directFilm(brief: string, world: WorldSpec): Promise<PlanResult> {
  if (typeof brief !== "string" || brief.trim().length < 12 || brief.length > 1800 || !validateWorld(world)) {
    return { ok: false, reason: "Give the director a short film brief and a valid Haggs World first." };
  }
  const jar = await cookies();
  const apiKey = keyIn(jar, CLAUDE_COOKIE);
  if (!apiKey) return { ok: false, reason: "Connect your Claude key under Provider keys to use AI Director. Local planning remains free.", needsKey: true };
  try {
    const client = new Anthropic(anthropicOptions(apiKey, claudeWorkspaceIn(jar)));
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2500,
      system: `You direct short cinematic films. Write exactly eight visually distinct, deliberately paced shots for the provided 3D world. Preserve the world's physical objects, environment, and narrative scale. Have a beginning, turning point, climax and final image. Avoid generic adjectives. Design shots that can be achieved with controllable 3D cameras and existing scene geometry. Output ONLY valid JSON as {"shots":[{"name":"...","beat":"...","seconds":8,"lensMm":35}, ...]}. Use eight shots, cumulative 60 seconds. Each beat describes specific visual blocking, camera movement, and a clear editorial reason for the cut. No audio, fake character assets, or unimplemented visual effects should be asserted as ready. Lens 18-120mm.`,
      messages: [{
        role: "user",
        content: JSON.stringify({ brief: brief.trim(), preset: world.preset, environment: world.environment, objects: world.objects.map(o => ({kind:o.kind, position:o.position, scale:o.scale})).slice(0, 80) }),
      }],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "Claude declined this request." };
    const output = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("\n").trim();
    const clean = output.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
    const decoded: unknown = JSON.parse(clean);
    if (!decoded || typeof decoded !== "object" || !("shots" in decoded)) throw new Error("Invalid director output.");
    const shots = (decoded as {shots: unknown}).shots;
    if (!Array.isArray(shots) || shots.length !== 8) throw new Error("Director did not return eight shots.");
    const ideas: ShotIdea[] = [];
    for (const raw of shots) {
      if (!raw || typeof raw !== "object") throw new Error("Invalid shot.");
      const s = raw as Record<string, unknown>;
      if (typeof s.name !== "string" || typeof s.beat !== "string" || s.name.trim().length < 2 || s.beat.trim().length < 10) throw new Error("Incomplete shot.");
      const seconds = typeof s.seconds === "number" && Number.isFinite(s.seconds) ? Math.min(35, Math.max(3, s.seconds)) : 7.5;
      const lensMm = typeof s.lensMm === "number" && Number.isFinite(s.lensMm) ? Math.min(120, Math.max(18, s.lensMm)) : 35;
      ideas.push({ name: s.name.slice(0, 90), beat: s.beat.slice(0, 900), seconds, lensMm });
    }
    return { ok: true, ideas };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return {ok:false,reason:"Claude rejected your key. Check Provider keys.",needsKey:true};
    if (error instanceof Anthropic.RateLimitError) return {ok:false,reason:"Claude rate limit reached. No plan was applied."};
    if (error instanceof Anthropic.APIError) return {ok:false,reason:anthropicErrorReason(error.status, error.message)};
    return {ok:false,reason:"The director didn't return a valid eight-shot plan. Your current plan is unchanged."};
  }
}
