"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { VOICES, editEstimate, type Line } from "../../../../providers/cloud-edits";
import { defaultKv } from "../../../../story/kv";
import type { Project, Shot } from "../../../../story/model";
import { runEdit, type EditRequest } from "../../../actions";
import { openKeys } from "../../../nav";

/**
 * The edit tools on the selected clip. Each one shows its price before it
 * runs, runs once on Comfy Cloud, and lands as a new take — nothing already
 * on a shot is ever replaced.
 */

type ToolId = "fix" | "swap" | "recast" | "voice";
const TABS: { id: ToolId; label: string; says: string }[] = [
  { id: "fix", label: "Fix a frame", says: "Grab the frame under the playhead, fix it, then re-render the take with the fix." },
  { id: "swap", label: "Swap across the scene", says: "Change one thing — a jacket, a prop, the weather — in this take or every take in the scene." },
  { id: "recast", label: "Recast", says: "Keep the motion and the camera; change who or where, from reference pictures." },
  { id: "voice", label: "Voice and lip-sync", says: "Speak the lines in ElevenLabs voices and sync the mouths to them." },
];

const money = (usd: number) => `$${usd.toFixed(2)}`;

/** How long a video really is: providers charge for the whole source, not the trimmed clip. */
function useSeconds(url: string | undefined): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!url) return;
    const el = document.createElement("video");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => setSeconds(Number.isFinite(el.duration) ? Math.round(el.duration * 10) / 10 : null);
    return () => el.removeAttribute("src");
  }, [url]);
  return seconds;
}

async function durationOf(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 5);
    el.onerror = () => resolve(5);
    el.src = url;
  });
}

async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function EditTools({
  project,
  shot,
  stage,
  playhead,
  onTake,
}: {
  project: Project;
  shot: Shot;
  stage: RefObject<HTMLVideoElement | null>;
  /** Seconds into the shot's footage under the playhead. */
  playhead: number;
  onTake: (shotId: string, render: NonNullable<Shot["render"]>, origin: string) => void;
}) {
  const [tool, setTool] = useState<ToolId | null>(null);
  const [prompt, setPrompt] = useState("");
  const [frame, setFrame] = useState<string | null>(null);
  const [fixed, setFixed] = useState<string | null>(null);
  const [refs, setRefs] = useState<string[]>([]);
  const [engine, setEngine] = useState<"regenerate" | "aleph">("regenerate");
  const [scope, setScope] = useState<"take" | "scene">("take");
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null);

  const video = shot.render?.kind === "video" ? shot.render.url : undefined;
  const seconds = useSeconds(video);
  // Every take in the same scene: same heading, with video on it.
  const scene = useMemo(() => project.shots.filter((s) => s.heading && s.heading === shot.heading && s.render?.kind === "video"), [project.shots, shot.heading]);

  // Lines from the sheets' dialogue for this shot, one row per speaker line, voices suggested in turn.
  useEffect(() => {
    if (tool !== "voice" || lines.length) return;
    void defaultKv()
      .get<string>(`sheets/${project.id}`)
      .then((raw) => {
        const sheets = raw ? (JSON.parse(raw) as { reels?: Record<string, { shots: { id: string; dialogue: string }[] }>; shots?: { id: string; dialogue: string }[] }) : null;
        const rows = [...Object.values(sheets?.reels ?? {}).flatMap((r) => r.shots), ...(sheets?.shots ?? [])];
        const dialogue = rows.find((r) => r.id === shot.sheetShotId)?.dialogue ?? "";
        const speakers: string[] = [];
        const parsed = dialogue
          .split("\n")
          .map((l) => /^([^:]{1,40}):\s*(.+)$/.exec(l.trim()))
          .filter((m): m is RegExpExecArray => Boolean(m))
          .map((m) => {
            const who = m[1]!.replace(/\s*\(.*\)$/, "").trim();
            if (!speakers.includes(who)) speakers.push(who);
            return { text: m[2]!, voice: VOICES[(speakers.indexOf(who) * 7) % VOICES.length]! };
          });
        setLines(parsed.length ? parsed : [{ text: "", voice: VOICES[0] }]);
      });
  }, [tool, lines.length, project.id, shot.sheetShotId]);

  function grab() {
    const el = stage.current;
    if (!el || !el.videoWidth) {
      setProblem("Play or scrub to the frame first, so there is a picture to grab.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d")!.drawImage(el, 0, 0);
    try {
      setFrame(canvas.toDataURL("image/png"));
      setFixed(null);
      setProblem(null);
    } catch {
      setProblem("This take is on another site, so the browser won't let haggs read its frames.");
    }
  }

  async function go(label: string, request: EditRequest, apply: (result: { url: string; kind: "image" | "video"; usd: number; origin: string }) => void) {
    setBusy(label);
    setProblem(null);
    setDone(null);
    const result = await runEdit(request);
    setBusy(null);
    if (!result.ok) {
      if (result.needsKey) openKeys();
      setProblem(result.reason);
      return false;
    }
    apply(result);
    return true;
  }

  const take = (target: Shot, url: string, kind: "image" | "video", usd: number, origin: string) =>
    onTake(target.id, { url, kind, usd, promptHash: target.render?.promptHash ?? "", at: Date.now() }, origin);

  const len = seconds ?? Number(shot.seconds ?? 5);
  const chars = lines.reduce((n, l) => n + l.text.length, 0);
  const quotes = {
    fix: editEstimate({ tool: "kontext", seconds: 0 }),
    regenerate: editEstimate({ tool: "regenerate", seconds: len }),
    swapOne: editEstimate({ tool: engine, seconds: len }),
    recast: editEstimate({ tool: "genjutsu", seconds: len, resolution }),
    voice: editEstimate({ tool: "voice", seconds: len, characters: chars }),
  };
  const [sceneQuote, setSceneQuote] = useState<number | null>(null);
  useEffect(() => {
    if (tool !== "swap" || scope !== "scene") return;
    void Promise.all(scene.map((s) => durationOf(s.render!.url))).then((all) => setSceneQuote(all.reduce((n, d) => n + editEstimate({ tool: engine, seconds: d }), 0)));
  }, [tool, scope, scene, engine]);

  return (
    <section className="tools">
      <div className="tools-tabs" role="tablist" aria-label="Edit tools">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tool === t.id} onClick={() => { setTool(tool === t.id ? null : t.id); setProblem(null); setDone(null); }}>
            {t.label}
          </button>
        ))}
      </div>
      {tool && <p className="tools-says">{TABS.find((t) => t.id === tool)!.says}</p>}

      {tool && tool !== "fix" && !video && <p className="sh-note">This shot has no video take yet. Generate one first, then edit it.</p>}

      {tool === "fix" && (
        <div className="tools-body">
          <div className="tools-frames">
            <figure>
              {frame ? <img src={frame} alt="Grabbed frame" /> : <span>No frame yet</span>}
              <figcaption>Frame at {playhead.toFixed(1)}s</figcaption>
            </figure>
            <figure>
              {fixed ? <img src={fixed} alt="Fixed frame" /> : <span>Fixed frame</span>}
              <figcaption>After the fix</figcaption>
            </figure>
          </div>
          <button className="pill" onClick={grab}>Grab the frame under the playhead</button>
          <label className="sh-field">
            <span>What's wrong, and what it should be</span>
            <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. He has six fingers on his left hand; give him five. Keep everything else the same." />
          </label>
          <div className="tools-run">
            <button
              className="fire"
              disabled={!frame || prompt.trim().length < 4 || busy !== null}
              onClick={() => void go("fix", { tool: "kontext", frame: frame!, prompt }, (r) => setFixed(r.url))}
            >
              {busy === "fix" ? "Fixing the frame…" : "Fix this frame"}
              <span className="cost">about {money(quotes.fix)}</span>
            </button>
            {fixed && (
              <>
                <button className="pill" onClick={() => { take(shot, fixed, "image", quotes.fix, "FLUX Kontext fix"); setDone("The fixed frame is a take on the shot now."); }}>
                  Use the fixed frame as a still
                </button>
                {video && (
                  <button
                    className="fire"
                    disabled={busy !== null}
                    onClick={() =>
                      void go(
                        "regen",
                        { tool: "regenerate", video, seconds: len, prompt: `${prompt}. Keep the shot, the motion, the faces and the light the same.`, references: [fixed] },
                        (r) => { take(shot, r.url, r.kind, r.usd, r.origin); setDone("Re-rendered with the fix. It's a new take; the old one is still there."); },
                      )
                    }
                  >
                    {busy === "regen" ? "Re-rendering… a few minutes" : "Re-render the take with the fix"}
                    <span className="cost">about {money(quotes.regenerate)}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tool === "swap" && video && (
        <div className="tools-body">
          <label className="sh-field">
            <span>What to change</span>
            <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Replace the blue pickup with a rust-red one. Change nothing else." />
          </label>
          <RefPicker refs={refs} setRefs={setRefs} upload={upload} max={5} />
          <div className="tools-opts">
            <label><input type="radio" checked={engine === "regenerate"} onChange={() => setEngine("regenerate")} /> MiniMax H3 regenerate — faster, cheaper</label>
            <label><input type="radio" checked={engine === "aleph"} onChange={() => setEngine("aleph")} /> Runway Aleph 2 — most faithful to the original</label>
          </div>
          <div className="tools-opts">
            <label><input type="radio" checked={scope === "take"} onChange={() => setScope("take")} /> This take</label>
            <label><input type="radio" checked={scope === "scene"} onChange={() => setScope("scene")} /> Every take in this scene ({scene.length})</label>
          </div>
          <div className="tools-run">
            <button
              className="fire"
              disabled={prompt.trim().length < 4 || busy !== null}
              onClick={async () => {
                const targets = scope === "scene" ? scene : [shot];
                let made = 0;
                for (const target of targets) {
                  const d = await durationOf(target.render!.url);
                  const ok = await go(
                    `swap ${made + 1}/${targets.length}`,
                    { tool: engine, video: target.render!.url, seconds: d, prompt, references: refs },
                    (r) => take(target, r.url, r.kind, r.usd, r.origin),
                  );
                  if (!ok) break;
                  made++;
                }
                if (made) setDone(`Swapped ${made} take${made === 1 ? "" : "s"}. Each is a new take; the originals are still there.`);
              }}
            >
              {busy?.startsWith("swap") ? `Swapping ${busy.slice(5)}…` : scope === "scene" ? `Swap in ${scene.length} takes` : "Swap in this take"}
              <span className="cost">about {money(scope === "scene" ? (sceneQuote ?? 0) : quotes.swapOne)}</span>
            </button>
          </div>
        </div>
      )}

      {tool === "recast" && video && (
        <div className="tools-body">
          <RefPicker refs={refs} setRefs={setRefs} upload={upload} max={8} suggested={shot.refs ?? []} />
          <label className="sh-field">
            <span>Anything to keep or change (optional)</span>
            <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Same performance; she's older, grey braid, same jacket." />
          </label>
          <div className="tools-opts">
            <label><input type="radio" checked={resolution === "480p"} onChange={() => setResolution("480p")} /> 480p — review</label>
            <label><input type="radio" checked={resolution === "720p"} onChange={() => setResolution("720p")} /> 720p — final</label>
          </div>
          {len < 4 && <p className="sh-note">Recast needs a take of at least 4 seconds.</p>}
          <div className="tools-run">
            <button
              className="fire"
              disabled={!refs.length || len < 4 || busy !== null}
              onClick={() => void go("recast", { tool: "genjutsu", video, seconds: len, prompt, references: refs, resolution }, (r) => { take(shot, r.url, r.kind, r.usd, r.origin); setDone("Recast. It's a new take; the original is still there."); })}
            >
              {busy === "recast" ? "Recasting… a few minutes" : "Recast this take"}
              <span className="cost">about {money(quotes.recast)}</span>
            </button>
          </div>
        </div>
      )}

      {tool === "voice" && video && (
        <div className="tools-body">
          {lines.map((line, i) => (
            <div key={i} className="tools-line">
              <select aria-label={`Voice for line ${i + 1}`} value={line.voice} onChange={(e) => setLines((all) => all.map((l, j) => (j === i ? { ...l, voice: e.target.value } : l)))}>
                {VOICES.map((v) => <option key={v}>{v}</option>)}
              </select>
              <input aria-label={`Line ${i + 1}`} value={line.text} maxLength={2000} onChange={(e) => setLines((all) => all.map((l, j) => (j === i ? { ...l, text: e.target.value } : l)))} />
              <button className="sh-icon" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((all) => all.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button className="pill" disabled={lines.length >= 10} onClick={() => setLines((all) => [...all, { text: "", voice: all.at(-1)?.voice ?? VOICES[0] }])}>Add a line</button>
          <div className="tools-run">
            <button
              className="fire"
              disabled={!lines.length || lines.some((l) => !l.text.trim()) || busy !== null}
              onClick={() => void go("voice", { tool: "voice", video, seconds: len, lines }, (r) => { take(shot, r.url, r.kind, r.usd, r.origin); setDone("Voiced and lip-synced. It's a new take; the silent one is still there."); })}
            >
              {busy === "voice" ? "Voicing… a few minutes" : "Voice and lip-sync"}
              <span className="cost">about {money(quotes.voice)}</span>
            </button>
          </div>
        </div>
      )}

      {problem && <p className="library-error" role="alert">{problem}</p>}
      {done && <p className="sh-notice" role="status">{done}</p>}
      {tool && <p className="sh-note">Prices are Comfy's published rates for {seconds ? `this ${len}s take` : "the take"}, billed to your Comfy credits. Nothing is retried automatically.</p>}
      <input
        ref={upload}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            const uri = await fileToDataUri(f);
            setRefs((r) => [...r, uri].slice(0, 8));
          }
        }}
      />
    </section>
  );
}

function RefPicker({ refs, setRefs, upload, max, suggested = [] }: { refs: string[]; setRefs: (r: string[]) => void; upload: RefObject<HTMLInputElement | null>; max: number; suggested?: string[] }) {
  return (
    <div className="refs">
      <span className="refs-label">Reference pictures ({refs.length}/{max})</span>
      <div className="refs-row">
        {refs.map((url, i) => (
          <figure key={url.slice(-40) + i} className="ref">
            <img src={url} alt="" />
            <span><button aria-label="Remove reference" onClick={() => setRefs(refs.filter((_, j) => j !== i))}>×</button></span>
          </figure>
        ))}
        <div className="refs-add">
          <button className="pill" disabled={refs.length >= max} onClick={() => upload.current?.click()}>Upload</button>
          {suggested.filter((s) => !refs.includes(s)).length > 0 && (
            <button className="pill" onClick={() => setRefs([...refs, ...suggested.filter((s) => !refs.includes(s))].slice(0, max))}>Use this shot's cast and place</button>
          )}
        </div>
      </div>
    </div>
  );
}
