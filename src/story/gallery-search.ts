import type { Run } from "./runs";

const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}:.]+/gu, " ").split(" ").map((w) => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);

/** The runs that match every word typed, in any order, against the prompt, the model, the kind and the settings. */
export function searchRuns(runs: Run[], query: string): Run[] {
  const want = words(query);
  if (!want.length) return runs;
  return runs.filter((r) => {
    const hay = `${r.prompt} ${r.modelName} ${r.kind} ${Object.values(r.settings).join(" ")}`.toLowerCase();
    return want.every((w) => hay.includes(w));
  });
}
