import type { Project } from "./model";
import { hashPrompt, promptFor } from "./assemble";
import { addTake } from "./takes";

export function attachUploadedStill(project: Project, shotId: string, url: string, name: string): Project {
  const index = project.shots.findIndex((shot) => shot.id === shotId);
  if (index < 0) return project;
  return { ...project, shots: project.shots.map((shot, i) => i === index ? addTake(shot, {
    url, kind: "image", usd: null, promptHash: hashPrompt(promptFor(project, index)), at: Date.now(),
  }, `Uploaded: ${name}`) : shot) };
}
