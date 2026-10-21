/**
 * The haggs MCP server: lets Claude (in Claude Code, Claude Desktop, anywhere
 * MCP runs) read your projects and send drafts, looks and sheet edits to them.
 *
 *   npx tsx scripts/mcp.ts
 *
 * It reads the snapshots the app writes to the bridge folder while you work,
 * and writes proposals into each project's inbox. Nothing Claude sends changes
 * a project until you press Apply in the app. Nothing here spends money.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { cameraMoves } from "../src/sheets/camera";
import { FORMATS, formatById } from "../src/sheets/formats";
import { fixCell, normalizeSheets, promptRows, qaSheet, sheetsView, type Sheets } from "../src/sheets/sheets";
import { bridgeRoot, inbox, listSnapshots, propose, readSnapshot } from "../src/server/bridge";
import { applyBoardProposal, validateBoardProposal } from "../src/story/proposed-board";
import { applyDraft, validateDraft } from "../src/writer/draft";
import { applyFill, type Fill } from "../src/writer/fill";

const root = bridgeRoot(join(dirname(fileURLToPath(import.meta.url)), ".."));
const server = new McpServer({ name: "haggs", version: "1.0.0" });

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 1) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

async function load(project: string) {
  const snap = await readSnapshot(root, project);
  if (!snap) throw new Error(`No snapshot for project ${project}. Open it in haggs (npm run dev) so the app can share it, then try again.`);
  return snap;
}

function boardSheets(sheets: Sheets | null, boards: { id: string; name: string }[], boardId?: string): Sheets | null {
  if (!sheets) return null;
  const first = boards[0]?.id ?? "main";
  const id = boardId ?? first;
  const board = boards.find((b) => b.id === id);
  return sheetsView(normalizeSheets(sheets, first), id, { title: board?.name ?? sheets.title });
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const proposes = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

server.registerTool(
  "haggs_list_projects",
  { description: "List the haggs projects the app has shared, newest first, with their boards.", inputSchema: {}, annotations: readOnly },
  async () => {
    const list = await listSnapshots(root);
    if (!list.length) return text("No projects shared yet. Start haggs with npm run dev and open a project.");
    const out = [];
    for (const item of list) {
      const snap = await readSnapshot(root, item.id);
      out.push({ id: item.id, name: item.name, boards: (snap?.project.boards ?? []).map((b) => ({ id: b.id, name: b.name, shots: b.shots.length })), hasSheets: Boolean(snap?.sheets) });
    }
    return text(out);
  },
);

server.registerTool(
  "haggs_get_sheets",
  {
    description:
      "Read one board's sheets: scenes (heading, act, lines, speakers, first words of action), characters (lines, looks, identity locks), places, story beats, the shot list, prompts and QA findings. Use haggs_get_scenes for the full text of particular scenes.",
    inputSchema: { project: z.string(), board: z.string().optional() },
    annotations: readOnly,
  },
  async ({ project, board }) => {
    try {
      const snap = await load(project);
      const sh = boardSheets(snap.sheets, snap.project.boards ?? [], board);
      if (!sh) return text({ project: snap.project.name, sheets: null, note: "This project has no sheets yet. Propose a draft with haggs_propose_draft." });
      return text({
        project: snap.project.name,
        board: sh.title,
        seconds: sh.seconds,
        format: sh.format,
        style: sh.style,
        withheld: sh.rules.filter(Boolean),
        sources: sh.sources,
        scenes: sh.script.map((s) => ({ id: s.id, heading: s.heading, act: s.act, lines: `${s.from}-${s.to}`, speakers: s.characters, opens: s.action.slice(0, 160) })),
        characters: [...sh.characters].sort((a, b) => b.lines - a.lines).map((c) => ({ id: c.id, lines: c.lines, scenes: c.scenes.length, age: c.age, look: c.look, wardrobe: c.wardrobe, voice: c.voice, lock: c.lock, never: c.never, references: c.refs?.length ?? 0 })),
        places: sh.locations.map((l) => ({ id: l.id, setting: l.setting, scenes: l.scenes.length, look: l.look, light: l.light, lock: l.lock })),
        beats: sh.story.map((b) => ({ id: b.id, title: b.title, scenes: b.sceneIds, source: b.source, feeling: b.feeling, withhold: b.withhold })),
        shots: sh.shots.map((s, i) => ({ id: s.id, n: i + 1, beat: s.beatId, scene: s.sceneId, seconds: s.seconds, size: s.size, angle: s.angle, lens: s.lens, move: s.move, blocking: s.blocking, action: s.action, dialogue: s.dialogue, cast: s.characters, place: s.location })),
        prompts: promptRows(sh).map((p) => ({ n: p.number, text: p.text })),
        qa: qaSheet(sh).map((q) => `${q.level}: ${q.message}`),
      });
    } catch (caught) {
      return fail(caught instanceof Error ? caught.message : String(caught));
    }
  },
);

server.registerTool(
  "haggs_get_scenes",
  { description: "Read the full action and dialogue of particular scenes, by scene id (e1-s4 is episode 1, scene 4).", inputSchema: { project: z.string(), scenes: z.array(z.string()).max(40) }, annotations: readOnly },
  async ({ project, scenes }) => {
    try {
      const snap = await load(project);
      if (!snap.sheets) return fail("This project has no script yet.");
      return text(
        scenes.map((id) => {
          const s = snap.sheets!.script.find((x) => x.id === id);
          return s ? { id, heading: s.heading, act: s.act, action: s.action, dialogue: s.dialogue.map((d) => `${d.character}${d.extension ? ` (${d.extension})` : ""}${d.parenthetical ? ` [${d.parenthetical}]` : ""}: ${d.words}`) } : { id, missing: true };
        }),
      );
    } catch (caught) {
      return fail(caught instanceof Error ? caught.message : String(caught));
    }
  },
);

server.registerTool(
  "haggs_list_formats",
  { description: "The formats a board can start from — each with its runtime, aspect and beats placed in time — and the camera move ids shots may use.", inputSchema: {}, annotations: readOnly },
  async () => text({ formats: FORMATS, cameraMoves: cameraMoves.map((m) => ({ id: m.id, label: m.label, group: m.group })) }),
);

server.registerTool(
  "haggs_propose_draft",
  {
    description:
      "Send a whole draft to a board's inbox: a screenplay (scenes start with INT. or EXT.; character names in capitals on their own line with dialogue below) plus characters with identity locks, places with look locks, beats that list the scene numbers they cover (1 = first heading), and a shot list with camera move ids. It is checked here first and the problems are returned. The person applies it in the app.",
    inputSchema: {
      project: z.string(),
      board: z.string().optional(),
      format: z.string().describe("A format id from haggs_list_formats"),
      summary: z.string().max(300),
      draft: z.object({
        title: z.string(),
        logline: z.string(),
        script: z.string(),
        characters: z.array(z.object({ name: z.string(), look: z.string(), wardrobe: z.string(), voice: z.string(), lock: z.string() })),
        locations: z.array(z.object({ name: z.string(), look: z.string(), light: z.string(), lock: z.string() })),
        beats: z.array(z.object({ title: z.string(), scenes: z.array(z.number().int()), feeling: z.string(), withhold: z.string() })),
        shots: z.array(z.object({ beat: z.number().int(), scene: z.number().int(), action: z.string(), size: z.string(), angle: z.string(), lens: z.string(), move: z.string(), seconds: z.number(), dialogue: z.string(), sound: z.string() })),
      }),
    },
    annotations: proposes,
  },
  async ({ project, board, format, summary, draft }) => {
    try {
      await load(project);
      const f = formatById(format);
      if (!f) return fail(`There is no format "${format}". Call haggs_list_formats.`);
      const checked = validateDraft(draft);
      const { sheets, problems } = applyDraft(checked, f);
      const item = await propose(root, project, { kind: "draft", summary, payload: checked, formatId: format, ...(board ? { boardId: board } : {}) });
      return text({ sent: item.id, scenes: sheets.script.length, beats: sheets.story.length, shots: sheets.shots.length, problems, next: "The person reviews it in haggs and presses Apply." });
    } catch (caught) {
      return fail(caught instanceof Error ? caught.message : String(caught));
    }
  },
);

server.registerTool(
  "haggs_propose_looks",
  {
    description:
      "Send looks, wardrobe, voices and identity locks for characters, and looks, light and look locks for places, to a project's inbox. Only fields that are empty in the project are filled when applied; nothing the person wrote is replaced. Names must match the sheet's characters and places.",
    inputSchema: {
      project: z.string(),
      summary: z.string().max(300),
      characters: z.array(z.object({ name: z.string(), look: z.string(), wardrobe: z.string(), voice: z.string(), lock: z.string() })),
      locations: z.array(z.object({ name: z.string(), look: z.string(), light: z.string(), lock: z.string() })),
    },
    annotations: proposes,
  },
  async ({ project, summary, characters, locations }) => {
    try {
      const snap = await load(project);
      if (!snap.sheets) return fail("This project has no sheets to fill yet.");
      const fill: Fill = { characters, locations };
      const { changed } = applyFill(snap.sheets, fill);
      const unknown = [
        ...characters.filter((c) => !snap.sheets!.characters.some((x) => x.id === c.name.trim().toUpperCase())).map((c) => c.name),
        ...locations.filter((l) => !snap.sheets!.locations.some((x) => x.id === l.name.trim().toUpperCase())).map((l) => l.name),
      ];
      const item = await propose(root, project, { kind: "fill", summary, payload: fill });
      return text({ sent: item.id, wouldFill: changed, notOnTheSheet: unknown });
    } catch (caught) {
      return fail(caught instanceof Error ? caught.message : String(caught));
    }
  },
);

server.registerTool(
  "haggs_propose_edits",
  {
    description:
      "Send cell edits for one board's sheets to the inbox: story beat feelings and withholds, shot actions, sizes, angles, lenses, camera moves (ids from haggs_list_formats), blocking, seconds, dialogue, sound; character and place fields. Each edit is checked here and refused edits are returned.",
    inputSchema: {
      project: z.string(),
      board: z.string().optional(),
      summary: z.string().max(300),
      edits: z.array(z.object({ sheet: z.enum(["story", "characters", "locations", "shots"]), id: z.string(), key: z.string(), value: z.union([z.string(), z.number()]) })).max(400),
    },
    annotations: proposes,
  },
  async ({ project, board, summary, edits }) => {
    try {
      const snap = await load(project);
      let sh = boardSheets(snap.sheets, snap.project.boards ?? [], board);
      if (!sh) return fail("This project has no sheets yet.");
      const refused: string[] = [];
      const kept = edits.filter((e) => {
        try {
          sh = fixCell(sh!, e.sheet, e.id, e.key, e.value);
          return true;
        } catch (caught) {
          refused.push(`${e.sheet}/${e.id}/${e.key}: ${caught instanceof Error ? caught.message : caught}`);
          return false;
        }
      });
      if (!kept.length) return fail(`No edit could be made:\n${refused.join("\n")}`);
      const item = await propose(root, project, { kind: "edits", summary, payload: kept, ...(board ? { boardId: board } : {}) });
      return text({ sent: item.id, edits: kept.length, refused });
    } catch (caught) {
      return fail(caught instanceof Error ? caught.message : String(caught));
    }
  },
);

server.registerTool(
  "haggs_list_shots",
  { description: "List every shot on every board with its id, beat, seconds and what it currently shows, so a new board can reuse them by id.", inputSchema: { project: z.string() }, annotations: readOnly },
  async ({ project }) => {
    try {
      const snap = await load(project);
      return text((snap.project.boards ?? []).map((b) => ({ board: b.name, shots: b.shots.map((s, i) => ({ n: i + 1, id: s.id, beat: s.beat.slice(0, 120), seconds: s.seconds, kind: s.render?.kind ?? null, url: s.render?.url ?? null, takes: s.takes?.length ?? 0 })) })));
    } catch (caught) {
      return fail(caught instanceof Error ? caught.message : String(caught));
    }
  },
);

server.registerTool(
  "haggs_propose_board",
  {
    description:
      "Send a whole new board to a project's inbox: shots in order, each reusing an existing shot by id (it keeps every take) or starting from a picture (/api/local/… or https), with seconds and an optional spoken line. It is checked against the project here. Applied, it is added as a new board; nothing already there changes.",
    inputSchema: {
      project: z.string(),
      summary: z.string().max(300),
      board: z.object({
        name: z.string(),
        kind: z.enum(["reel", "episode", "board"]).optional(),
        shots: z.array(z.object({ beat: z.string(), seconds: z.number(), heading: z.string().optional(), from: z.string().optional(), picture: z.object({ url: z.string(), kind: z.enum(["image", "video"]), origin: z.string().optional() }).optional(), dialogue: z.string().optional() })).max(200),
      }),
    },
    annotations: proposes,
  },
  async ({ project, summary, board }) => {
    try {
      const snap = await load(project);
      const checked = validateBoardProposal(board);
      const { board: made } = applyBoardProposal(snap.project, checked);
      const seconds = made.shots.reduce((n, s) => n + (s.seconds ?? 0), 0);
      const item = await propose(root, project, { kind: "board", summary, payload: checked });
      return text({ sent: item.id, shots: made.shots.length, seconds, empty: made.shots.filter((s) => !s.render).length, next: "The person opens the project's Sheets and presses Apply." });
    } catch (caught) {
      return fail(caught instanceof Error ? caught.message : String(caught));
    }
  },
);

server.registerTool(
  "haggs_inbox",
  { description: "See what is waiting in a project's inbox, not yet applied or dismissed by the person.", inputSchema: { project: z.string() }, annotations: readOnly },
  async ({ project }) => text((await inbox(root, project)).map((i) => ({ id: i.id, kind: i.kind, summary: i.summary, board: i.boardId, at: new Date(i.at).toISOString() }))),
);

await server.connect(new StdioServerTransport());
