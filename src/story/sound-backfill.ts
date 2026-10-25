import type { Project } from "./model";
import type { NewRun } from "./runs";

/** Every spoken line, sound effect and soundtrack a set of projects already holds, as Gallery sounds, once per file. */
export function soundsInProjects(projects: Project[]): NewRun[] {
  const out = new Map<string, NewRun>();
  const add = (url: string | undefined, prompt: string, modelName: string) => {
    if (!url || out.has(url)) return;
    out.set(url, { modelId: "sound", modelName, prompt: prompt.trim().slice(0, 200) || modelName, settings: {}, url, kind: "audio", usd: null });
  };
  for (const p of projects) {
    const shots = [...(p.shots ?? []), ...(p.boards ?? []).flatMap((b) => b.shots ?? [])];
    for (const shot of shots) for (const v of shot.voices ?? []) add(v.url, v.text, "Voice line");
    for (const e of p.effects ?? []) add(e.url, e.name, "Sound effect");
    if (p.music) add(p.music.url, p.music.name, "Soundtrack (music)");
    for (const b of p.boards ?? []) for (const e of (b as { effects?: Project["effects"] }).effects ?? []) add(e.url, e.name, "Sound effect");
  }
  return [...out.values()];
}
