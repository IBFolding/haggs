/**
 * Builds a haggs project file from scripts, a v1 storyboard and a list of
 * local media, without touching the network.
 *
 *   npx tsx scripts/import-bundle.ts path/to/config.json
 *
 * The config (kept next to the footage, never in this repo) says:
 *   { "title", "seconds", "format", "style", "rules": [],
 *     "scripts": ["ep1.md", …], "v1Board": "NATIVE_STORYBOARD.json",
 *     "mediaRoot": "<the folder HAGGS_LOCAL_MEDIA points at>",
 *     "media": [{ "file": "relative/to/mediaRoot.mp4", "kind", "name", "origin", "status", "note", "shot"?, "seconds"? }],
 *     "out": "relative/to/mediaRoot/NAME.haggs.json" }
 *
 * Media becomes /api/local/… URLs, which only the local development server
 * plays. Import the result from Projects → Import.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { localUrl } from "../src/server/local-media";
import { attachMedia, fromV1Board, type MediaInput, type V1Board } from "../src/sheets/import-v1";
import { parseScreenplay } from "../src/sheets/screenplay";
import { buildSheets, normalizeSheets, putSheetsView, qaSheet, sheetsView, syncBoard } from "../src/sheets/sheets";
import { addBoard, commit, normalize, renameBoard, view } from "../src/story/boards";
import { addSubplot } from "../src/story/flow";
import { createProject, type Media } from "../src/story/model";
import { exportProject } from "../src/story/transfer";

type Config = {
  /** Name of the board the v1 storyboard lands on. */
  boardName?: string;
  /** Also make one empty board per uploaded episode, each with its own sheets. */
  episodeBoards?: boolean;
  /** Story-beat title → subplot lane name, for the first board. Beats not listed stay on the main line. */
  lanes?: Record<string, string>;
  /** Target length for each episode board, in seconds. */
  episodeSeconds?: number;
  /** Stable name for this import, so importing a newer file offers to replace the old project. */
  key?: string;
  title: string;
  seconds: number;
  format?: string;
  style?: string;
  rules?: string[];
  scripts: string[];
  v1Board?: string;
  mediaRoot: string;
  media?: (Omit<MediaInput, "url"> & { file: string })[];
  out: string;
};

const configPath = process.argv[2];
if (!configPath) throw new Error("Pass the path to an import config.");
const here = dirname(resolve(configPath));
const at = (p: string, base = here) => (isAbsolute(p) ? p : join(base, p));
const config = JSON.parse(readFileSync(configPath, "utf8")) as Config;
const root = at(config.mediaRoot);

let sheets = buildSheets(config.scripts.map((p) => parseScreenplay(readFileSync(at(p), "utf8"))), {
  title: config.title,
  seconds: config.seconds,
  format: config.format ?? "16:9",
  style: config.style ?? "",
  rules: config.rules ?? [],
});
if (config.v1Board) sheets = fromV1Board(sheets, JSON.parse(readFileSync(at(config.v1Board), "utf8")) as V1Board);

let project = normalize(syncBoard(createProject(config.title), sheets).project);
const first = project.boards![0]!;
project = renameBoard(project, first.id, config.boardName ?? "Main");
project = { ...project, boards: project.boards!.map((b) => (b.id === first.id ? { ...b, kind: "reel" as const } : b)) };
let shared = normalizeSheets({ ...sheets, title: config.boardName ?? sheets.title }, first.id);
if (config.episodeBoards) {
  for (const source of sheets.sources) {
    const made = addBoard(project, `Ep ${source.episode}${source.title ? ` · ${source.title}` : ""}`, "episode");
    project = { ...made.project, boards: made.project.boards!.map((b) => (b.id === made.board.id ? { ...b, kind: "episode" as const } : b)) };
    shared = putSheetsView(shared, made.board.id, sheetsView(shared, made.board.id, { title: made.board.name, seconds: config.episodeSeconds ?? 1800 }));
  }
}
shared = { ...shared, title: config.title };
const missing: string[] = [];
const media: MediaInput[] = (config.media ?? []).flatMap(({ file, ...item }) => {
  const full = at(file, root);
  if (!existsSync(full)) {
    missing.push(file);
    return [];
  }
  return [{ ...item, url: localUrl(...relative(root, full).split("/")) }];
});
if (config.lanes) {
  let board = view(project, first.id);
  const reel = sheetsView(shared, first.id);
  const laneFor = new Map<string, string>();
  for (const name of new Set(Object.values(config.lanes))) {
    board = addSubplot(board, name);
    laneFor.set(name, board.threads.at(-1)!.id);
  }
  board = {
    ...board,
    shots: board.shots.map((shot) => {
      const row = reel.shots.find((r) => r.id === shot.sheetShotId);
      const beat = reel.story.find((b) => b.id === row?.beatId);
      const lane = beat ? laneFor.get(config.lanes![beat.title] ?? "") : undefined;
      return lane ? { ...shot, threadIds: [...shot.threadIds, lane] } : shot;
    }),
  };
  project = commit(project, first.id, board);
}
// Media numbers refer to shots on the first board, where the v1 storyboard landed.
project = commit(project, first.id, attachMedia(view(project, first.id), media));
project.source = { templateId: "import", name: "Imported from Open Haggsfield v1" };
if (config.key) project.importKey = config.key;

writeFileSync(at(config.out, root), exportProject(project, shared));
const onShots = project.boards!.flatMap((b) => b.shots).filter((s) => s.render).length;
const count = (status: Media["status"]) => (project.media ?? []).filter((m) => m.status === status).length;
console.log(`${project.name}: ${sheets.script.length} scenes; boards: ${project.boards!.map((b) => `${b.name} (${b.shots.length})`).join(", ")}; ${onShots} shots with footage.`);
console.log(`Media: ${project.media?.length ?? 0} (${count("review")} to review, ${count("rejected")} rejected, ${count("reference")} reference).`);
console.log(`QA: ${qaSheet(sheets).filter((q) => q.level === "error").length} to fix, ${qaSheet(sheets).length} findings.`);
if (missing.length) console.log(`Not found, skipped: ${missing.join(", ")}`);
console.log(`Wrote ${at(config.out, root)}`);
