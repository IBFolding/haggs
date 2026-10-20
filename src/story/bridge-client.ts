import type { Kv } from "./kv";

/**
 * In development, every project save is also posted to the local bridge, so
 * Claude can read the project over MCP. It is debounced per project, carries
 * the project's sheets with it, and never blocks or fails a save.
 */

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function schedule(kv: Kv, id: string) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(async () => {
      try {
        const project = await kv.get(`projects/${id}`);
        if (!project) return;
        const raw = await kv.get<string>(`sheets/${id}`);
        const sheets = typeof raw === "string" ? JSON.parse(raw) : null;
        await fetch("/api/bridge/snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, sheets }) });
      } catch {
        // The bridge is a convenience; a failed post never affects your work.
      }
    }, 1500),
  );
}

export function bridged(kv: Kv): Kv {
  return {
    ...kv,
    get: kv.get.bind(kv),
    async remove(key) {
      await kv.remove(key);
      const match = /^projects\/([\w-]+)$/.exec(key);
      if (match && match[1] !== "index") {
        clearTimeout(timers.get(match[1]!));
        void fetch(`/api/bridge/snapshot?project=${encodeURIComponent(match[1]!)}`, { method: "DELETE" }).catch(() => undefined);
      }
    },
    async set(key, value) {
      await kv.set(key, value);
      const match = /^(projects|sheets)\/([\w-]+)$/.exec(key);
      if (match && match[2] !== "index") schedule(kv, match[2]!);
    },
  };
}
