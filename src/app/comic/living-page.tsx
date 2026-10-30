"use client";

import { useEffect, useRef, useState } from "react";
import { type LayoutId, type Panel, type Rect } from "../../comic/comic";
import { currentAnimation, type PanelAnimation } from "../../comic/living";
import { bookLayout, defaultAppearance, pageSvg, panelLetters, type Appearance } from "../../comic/appearance";
import styles from "./living-page.module.css";

export function LivingPage({ panels, pictures, animations, title, layout, appearance = defaultAppearance() }: { panels: Panel[]; pictures: Record<string, string>; animations: Record<string, PanelAnimation>; title: string; layout: LayoutId; appearance?: Appearance }) {
  const geometry = bookLayout(panels, layout, appearance);
  const background = pageSvg(panels.map(p => ({ ...p, caption: "", lines: [] })), pictures, layout, title, appearance);
  const [zoomed, setZoomed] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(query.matches); setActive(null); };
    update(); query.addEventListener("change", update);
    const hide = () => { if (document.hidden) setActive(null); };
    document.addEventListener("visibilitychange", hide);
    return () => { query.removeEventListener("change", update); document.removeEventListener("visibilitychange", hide); };
  }, []);
  return <section className={styles.reader} aria-label="Living comic reader">
    <div className={styles.toolbar}>
      <span>{reduced ? "Press a panel’s play button to animate." : "Hover or tap Play to bring a panel to life."}</span>
      <button type="button" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? "Fit page" : "Zoom page"}</button>
    </div>
    <div className={styles.viewport} tabIndex={0} aria-label="Comic page. Zoom to read small lettering.">
    <div className={`${styles.paper} ${zoomed ? styles.zoomed : ""}`}>
      <div className={styles.pageArt} aria-hidden="true" dangerouslySetInnerHTML={{ __html: background }} />
      <ol className={styles.grid} aria-label={title || "Your comic"}>
        {panels.map((panel, index) => <LivingPanel key={panel.id} panel={panel} index={index} rect={geometry.rects[index]!} pageWidth={geometry.width} pageHeight={geometry.height} appearance={appearance} animation={currentAnimation(animations[panel.id], pictures[panel.id])} active={active === panel.id} hover={!reduced} activate={() => setActive(panel.id)} stop={() => setActive(a => a === panel.id ? null : a)} toggle={() => setActive(a => a === panel.id ? null : panel.id)} />)}
      </ol>
    </div>
    </div>
  </section>;
}

function LivingPanel({ panel, index, rect, pageWidth, pageHeight, appearance, animation, active, hover, activate, stop, toggle }: { panel: Panel; index: number; rect: Rect; pageWidth: number; pageHeight: number; appearance: Appearance; animation: PanelAnimation | undefined; active: boolean; hover: boolean; activate: () => void; stop: () => void; toggle: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLLIElement>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setError(false); }, [animation?.url]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let cancelled = false;
    if (active) { setError(false); void v.play().catch(() => { if (!cancelled) { setError(true); stop(); } }); }
    else { v.pause(); v.currentTime = 0; setPlaying(false); }
    return () => { cancelled = true; v.pause(); };
  }, [active, animation?.url]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (!entry?.isIntersecting) stop(); });
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  return <li ref={frame} className={styles.panel} style={{ left: `${rect.x / pageWidth * 100}%`, top: `${rect.y / pageHeight * 100}%`, width: `${rect.w / pageWidth * 100}%`, height: `${rect.h / pageHeight * 100}%` }} onPointerEnter={e => { if (e.pointerType === "mouse" && hover && animation) activate(); }} onPointerLeave={e => { if (e.pointerType === "mouse") stop(); }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) stop(); }}>
    <div className={styles.art}>
      <span className={styles.srOnly}>Panel {index + 1}: {panel.action}. {panel.caption} {panel.lines.map(l => `${l.who}: ${l.text}`).join(" ")}</span>
      {animation && <video ref={video} src={animation.url} muted playsInline loop preload="none" aria-hidden="true" className={active && playing && !error ? styles.visible : styles.hidden} onPlaying={() => setPlaying(true)} onError={() => { setError(true); stop(); }} />}
      {animation && <button type="button" className={styles.play} aria-label={`${active ? "Pause" : "Play"} panel ${index + 1}`} aria-pressed={active} onClick={toggle}>{active ? "Ⅱ" : "▶"}</button>}
      <svg className={styles.lettering} viewBox={`0 0 ${rect.w} ${rect.h}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: panelLetters(panel, rect.w, rect.h, appearance) + `<rect x="${appearance.borderWidth/2}" y="${appearance.borderWidth/2}" width="${rect.w-appearance.borderWidth}" height="${rect.h-appearance.borderWidth}" fill="none" stroke="${appearance.border}" stroke-width="${appearance.borderWidth}"/>` }} />
      {error && <small className={styles.status} role="status">Clip unavailable. Press Play to retry.</small>}
    </div>
  </li>;
}
