"use client";

import { ALL_MODELS } from "../../catalog/models";
import type { Project } from "../../story/model";
import { creditsText, totalText } from "../../story/price-text";

/**
 * The Board as a table, as in the prototype: every shot with its words, its
 * picture, its clip, its voice lines, its model and what it cost or will cost.
 * Click a row to open the shot, same as on the flow.
 */

const modelName = (id: string) => ALL_MODELS.find((m) => m.id === id)?.name ?? id.split("/").at(-1) ?? id;

export function BoardTable({ project, selected, stale, rates, onSelect }: {
  project: Project;
  selected: string | null;
  stale: string[];
  rates: Record<string, { label: string }>;
  onSelect: (id: string) => void;
}) {
  const shots = project.shots;
  const pictures = shots.filter((s) => s.render).length;
  const clips = shots.filter((s) => s.render?.kind === "video").length;
  const lines = shots.reduce((n, s) => n + (s.voices?.length ?? 0), 0);
  const voiced = shots.reduce((n, s) => n + (s.voices?.filter((v) => v.url).length ?? 0), 0);
  const lens = [
    { n: "Shots", total: String(shots.length), note: `${stale.length} stale` },
    { n: "Pictures", total: `${pictures}/${shots.length}`, note: shots.length - pictures ? `${shots.length - pictures} to make` : "all made" },
    { n: "Clips", total: `${clips}/${shots.length}`, note: pictures - clips > 0 ? `${pictures - clips} stills to animate` : clips ? "all moving" : "none yet" },
    { n: "Voice", total: `${voiced}/${lines}`, note: lines ? "lines recorded" : "no lines yet" },
    { n: "Spent", total: totalText(shots.map((s) => s.render?.usd ?? 0)), note: "on this board" },
  ];
  return (
    <div className="bt">
      <div className="bt-lens">
        {lens.map((l) => (
          <div key={l.n}>
            <small>{l.n}</small>
            <b>{l.total}</b>
            <span>{l.note}</span>
          </div>
        ))}
      </div>
      <div className="bt-table" role="table" aria-label="Shots">
        <div className="bt-row bt-headrow" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Script</span>
          <span role="columnheader">Picture</span>
          <span role="columnheader">Clip</span>
          <span role="columnheader">Voice</span>
          <span role="columnheader">Model</span>
          <span role="columnheader" className="bt-price">Price</span>
        </div>
        {shots.map((s, i) => {
          const r = s.render;
          const isStale = stale.includes(s.id);
          return (
            <button key={s.id} role="row" className="bt-row" aria-selected={s.id === selected} onClick={() => onSelect(s.id)}>
              <span role="cell" className="bt-n">{String(i + 1).padStart(2, "0")}</span>
              <span role="cell" className="bt-script"><b>{s.heading || `Shot ${i + 1}`}</b><small>{s.beat || "No words yet"}</small></span>
              <span role="cell">{r?.kind === "image" ? <img src={r.url} alt="" loading="lazy" /> : r?.kind === "video" && s.startsFrom ? <img src={s.startsFrom.frameUrl} alt="" loading="lazy" /> : <i className="bt-empty">{r ? "—" : "to make"}</i>}{isStale && <em className="bt-stale">stale</em>}</span>
              <span role="cell">{r?.kind === "video" ? <video src={`${r.url}#t=0.3`} muted playsInline preload="metadata" /> : <i className="bt-empty">{r ? "still" : "—"}</i>}</span>
              <span role="cell" className="bt-voice">{s.voices?.length ? `${s.voices.filter((v) => v.url).length}/${s.voices.length}` : "—"}</span>
              <span role="cell" className="bt-model">{modelName(s.model.id)}</span>
              <span role="cell" className="bt-price">{r ? creditsText(r.usd) : rates[s.model.id]?.label ?? "on the button"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
