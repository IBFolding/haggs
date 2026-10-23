import type { Sheets } from "../sheets/sheets";
import { boardOf, normalize } from "./boards";
import { moveShot, type Project, type ProjectSummary, type VoiceLine } from "./model";
import { applyBoardProposal, validateBoardProposal } from "./proposed-board";
import { sheetsView, normalizeSheets } from "../sheets/sheets";
import { takesOf } from "./takes";

/**
 * What the in-app producer can do, run in the browser against the person's
 * own projects. Reads return compact JSON for Claude; changes return the
 * project before the change, so the chat can offer Undo. Nothing here
 * spends money or deletes anything.
 */

export type ToolContext = {
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  sheets(id: string): Promise<Sheets | null>;
  workflows(query: string): Promise<{ name: string; title: string; description: string }[]>;
  open(path: string): void;
};

export type ToolOutcome = { result: unknown; change?: { label: string; before: Project }; error?: boolean };

const PAGES = /^\/(library|photos|create|video|series|swap|edit|editor|gallery|academy|characters|locations|workflows(\/[\w.-]+)?|board\/[\w-]+(\/(sheets|cut|media))?)(\?(b|quick)=[\w.-]+)?$/;

async function project(ctx: ToolContext, id: unknown): Promise<Project> {
  const found = typeof id === "string" ? await ctx.load(id) : null;
  if (!found) throw new Error(`There is no project ${String(id)}. Call list_projects.`);
  return normalize(found);
}

function shotsOf(p: Project, boardId: unknown) {
  const board = boardOf(p, typeof boardId === "string" ? boardId : undefined);
  if (typeof boardId === "string" && board.id !== boardId) throw new Error(`There is no board ${boardId} in ${p.name}.`);
  return board;
}

function withBoard(p: Project, boardId: string, shots: Project["shots"]): Project {
  return { ...p, boards: p.boards!.map((b) => (b.id === boardId ? { ...b, shots } : b)) };
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "list_projects": {
        const all = await ctx.list();
        const out = [];
        for (const s of all.slice(0, 40)) {
          const p = await ctx.load(s.id);
          if (p) out.push({ id: p.id, name: p.name, boards: normalize(p).boards!.map((b) => ({ id: b.id, name: b.name, shots: b.shots.length })) });
        }
        return { result: out };
      }
      case "read_board": {
        const p = await project(ctx, input.project);
        const board = shotsOf(p, input.board);
        return {
          result: {
            project: p.name,
            board: { id: board.id, name: board.name },
            shots: board.shots.map((s, i) => ({ id: s.id, n: i + 1, beat: s.beat.slice(0, 200), seconds: s.seconds, shows: s.render?.kind ?? "nothing", takes: takesOf(s).length, kept: s.locked === true, voice: (s.voices ?? []).map((v) => `${v.speaker}: ${v.text}${v.url ? "" : " (not spoken yet)"}`) })),
          },
        };
      }
      case "read_sheets": {
        const p = await project(ctx, input.project);
        const raw = await ctx.sheets(p.id);
        if (!raw) return { result: { note: "This project has no sheets yet." } };
        const board = shotsOf(p, input.board);
        const sh = sheetsView(normalizeSheets(raw, p.boards![0]!.id), board.id);
        return {
          result: {
            title: sh.title,
            characters: sh.characters.map((c) => ({ id: c.id, name: c.name, look: c.look.slice(0, 160), references: c.refs?.length ?? 0, lines: c.lines })),
            places: sh.locations.map((l) => ({ id: l.id, name: l.name, look: l.look.slice(0, 120), references: l.refs?.length ?? 0 })),
            beats: sh.story.map((b) => ({ id: b.id, title: b.title, feeling: b.feeling.slice(0, 120) })),
          },
        };
      }
      case "edit_shots": {
        const p = await project(ctx, input.project);
        const board = shotsOf(p, input.board);
        const edits = Array.isArray(input.edits) ? (input.edits as { shot: string; beat?: string; seconds?: number; locked?: boolean }[]) : [];
        if (!edits.length) throw new Error("Give at least one edit.");
        const shots = board.shots.map((s) => {
          const e = edits.find((x) => x.shot === s.id);
          if (!e) return s;
          const next = { ...s };
          if (typeof e.beat === "string" && e.beat.trim()) next.beat = e.beat.trim().slice(0, 2000);
          if (typeof e.seconds === "number") {
            if (!(e.seconds >= 0.5 && e.seconds <= 60)) throw new Error("A shot holds for 0.5 to 60 seconds.");
            next.seconds = Math.round(e.seconds * 30) / 30;
          }
          if (e.locked === true) next.locked = true;
          if (e.locked === false) delete next.locked;
          return next;
        });
        const missing = edits.filter((e) => !board.shots.some((s) => s.id === e.shot));
        if (missing.length) throw new Error(`No shot ${missing[0]!.shot} on ${board.name}. Call read_board.`);
        await ctx.save(withBoard(p, board.id, shots));
        return { result: { changed: edits.length }, change: { label: `Edited ${edits.length} shot${edits.length === 1 ? "" : "s"} on ${board.name}`, before: p } };
      }
      case "move_shot": {
        const p = await project(ctx, input.project);
        const board = shotsOf(p, input.board);
        const from = board.shots.findIndex((s) => s.id === input.shot);
        if (from < 0) throw new Error(`No shot ${String(input.shot)} on ${board.name}.`);
        const to = Math.min(board.shots.length, Math.max(1, Math.round(Number(input.to)))) - 1;
        await ctx.save(withBoard(p, board.id, moveShot(board.shots, from, to)));
        return { result: { moved: true, from: from + 1, to: to + 1 }, change: { label: `Moved shot ${from + 1} to ${to + 1} on ${board.name}`, before: p } };
      }
      case "add_board": {
        const p = await project(ctx, input.project);
        const { project: next, board } = applyBoardProposal(p, validateBoardProposal({ name: input.name, shots: input.shots }));
        await ctx.save(next);
        return { result: { board: board.id, shots: board.shots.length }, change: { label: `Added the board “${board.name}” (${board.shots.length} shots)`, before: p } };
      }
      case "add_voice_line": {
        const p = await project(ctx, input.project);
        const board = shotsOf(p, input.board);
        const at = board.shots.findIndex((s) => s.id === input.shot);
        if (at < 0) throw new Error(`No shot ${String(input.shot)} on ${board.name}.`);
        const text = String(input.text ?? "").trim();
        if (!text) throw new Error("Give the line's words.");
        const line: VoiceLine = { id: "line-" + crypto.randomUUID().slice(0, 8), speaker: String(input.speaker ?? "VOICE").toUpperCase().slice(0, 40), text: text.slice(0, 2000), voice: String(input.voice ?? "Laura (female, american)"), offset: Math.max(0, Number(input.offset) || 0) };
        const shots = board.shots.map((s, i) => (i === at ? { ...s, voices: [...(s.voices ?? []), line] } : s));
        await ctx.save(withBoard(p, board.id, shots));
        return { result: { added: true, note: "Not spoken yet; the person presses Speak in the Cut." }, change: { label: `Put “${text.slice(0, 40)}” on shot ${at + 1}`, before: p } };
      }
      case "find_workflows":
        return { result: (await ctx.workflows(String(input.query ?? ""))).slice(0, 8) };
      case "open_page": {
        const path = String(input.path ?? "");
        if (!PAGES.test(path)) throw new Error("That isn't a page in haggs.");
        ctx.open(path);
        return { result: { opened: path } };
      }
      default:
        throw new Error(`There is no tool ${name}.`);
    }
  } catch (caught) {
    return { result: caught instanceof Error ? caught.message : String(caught), error: true };
  }
}
