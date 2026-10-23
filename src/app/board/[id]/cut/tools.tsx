"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { VOICES, editEstimate, type Line } from "../../../../providers/cloud-edits";
import { defaultKv } from "../../../../story/kv";
import type { Project, Shot } from "../../../../story/model";
import { runEdit, type EditRequest } from "../../../actions";
import { openKeys } from "../../../nav";
import { frameAt } from "../../../cut-actions";
import { makeStill } from "../../../series-actions";
import { addStyleReel, type StyledClip } from "../../../../styles/reel";
import { createProjectStore } from "../../../../story/store";
import { STYLES, restylePrompt, styleById, styleSheetPrompt } from "../../../../styles/style";

/**
 * The edit tools on the selected clip. Each one shows its price before it
 * runs, runs once on Comfy Cloud, and lands as a new take — nothing already
 * on a shot is ever replaced.
 */

type ToolId = "fix" | "swap" | "recast" | "restyle" | "voice";
const TABS: { id: ToolId; label: string; says: string }[] = [
  { id: "fix", label: "Fix a frame", says: "Grab the frame under the playhead, fix it, then re-render the take with the fix." },
  { id: "swap", label: "Swap across the scene", says: "Change one thing — a jacket, a prop, the weather — in this take or every take in the scene." },
  { id: "recast", label: "Recast", says: "Keep the motion and the camera; change who or where, from reference pictures." },
  { id: "restyle", label: "Restyle", says: "Turn live action into animation. Pick a style sheet; the motion, camera and performances stay." },
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
  const [grabbedAt, setGrabbedAt] = useState(0);
  const [fixed, setFixed] = useState<string | null>(null);
  const [refs, setRefs] = useState<string[]>([]);
  const [engine, setEngine] = useState<"kling" | "aleph">("kling");
  const [scope, setScope] = useState<"take" | "scene">("take");
  const [resolution, setResolution] = useState<"480p" | "720p">("480p");
  const [styleId, setStyleId] = useState(STYLES[0]!.id);
  const [sheets, setSheets] = useState<Record<string, string>>({});
  const router = useRouter();
  const [reelPick, setReelPick] = useState<string[]>(["cel-anime", "clay", "scribble", "mixed-media", "pixel-art"]);
  const [restyleRes, setRestyleRes] = useState<"720p" | "1080p">("720p");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const fixedUpload = useRef<HTMLInputElement>(null);

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

  /** The frame under the playhead as a picture Comfy will take: JPEG, at most 2048px, so a 4K take never trips the 10 MB limit. */
  async function grab() {
    setProblem(null);
    const el = stage.current;
    if (el && el.videoWidth) {
      try {
        const k = Math.min(1, 2048 / Math.max(el.videoWidth, el.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(el.videoWidth * k);
        canvas.height = Math.round(el.videoHeight * k);
        canvas.getContext("2d")!.drawImage(el, 0, 0, canvas.width, canvas.height);
        setFrame(canvas.toDataURL("image/jpeg", 0.92));
        setGrabbedAt(el.currentTime);
        setFixed(null);
        return;
      } catch {
        // The browser won't read this video's pixels; the server can.
      }
    }
    if (!video) return setProblem("This shot has no video to take a frame from.");
    const r = await frameAt(video, (shot.trimIn ?? 0) + playhead, "video");
    if (!r.ok) return setProblem(r.reason);
    setFrame(r.url);
    setGrabbedAt(playhead);
    setFixed(null);
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
    regenerate: editEstimate({ tool: "kling", seconds: len }),
    swapOne: editEstimate({ tool: engine, seconds: len }),
    recast: editEstimate({ tool: "genjutsu", seconds: len, resolution }),
    restyle: editEstimate({ tool: "kling", seconds: len, resolution: restyleRes }),
    sheet: editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" }),
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
          <div className="tools-run">
            <button className="pill" onClick={() => void grab()}>{frame ? "Grab a different frame" : "Grab the frame under the playhead"}</button>
            <button className="pill" onClick={() => fixedUpload.current?.click()} title="A frame you fixed somewhere else, to re-render the take from">
              Use a fixed picture you already have
            </button>
            <input
              ref={fixedUpload}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setFixed(await fileToDataUri(f));
                // A picture you bring is treated as the take's opening frame.
                setGrabbedAt(0);
                setProblem(null);
              }}
            />
          </div>
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
                        // A frame from the very start of the take is the take's first frame, which the model holds to;
                        // from later on it can only be a reference, so the change goes in the prompt as well.
                        { tool: "kling", video, seconds: len, prompt: `${prompt.replace(/[.\s]+$/, "")}. Match the reference picture. Keep the shot, the motion, the faces and the light the same.`, references: [fixed] },
                        (r) => { take(shot, r.url, r.kind, r.usd, r.origin); setDone("Re-rendered as a new take, with the original kept. Check that it shows the fix before you use it."); },
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
          <RefPicker refs={refs} setRefs={setRefs} upload={upload} max={engine === "kling" ? 4 : 5} />
          <div className="tools-opts">
            <label><input type="radio" checked={engine === "kling"} onChange={() => setEngine("kling")} /> Kling Omni edit — cheaper</label>
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
                if (made) setDone(`Swapped ${made} take${made === 1 ? "" : "s"}, each as a new take with the original kept. Check each one shows the change.`);
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

      {tool === "restyle" && video && (() => {
        const style = styleById(styleId)!;
        const sheet = sheets[styleId];
        return (
          <div className="tools-body">
            <div className="style-pick" role="radiogroup" aria-label="Style">
              {STYLES.map((st) => (
                <button key={st.id} role="radio" aria-checked={styleId === st.id} className={styleId === st.id ? "on" : ""} onClick={() => setStyleId(st.id)}>
                  {sheets[st.id] ? <img src={sheets[st.id]} alt="" /> : <span aria-hidden="true" />}
                  <b>{st.name}</b>
                  <small>{st.says}</small>
                </button>
              ))}
            </div>
            <div className="style-sheet">
              {sheet ? <img src={sheet} alt={`${style.name} style sheet`} /> : <p className="sh-note">The style sheet is a picture of the look that goes to Comfy beside your footage. Make one, or drop your own.</p>}
              <div className="sheet-row">
                <button className="pill" disabled={busy !== null} onClick={async () => {
                  setBusy("sheet"); setProblem(null);
                  const r = await makeStill(styleSheetPrompt(style), "16:9");
                  setBusy(null);
                  if (!r.ok) { if (r.needsKey) openKeys(); return setProblem(r.reason); }
                  setSheets((all) => ({ ...all, [styleId]: r.url }));
                }}>{busy === "sheet" ? "Drawing the sheet…" : sheet ? "Draw it again" : "Make the style sheet"} <span className="cost">{money(quotes.sheet)}</span></button>
                <button className="plain" onClick={() => upload.current?.click()}>Use my own picture</button>
              </div>
              <input ref={upload} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void fileToDataUri(f).then((u) => setSheets((all) => ({ ...all, [styleId]: u }))); }} />
            </div>
            <label className="sh-field">
              <span>Anything to keep (optional)</span>
              <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. She keeps the green jacket and the braid." />
            </label>
            <div className="tools-opts">
              <label><input type="radio" checked={restyleRes === "720p"} onChange={() => setRestyleRes("720p")} /> 720p</label>
              <label><input type="radio" checked={restyleRes === "1080p"} onChange={() => setRestyleRes("1080p")} /> 1080p</label>
            </div>
            <details className="style-reel">
              <summary>Make a style reel: this take in several looks at once</summary>
              <div className="series-chips">
                {STYLES.map((st) => (
                  <button key={st.id} className={reelPick.includes(st.id) ? "on" : ""} onClick={() => setReelPick((p) => (p.includes(st.id) ? p.filter((x) => x !== st.id) : [...p, st.id]))}>{st.name}</button>
                ))}
              </div>
              {(() => {
                const need = reelPick.filter((id) => !sheets[id]).length;
                const each = quotes.restyle;
                const total = reelPick.length * each + need * quotes.sheet;
                return (
                  <div className="tools-run">
                    <button className="fire" disabled={busy !== null || reelPick.length === 0} onClick={async () => {
                      setProblem(null); setDone(null);
                      const clips: StyledClip[] = [];
                      for (const id of reelPick) {
                        const st = styleById(id)!;
                        let sh = sheets[id];
                        if (!sh) {
                          setBusy(`reel:${st.name}: drawing the style sheet`);
                          const r = await makeStill(styleSheetPrompt(st), "16:9");
                          if (!r.ok) { setBusy(null); if (r.needsKey) openKeys(); return setProblem(`${st.name}: ${r.reason} Stopped; ${clips.length} look${clips.length === 1 ? "" : "s"} done.`); }
                          sh = r.url;
                          setSheets((all) => ({ ...all, [id]: r.url }));
                        }
                        setBusy(`reel:${st.name}: redrawing the clip`);
                        const r = await runEdit({ tool: "kling", video, seconds: len, prompt: restylePrompt(st, prompt), references: [sh], resolution: restyleRes });
                        if (!r.ok) { setBusy(null); if (r.needsKey) openKeys(); return setProblem(`${st.name}: ${r.reason} Stopped; ${clips.length} look${clips.length === 1 ? "" : "s"} done.`); }
                        clips.push({ style: st, url: r.url, seconds: len, usd: r.usd });
                      }
                      const full = await createProjectStore(defaultKv()).load(project.id);
                      if (!full) { setBusy(null); return setProblem("The project couldn't be found to add the reel to."); }
                      const made = addStyleReel(full, `Style reel · ${clips.length} looks`, clips);
                      await createProjectStore(defaultKv()).save(made.project);
                      setBusy(null);
                      router.push(`/board/${project.id}/cut?b=${encodeURIComponent(made.board.id)}`);
                    }}>
                      {busy?.startsWith("reel:") ? busy.slice(5) : `Make the reel · ${reelPick.length} looks`}
                      <span className="cost">about {money(total)}</span>
                    </button>
                  </div>
                );
              })()}
              <p className="sh-note">Each look is redrawn on Comfy from this take, one at a time, and stops on the first problem. They land as a new board with each look named on screen.</p>
            </details>
            <div className="tools-run">
              <button className="fire" disabled={busy !== null || !sheet} onClick={() => void go("restyle", { tool: "kling", video, seconds: len, prompt: restylePrompt(style, prompt), references: [sheet!], resolution: restyleRes }, (r) => { take(shot, r.url, r.kind, r.usd, r.origin); setDone(`Redrawn as ${style.name}. It's a new take; the live action is still there.`); })}>
                {busy === "restyle" ? "Redrawing… this can take 10 minutes" : `Restyle this take as ${style.name}`}
                <span className="cost">about {money(quotes.restyle)}</span>
              </button>
            </div>
          </div>
        );
      })()}

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
