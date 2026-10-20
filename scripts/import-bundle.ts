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
import { buildSheets, qaSheet, syncBoard } from "../src/sheets/sheets";
import { createProject, type Media } from "../src/story/model";
import { exportProject } from "../src/story/transfer";

type Config = {
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

let project = syncBoard(createProject(config.title), sheets).project;
const missing: string[] = [];
const media: MediaInput[] = (config.media ?? []).flatMap(({ file, ...item }) => {
  const full = at(file, root);
  if (!existsSync(full)) {
    missing.push(file);
    return [];
  }
  return [{ ...item, url: localUrl(...relative(root, full).split("/")) }];
});
project = attachMedia(project, media);
project.source = { templateId: "import", name: "Imported from Open Haggsfield v1" };

writeFileSync(at(config.out, root), exportProject(project, sheets));
const onShots = project.shots.filter((s) => s.render).length;
const count = (status: Media["status"]) => (project.media ?? []).filter((m) => m.status === status).length;
console.log(`${project.name}: ${sheets.script.length} scenes, ${sheets.story.length} beats, ${project.shots.length} shots, ${onShots} with footage.`);
console.log(`Media: ${project.media?.length ?? 0} (${count("review")} to review, ${count("rejected")} rejected, ${count("reference")} reference).`);
console.log(`QA: ${qaSheet(sheets).filter((q) => q.level === "error").length} to fix, ${qaSheet(sheets).length} findings.`);
if (missing.length) console.log(`Not found, skipped: ${missing.join(", ")}`);
console.log(`Wrote ${at(config.out, root)}`);
