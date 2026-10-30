"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { keyOut } from "../../playable/art";
import { SIZES, srcdoc } from "../../playable/kit";
import type { CodeSpec } from "../../playable/spec";

/** Where made pictures live when they can't be handed over as data: this site and Vercel Blob. */
const hostsHere = () => [window.location.origin, "https://*.public.blob.vercel-storage.com"];

/**
 * A made picture as a data link for the game: sprites keyed (the magenta
 * behind them made transparent), backgrounds as they are. A picture whose
 * pixels can't be read is handed over by its link instead, unkeyed.
 */
async function framePicture(url: string, sprite: boolean): Promise<string> {
  if (url.startsWith("data:") && !sprite) return url;
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    const most = sprite ? 512 : 1280;
    const scale = Math.min(1, most / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (!sprite) return canvas.toDataURL("image/jpeg", 0.86);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    keyOut(data.data);
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return url;
  }
}

type FromGame = { haggs?: boolean; type?: string; message?: string; line?: number; score?: number; won?: boolean };

/**
 * A code game, playing. It runs in a sandboxed frame (scripts only, never the
 * site's origin) built by `srcdoc`, and talks back by message: a bug, the
 * score, the end. Replay starts it fresh; a changed game or new art reloads it.
 */
export function CodeFrame({ spec, onBug }: { spec: CodeSpec; onBug: (message: string | null) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pictures, setPictures] = useState<Record<string, string> | null>(null);
  const [run, setRun] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [ended, setEnded] = useState<{ won: boolean; score: number } | null>(null);

  const made = spec.art.assets.filter((a) => a.url).map((a) => `${a.id}=${a.url!}:${Boolean(a.atlas)}`).join("|");
  useEffect(() => {
    let live = true;
    void Promise.all(spec.art.assets.filter((a) => a.url).map(async (a) => [a.id, a.atlas ? a.url! : await framePicture(a.url!, a.kind === "sprite")] as const)).then((pairs) => {
      if (live) setPictures(Object.fromEntries(pairs));
    });
    return () => { live = false; };
    // The links, not the spec object: a chat edit that keeps the art keeps the pictures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [made]);

  const doc = useMemo(() => (pictures ? srcdoc(spec, pictures, hostsHere()) : null), [spec, pictures]);

  useEffect(() => {
    onBug(null);
    setScore(null);
    setEnded(null);
  }, [doc, run, onBug]);

  useEffect(() => {
    const listen = (e: MessageEvent<FromGame>) => {
      if (e.source !== frameRef.current?.contentWindow || !e.data?.haggs) return;
      if (e.data.type === "error") onBug(`${e.data.message ?? "Something went wrong."}${e.data.line ? ` (line ${e.data.line})` : ""}`);
      if (e.data.type === "score" && typeof e.data.score === "number") setScore(e.data.score);
      if (e.data.type === "end") setEnded({ won: Boolean(e.data.won), score: Number(e.data.score) || 0 });
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [onBug]);

  const [w, h] = SIZES[spec.aspect];
  return (
    <div className="pl-stage">
      <div ref={wrapRef} className="pl-code-wrap" style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(78vh * ${w} / ${h}))` }}>
        {doc ? (
          <iframe ref={frameRef} key={run} className="pl-code-frame" title={spec.title} sandbox="allow-scripts" allow="autoplay; fullscreen" srcDoc={doc} />
        ) : (
          <div className="pl-code-loading">Getting the pictures ready…</div>
        )}
      </div>
      <div className="pl-stage-bar">
        <span className="pl-mono">{spec.controls}{score !== null ? ` · score ${score}` : ""}{ended ? ` · ${ended.won ? "won" : "lost"}` : ""}</span>
        <button className="pl-ghost pl-small" onClick={() => void wrapRef.current?.requestFullscreen?.().catch(() => undefined)}>Full screen</button>
        <button className="pl-ghost pl-small" onClick={() => setRun((n) => n + 1)}>Replay</button>
      </div>
    </div>
  );
}
