import type { Project } from "./model";

/** Library guidance based only on media currently attached to actual shots. */
export function projectProgress(project: Project) {
  const boards = project.boards ?? [{ id: "main", shots: project.shots }];
  const shots = boards.flatMap((board) => board.shots);
  const visuals = shots.filter((shot) => Boolean(shot.render?.url)).length;
  const clips = shots.filter((shot) => shot.render?.url && shot.render.kind === "video").length;
  const base = `/board/${encodeURIComponent(project.id)}`;
  const next = boards.find((board) => board.shots.some((shot) => !shot.render?.url)) ?? boards.find((board) => board.shots.length);
  const boardQuery = next ? `?b=${encodeURIComponent(next.id)}` : "";
  return {
    total: shots.length, visuals, clips,
    stage: !shots.length ? "Script & planning" : visuals < shots.length ? "Building the shots" : "Ready to review",
    action: !shots.length ? "Open script" : visuals < shots.length ? "Continue storyboard" : "Review in editor",
    href: !shots.length ? `${base}/sheets` : visuals < shots.length ? `${base}${boardQuery}` : `${base}/cut${boardQuery}`,
  };
}
