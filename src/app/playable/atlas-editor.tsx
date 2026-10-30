"use client";

import { useEffect, useRef, useState } from 'react';
import { atlasFrame, type SpriteAtlas } from '../../playable/atlas';
import type { Art } from '../../playable/spec';
import { atlasFiles } from './atlas-file';

type ArtChange = { [K in keyof Art]?: Art[K] | undefined };

export function AtlasEditor({ label, art, disabled, onApply, onBusy }: { label: string; art: Art; disabled: boolean; onApply: (change: ArtChange) => Promise<unknown>; onBusy: (busy: boolean) => void }) {
  const [png, setPng] = useState<File>();
  const [json, setJson] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState(false);
  const save = async (get: () => Promise<ArtChange>) => {
    setBusy(true); onBusy(true); setProblem(''); setSaved(false);
    try { await onApply(await get()); setSaved(true); }
    catch (e) { setProblem(e instanceof Error ? e.message : 'Could not save the atlas. Your previous art is unchanged.'); }
    finally { setBusy(false); onBusy(false); }
  };
  const blocked = busy || disabled;
  return <details className="pl-atlas" aria-label={`${label} Game Director atlas`}>
    <summary>Game Director animation · import free</summary>
    <p className="pl-sub">Choose atlas.png and atlas.json from Export Game Atlas. Files stay in this browser. PNG ≤ 2 MB, JSON ≤ 256 KB, up to 600 frames. Visual animation does not add game mechanics.</p>
    <label>Atlas PNG for {label}<input type="file" accept="image/png,.png" disabled={blocked} onChange={e => { setPng(e.target.files?.[0]); setSaved(false); }} /></label>
    <label>Atlas JSON for {label}<input type="file" accept="application/json,.json" disabled={blocked} onChange={e => { setJson(e.target.files?.[0]); setSaved(false); }} /></label>
    <button className="pl-ghost pl-small" disabled={blocked || !png || !json} onClick={() => void save(() => atlasFiles(png!, json!))}>{busy ? 'Saving animation…' : 'Import animation'}</button>
    {art.atlas && art.url && <>
      <AtlasPreview url={art.url} atlas={art.atlas} label={label} />
      <label>Action for {label}<select disabled={blocked} value={art.atlas.selected} onChange={e => { const selected = e.target.value; void save(async () => ({ atlas: { ...art.atlas!, selected } })); }}>
        {art.atlas.animations.map(a => <option key={a.name} value={a.name}>{a.name} · frames {a.start_frame}–{a.end_frame_exclusive - 1}</option>)}
      </select></label>
      <label><input type="checkbox" checked={art.atlas.loop} disabled={blocked} onChange={e => { const loop = e.target.checked; void save(async () => ({ atlas: { ...art.atlas!, loop } })); }} />Loop {label} animation</label>
      <p className="pl-sub">{art.atlas.frames.length} frames · {art.atlas.fps} FPS. Loops and action timing need your review. Without an alpha mask, source backgrounds remain.</p>
      <button className="pl-plain" disabled={blocked} onClick={() => void save(async () => ({ url: undefined, atlas: undefined }))}>Remove animation and use shape</button>
    </>}
    {problem && <p className="pl-problem" role="alert">{problem}</p>}
    {saved && <p role="status">Animation saved in this browser.</p>}
  </details>;
}

function AtlasPreview({ url, atlas, label }: { url: string; atlas: SpriteAtlas; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let live = true, request = 0;
    const image = new Image(); image.src = url;
    setProblem('');
    void image.decode().then(() => {
      if (!live) return;
      const start = performance.now();
      const draw = (now: number) => {
        if (!live) return;
        const f = atlasFrame(atlas, playing ? (now - start) / 1000 : 0);
        const ctx = canvas.current?.getContext('2d');
        if (ctx) { ctx.clearRect(0, 0, 192, 192); ctx.drawImage(image, f.x, f.y, f.width, f.height, 0, 0, 192, 192); }
        setFrame(f.frame);
        if (playing) request = requestAnimationFrame(draw);
      };
      draw(start);
    }).catch(() => { if (live) setProblem('The saved atlas image could not be decoded. Reimport the PNG.'); });
    return () => { live = false; cancelAnimationFrame(request); };
  }, [url, atlas, playing]);
  return <div className="pl-atlas-preview">
    <canvas ref={canvas} width={192} height={192} aria-label={`${label} atlas preview`} style={{maxWidth:'100%',background:'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 20px 20px'}} />
    <span className="pl-mono">Frame {frame} · {atlas.selected}</span>
    <button className="pl-plain" onClick={() => setPlaying(v => !v)}>{playing ? 'Show first frame' : 'Play preview'}</button>
    {problem && <p role="alert">{problem}</p>}
  </div>;
}
