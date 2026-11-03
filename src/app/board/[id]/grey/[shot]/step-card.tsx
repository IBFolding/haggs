"use client";

import { useState, type ReactNode } from "react";

import { ASSET_DRAG } from "../../../../../story/grey-drop";
import { useFileDrop } from "../../../../drop-zone";
import { MoreOptions } from "./collapsible";

export type StepTile = {
  id: string; label: string; icon?: string; swatch?: string; on?: boolean; disabled?: boolean; onClick: () => void;
  /** Makes the tile a drop target: a picture from the desktop, or a card dragged from the mood board. */
  onFiles?: (files: File[]) => void;
  onAsset?: (payload: string) => void;
};

function Tile({ t }: { t: StepTile }) {
  const [over, setOver] = useState(false);
  const files = useFileDrop({ kinds: ["image"] }, (list) => t.onFiles?.(list), !t.onFiles || t.disabled === true);
  const accepts = (e: React.DragEvent) => Boolean(t.onAsset) && Array.from(e.dataTransfer?.types ?? []).includes(ASSET_DRAG);
  return (
    <div className={`gw-tile-wrap${files.active || over ? " over" : ""}`} onDragEnter={(e) => { if (accepts(e)) { e.preventDefault(); setOver(true); } else files.props.onDragEnter(e); }} onDragOver={(e) => { if (accepts(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } else files.props.onDragOver(e); }} onDragLeave={(e) => { if (accepts(e)) setOver(false); else files.props.onDragLeave(e); }} onDrop={(e) => { if (accepts(e)) { e.preventDefault(); e.stopPropagation(); setOver(false); t.onAsset!(e.dataTransfer.getData(ASSET_DRAG)); } else files.props.onDrop(e); }}>
      <button type="button" className={`gw-tile${t.on ? " on" : ""}`} aria-pressed={t.on === undefined ? undefined : t.on} disabled={t.disabled} onClick={t.onClick}>
        {t.swatch ? <i className="gw-swatch-tile" style={{ background: t.swatch }} aria-hidden="true" /> : t.icon && ICONS[t.icon] ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[t.icon]} /></svg> : null}
        <span>{t.label}</span>
      </button>
      {files.error && <p className="dz-error library-error" role="alert">{files.error}</p>}
    </div>
  );
}

const ICONS: Record<string, string> = {
  pick: "M5 4l14 7-6 2-2 6z",
  original: "M4 12a8 8 0 1 0 3-6.2M4 4v4h4",
  move: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  scale: "M5 19V9M5 19h10M5 19 19 5M14 5h5v5",
  rotate: "M20 12a8 8 0 1 1-3-6.2M20 4v4h-4",
  objects: "M4 20h16M6 20V10l6-5 6 5v10",
  actors: "M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 20c0-4 2.7-6 6-6s6 2 6 6",
  areas: "M4 4h16v16H4zM4 14h16M14 4v16",
  light: "M12 3v2M12 19v2M5 12H3M21 12h-2M7 7 5.6 5.6M18.4 5.6 17 7M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  draft: "M13 3 5 14h6l-1 7 8-11h-6z",
  final: "M5 12l4.5 4.5L19 7",
  upscale: "M4 14v6h6M20 10V4h-6M4 20 11 13M20 4l-7 7",
};

/** One focused card per step: a short line, one main action, a few big visual buttons, and the rest under More options. */
export function StepCard({ index, title, says, primary, tiles, areaTiles, open, onToggle, more, children }: {
  index: number;
  title: string;
  says: string;
  primary: { label: string; onClick: () => void; disabled?: boolean; note?: string | undefined };
  tiles: StepTile[];
  /** Named areas (floor, wall...) that can be picked or dropped on. */
  areaTiles?: StepTile[] | undefined;
  open: boolean;
  onToggle: () => void;
  more: ReactNode;
  children?: ReactNode;
}) {
  return (
    <aside className={`gw-right gw-stepcard${open ? "" : " folded"}`} aria-label="Controls">
      <div className="gw-card-head">
        <span className="gw-badge" aria-hidden="true">{index}</span>
        <div><h2>{title}</h2><p>{says}</p></div>
        <button type="button" className="gw-side-toggle" aria-expanded={open} onClick={onToggle} title={open ? "Fold the controls" : "Open the controls"} aria-label={open ? "Fold the controls" : "Open the controls"}>{open ? "»" : "«"}</button>
      </div>
      <div className="gw-card-body" hidden={!open}>
        <button type="button" className="fire gw-primary" disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</button>
        {primary.note && <p className="gs-soft">{primary.note}</p>}
        {tiles.length > 0 && (
          <div className={`gw-tiles cols-${Math.min(4, tiles.length)}`} role="group" aria-label={`${title} tools`}>
            {tiles.map((t) => <Tile key={t.id} t={t} />)}
          </div>
        )}
        {areaTiles && areaTiles.length > 0 && (
          <section className="gw-areas" aria-label="Floor, walls and other areas">
            <h3>Floor, walls and other areas</h3>
            <p className="gs-soft">Click one to pick it, then outline it. Or drop a picture on it to use as its material.</p>
            <div className="gw-tiles cols-4">{areaTiles.map((t) => <Tile key={t.id} t={t} />)}</div>
          </section>
        )}
        {children}
        <MoreOptions>{more}</MoreOptions>
      </div>
    </aside>
  );
}
