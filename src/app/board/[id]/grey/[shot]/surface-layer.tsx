"use client";

import { useEffect, useRef } from "react";

import type { Surface } from "../../../../../story/grey-scene";

/**
 * A wall or floor from the footage wearing a new material. The cut-out of the
 * surface is drawn, the texture is blended into it, and the surface's own
 * shape is kept, frame by frame, so it follows the playhead.
 */
export function SurfaceLayer({ surface, time, playing }: { surface: Surface; time: number; playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const still = useRef<HTMLImageElement>(null);
  const tex = useRef<HTMLImageElement | null>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const lastUrl = useRef("");
  const url = surface.texture?.url ?? "";

  const paint = () => {
    const v = surface.mask?.kind === "image" ? still.current : video.current, c = canvas.current, img = tex.current;
    if (!v || !c || !img || !img.complete || !img.naturalWidth) return;
    const isImage = v instanceof HTMLImageElement;
    if (isImage ? !v.complete || !v.naturalWidth : v.readyState < 2 || !v.videoWidth) return;
    const width = isImage ? v.naturalWidth : v.videoWidth;
    const height = isImage ? v.naturalHeight : v.videoHeight;
    if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
    const w = (work.current ??= document.createElement("canvas"));
    w.width = c.width; w.height = c.height;
    const a = w.getContext("2d"), o = c.getContext("2d");
    if (!a || !o) return;
    // The surface, then the texture blended into it, then the surface's own outline put back.
    a.clearRect(0, 0, w.width, w.height);
    a.drawImage(v, 0, 0);
    a.globalCompositeOperation = "overlay";
    const pat = a.createPattern(img, "repeat");
    if (pat) {
      const k = (w.width * 0.25 * (surface.texture?.scale ?? 1)) / img.naturalWidth;
      pat.setTransform(new DOMMatrix().scale(k));
      a.fillStyle = pat;
      a.fillRect(0, 0, w.width, w.height);
    }
    a.globalCompositeOperation = "destination-in";
    a.drawImage(v, 0, 0);
    a.globalCompositeOperation = "source-over";
    o.clearRect(0, 0, c.width, c.height);
    o.globalAlpha = 1;
    o.drawImage(v, 0, 0);
    o.globalAlpha = surface.strength;
    o.drawImage(w, 0, 0);
    o.globalAlpha = 1;
  };

  useEffect(() => {
    if (url && url !== lastUrl.current) {
      lastUrl.current = url;
      const img = new Image();
      img.onload = () => paint();
      img.src = url;
      tex.current = img;
    }
  }, [url]);

  useEffect(() => {
    if (surface.mask?.kind === "image") { paint(); return; }
    const v = video.current;
    if (!v) return;
    if (!playing) {
      v.pause();
      if (Math.abs(v.currentTime - time) > 0.04) v.currentTime = Math.min(time, Math.max(0, (v.duration || time) - 0.01));
      else paint();
      return;
    }
    void v.play().catch(() => undefined);
    let raf = 0;
    const tick = () => { paint(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, playing ? 0 : time, surface.strength, surface.texture?.scale, surface.mask?.url, surface.mask?.kind]);

  if (!surface.mask) return null;
  return (
    <>
      {surface.mask.kind === "image" ? <img ref={still} className="cp-hidden" src={surface.mask.url} alt="" onLoad={paint} /> : <video ref={video} className="cp-hidden" src={surface.mask.url} muted playsInline loop onSeeked={paint} onLoadedData={paint} />}
      <canvas ref={canvas} className="cp-actor cp-surface" />
    </>
  );
}
