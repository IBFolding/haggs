import type { Kv } from "../story/kv";

/**
 * Your own series templates: a name, a plain-words description of how each
 * video is built, and an idea to start from. They sit beside the built-in
 * formats and work the same way: pick one and the writer follows your pattern.
 */

export type CustomFormat = { id: string; label: string; how: string; topic: string; count: number; createdAt: number; updatedAt: number };
export const MY_FORMAT = "my-";

/** What the writer is told: your pattern, kept the same in every video. */
export const templateRules = (how: string) => `Follow this pattern the creator chose, and keep every video the same shape: ${how.trim().replace(/[.\s]+$/, "")}.`;

const INDEX = "series-templates/index";
const key = (id: string) => `series-templates/${id}`;

export function createTemplateStore(kv: Kv) {
  return {
    async list(): Promise<CustomFormat[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<CustomFormat>(key(id))))).filter((t): t is CustomFormat => Boolean(t)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async save(input: { id?: string; label: string; how: string; topic: string; count: number }): Promise<CustomFormat> {
      const label = input.label.trim();
      const how = input.how.trim();
      if (!label) throw new Error("Give the template a name.");
      if (how.length < 12) throw new Error("Say how each video is built, in a sentence or two.");
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const id = input.id ?? globalThis.crypto.randomUUID();
      const before = input.id ? await kv.get<CustomFormat>(key(id)) : undefined;
      const now = Date.now();
      const saved: CustomFormat = { id, label: label.slice(0, 40), how: how.slice(0, 600), topic: input.topic.trim().slice(0, 300), count: Math.min(8, Math.max(1, Math.round(input.count) || 1)), createdAt: before?.createdAt ?? now, updatedAt: now };
      await kv.set(key(id), saved);
      if (!ids.includes(id)) await kv.set(INDEX, [...ids, id]);
      return saved;
    },
    async remove(id: string) {
      await kv.remove(key(id));
      await kv.set(INDEX, ((await kv.get<string[]>(INDEX)) ?? []).filter((x) => x !== id));
    },
  };
}
