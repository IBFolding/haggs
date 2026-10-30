"use client";
import { useEffect, useRef, useState } from "react";
import { validSelection, type AreaPoint, type AreaSelection } from "../../../../../story/grey-selection";
import { uploadFile } from "../../../../upload-client";

/** Manual photo selection creates a real RGBA surface cut-out without model calls. */
export function AreaSelector({ source, label, video = false, start = 0, onClose, onSave }: { video?: boolean; start?: number; source: string; label: string; onClose: () => void; onSave: (url: string, selection: AreaSelection) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const clip = useRef<HTMLVideoElement>(null);
  const [points, setPoints] = useState<AreaPoint[]>([]);
  const [cursor, setCursor] = useState<AreaPoint>({ x: 0.5, y: 0.5 });
  const [aspect, setAspect] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save() {
    const selection = { points, aspect }, img = video ? clip.current : image.current;
    if (!img || !validSelection(selection)) return;
    setBusy(true); setError(null);
    try {
      const canvas = document.createElement("canvas"); canvas.width = img instanceof HTMLVideoElement ? img.videoWidth : img.naturalWidth; canvas.height = img instanceof HTMLVideoElement ? img.videoHeight : img.naturalHeight;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("This browser cannot create a selection.");
      ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x * canvas.width, p.y * canvas.height) : ctx.moveTo(p.x * canvas.width, p.y * canvas.height)); ctx.closePath(); ctx.clip(); ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("The selection could not be saved.")), "image/png"));
      const result = await uploadFile(new File([blob], `${label.toLowerCase()}-selection.png`, { type: "image/png" }));
      if (!result.ok) throw new Error(result.reason);
      onSave(result.url, selection); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "The selection could not be saved."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="gs-area-dialog" aria-labelledby="gs-area-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <header><div><span className="gs-board-kicker">EDIT ONLY WHAT YOU SELECT</span><h2 id="gs-area-title">Outline the {label.toLowerCase()}</h2></div><button className="pill" disabled={busy} onClick={onClose}>Cancel</button></header>
    <p>{video && <strong>Static area on the first frame of this cut. It stays fixed throughout the clip; it does not track moving objects or cameras. </strong>}Click around the area's edge. Add at least three points. Everything outside your outline stays untouched. Keyboard: focus the photo, use arrow keys to move, and Enter to add a point.</p>
    <div className="gs-area-image" role="application" tabIndex={0} aria-label="Area selection canvas. Arrow keys move the cursor. Enter adds a point." onKeyDown={e => {
      if (busy || !aspect) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPoints(p => [...p, cursor].slice(0, 80)); }
      else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); const step = e.shiftKey ? .05 : .01; setCursor(p => ({ x: Math.max(0, Math.min(1, p.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0))), y: Math.max(0, Math.min(1, p.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0))) })); }
    }} style={aspect ? { width: `min(100%, ${60 * aspect}vh)` } : undefined} onClick={e => { if (!aspect || busy) return; const r = e.currentTarget.getBoundingClientRect(); setPoints(p => [...p, { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }].slice(0, 80)); }}>
      {video ? <video ref={clip} crossOrigin="anonymous" src={source} muted playsInline onLoadedMetadata={e=>{e.currentTarget.currentTime=start;}} onLoadedData={e=>{if(start===0)setAspect(e.currentTarget.videoWidth/e.currentTarget.videoHeight);}} onSeeked={e=>setAspect(e.currentTarget.videoWidth/e.currentTarget.videoHeight)} onError={()=>setError("This clip could not be loaded for selection. Upload a local copy and try again.")} /> : (<img ref={image} crossOrigin="anonymous" src={source} alt={`Select the ${label.toLowerCase()} in this photo`} onLoad={e => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} onError={() => setError("This photo could not be loaded for selection. Upload a copy to your project and try again.")} />)}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={points.map(p => `${p.x * 100},${p.y * 100}`).join(" ")} />{points.map((p, i) => <circle key={i} cx={p.x * 100} cy={p.y * 100} r="0.7" />)}<circle className="gs-area-cursor" cx={cursor.x * 100} cy={cursor.y * 100} r="1" /></svg>
    </div>
    <div className="gs-row"><span role="status">{points.length} points</span><button className="pill" disabled={!points.length || busy} onClick={() => setPoints(p => p.slice(0, -1))}>Undo point</button><button className="plain" disabled={!points.length || busy} onClick={() => setPoints([])}>Start over</button><button className="fire" disabled={busy || !validSelection({ points, aspect })} onClick={() => void save()}>{busy ? "Saving selection…" : "Use this area"}</button></div>
    {error && <p role="alert" className="library-error">{error}</p>}
    <small>Manual selection · no generation credits. The cut-out is saved with your project media.</small>
  </dialog>;
}
