"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { runTool, type ToolContext } from "../story/agent-tools";
import { defaultKv } from "../story/kv";
import type { Project } from "../story/model";
import { createProjectStore } from "../story/store";
import { importSheets } from "../sheets/sheets";
import { agentTurn } from "./agent-actions";
import { openKeys } from "./nav";
import { listWorkflows } from "./workflow-actions";

/**
 * Haggy: the in-app producer, on every page (Claude underneath). Ask it to re-cut a board,
 * put a line on a shot, find a workflow, take you somewhere. Its changes show
 * here with an Undo; anything that costs money it sets up for you to press.
 */

type Msg = Anthropic.Beta.BetaMessageParam;
type Line = { who: "you" | "claude" | "change" | "error"; text: string; undo?: Project; undone?: boolean };

export const PROJECT_SAVED = "haggs:project-saved";
const OPEN_PRODUCER = "haggs:open-producer";
/** Opens Haggy from anywhere: the header's Ask Haggy. */
export function openProducer() {
  window.dispatchEvent(new Event(OPEN_PRODUCER));
}
/** Pages holding a project reload it when the producer changes it, so their next save doesn't undo the change. */
export function announceSaved(id: string) {
  window.dispatchEvent(new CustomEvent(PROJECT_SAVED, { detail: { id } }));
}

const STORE = "haggs.producer";
const MAX_STEPS = 14;

function restore(): { history: Msg[]; lines: Line[] } {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as { history: Msg[]; lines: Line[] };
  } catch {
    // Nothing kept, or storage blocked.
  }
  return { history: [], lines: [] };
}

export function Producer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);

  useEffect(() => {
    const show = () => setOpen((v) => !v);
    window.addEventListener(OPEN_PRODUCER, show);
    return () => window.removeEventListener(OPEN_PRODUCER, show);
  }, []);
  useEffect(() => {
    setMounted(true);
    const kept = restore();
    setHistory(kept.history);
    setLines(kept.lines.map(({ undo: _u, ...l }) => l));
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ history: history.slice(-120), lines: lines.slice(-80).map(({ undo: _u, ...l }) => l) }));
    } catch {
      // A long conversation can outgrow session storage; it still works until reload.
    }
    end.current?.scrollIntoView({ block: "end" });
  }, [history, lines]);

  const ctx: ToolContext = useMemo(
    () => ({
      list: () => store.list(),
      load: async (id) => (await store.load(id)) ?? null,
      save: async (p) => {
        await store.save(p);
        announceSaved(p.id);
      },
      sheets: async (id) => {
        const raw = await kv.get<string>(`sheets/${id}`);
        try {
          return raw ? importSheets(raw) : null;
        } catch {
          return null;
        }
      },
      workflows: async (query) => {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const { entries } = await listWorkflows();
        return entries
          .map((e) => ({ e, score: words.filter((w) => `${e.title} ${e.description} ${e.tags.join(" ")}`.toLowerCase().includes(w)).length }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score || b.e.usage - a.e.usage)
          .map(({ e }) => ({ name: e.name, title: e.title, description: e.description.slice(0, 200) }));
      },
      open: (p) => router.push(p),
    }),
    [store, kv, router],
  );

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    const where = `${window.location.pathname}${window.location.search}`;
    let convo: Msg[] = [...history, { role: "user", content: [{ type: "text", text: `(I'm on ${where} in haggs.)` }, { type: "text", text }] }];
    setHistory(convo);
    setLines((l) => [...l, { who: "you", text }]);
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const turn = await agentTurn(convo);
        if (!turn.ok) {
          if (turn.needsKey) openKeys();
          setLines((l) => [...l, { who: "error", text: turn.reason }]);
          // The person's message stays; the failed turn leaves no half-answer behind.
          break;
        }
        convo = [...convo, { role: "assistant", content: turn.content as Anthropic.Beta.BetaContentBlockParam[] }];
        setHistory(convo);
        const said = turn.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
        if (said) setLines((l) => [...l, { who: "claude", text: said }]);
        const calls = turn.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        if (!calls.length || turn.stop !== "tool_use") break;
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const call of calls) {
          const out = await runTool(call.name, (call.input ?? {}) as Record<string, unknown>, ctx);
          if (out.change) {
            const change = out.change;
            setLines((l) => [...l, { who: "change", text: change.label, undo: change.before }]);
          }
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out.result).slice(0, 60_000), ...(out.error ? { is_error: true } : {}) });
        }
        // Every result goes back in one message, in the order Claude asked.
        convo = [...convo, { role: "user", content: results }];
        setHistory(convo);
      }
    } finally {
      setBusy(false);
    }
  }

  async function undo(i: number) {
    const line = lines[i];
    if (!line?.undo || line.undone) return;
    await store.save(line.undo);
    announceSaved(line.undo.id);
    setLines((l) => l.map((x, k) => (k === i ? { ...x, undone: true } : x)));
  }

  if (!mounted) return null;
  return createPortal(
    <>
      {open && (
        <aside className="producer" aria-label="Haggy">
          <header>
            <b>Haggy</b>
            <span>Your producer, working on your projects</span>
            {lines.length > 0 && <button className="plain" onClick={() => { setHistory([]); setLines([]); }}>New chat</button>}
            <button className="plain" onClick={() => setOpen(false)} aria-label="Close">Close</button>
          </header>
          <div className="producer-log" aria-live="polite">
            {!lines.length && (
              <div className="producer-hello">
                <p>Hi, I&rsquo;m Haggy. Tell me what you want and I&rsquo;ll do it here. For example:</p>
                {["Make a 30-second cutdown of the sizzle from its strongest shots", "Put “Tell me what I missed.” on the last shot, in Chris's voice", "Find a workflow that puts my product in a scene", "Keep the title cards as they are so Animate stills skips them"].map((s) => (
                  <button key={s} className="producer-try" onClick={() => setDraft(s)}>{s}</button>
                ))}
                <p className="producer-small">I never spend your credits or delete anything. When something costs money, I set it up and you press the button with the price.</p>
              </div>
            )}
            {lines.map((l, i) => (
              <div key={i} className={`producer-line ${l.who}`}>
                {l.who === "change" ? (
                  <>
                    <span>{l.undone ? "Undone: " : "Done: "}{l.text}</span>
                    {l.undo && !l.undone && <button className="plain" onClick={() => void undo(i)}>Undo</button>}
                  </>
                ) : (
                  <p>{l.text}</p>
                )}
              </div>
            ))}
            {busy && <div className="producer-line claude working"><p>Working…</p></div>}
            <div ref={end} />
          </div>
          <form className="producer-say" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Ask Haggy…" aria-label="Message Haggy" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            <button className="fire" disabled={busy || !draft.trim()}>Send</button>
          </form>
        </aside>
      )}
    </>,
    document.body,
  );
}
