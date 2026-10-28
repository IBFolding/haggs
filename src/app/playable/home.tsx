"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { defaultKv } from "../../story/kv";
import { TEMPLATE_INFO, TEMPLATES, defaultSpec, type Shape, type Template } from "../../playable/spec";
import { createGameStore, type GameSummary } from "../../playable/store";
import { Nav, openKeys } from "../nav";
import { gameFromIdea } from "./actions";

const IDEAS = [
  "A snail racing across a rainy garden, hopping over puddles and picking up clover",
  "A lighthouse keeper's cat catching glowing fish on a dark beach while crabs scuttle about",
  "A bakery puzzle: line up croissants, buns and tarts before the morning rush",
  "A paper boat drifting down a city gutter, dodging leaves and collecting bottle caps",
];

function ago(at: number): string {
  const minutes = Math.round(Math.max(0, Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** A tiny picture of each template, drawn in CSS from its default art. */
function Preview({ template }: { template: Template }) {
  const spec = defaultSpec(template);
  const swatch = (color: string, shape: Shape, style: React.CSSProperties = {}) => <i className={`pl-shape pl-${shape}`} style={{ background: color, ...style }} />;
  if (spec.template === "match") {
    return (
      <div className="pl-preview pl-preview-match" style={{ background: `linear-gradient(160deg, ${spec.palette.sky}, ${spec.palette.ground})` }}>
        {Array.from({ length: 15 }, (_, i) => { const t = spec.art.tiles[(i * 7 + (i >> 2)) % spec.art.tiles.length]!; return <span key={i}>{swatch(t.color, t.shape)}</span>; })}
      </div>
    );
  }
  return (
    <div className={`pl-preview pl-preview-${template}`} style={{ background: `linear-gradient(180deg, ${spec.palette.sky}, ${spec.palette.ground})` }}>
      {spec.template === "runner" ? <div className="pl-preview-ground" style={{ background: spec.palette.ground, borderTopColor: spec.palette.accent }} /> : null}
      {swatch(spec.art.player.color, spec.art.player.shape, { left: template === "runner" ? "18%" : "46%", bottom: template === "runner" ? "30%" : "44%" })}
      {swatch(spec.art.hazard.color, spec.art.hazard.shape, { left: template === "runner" ? "62%" : "20%", bottom: template === "runner" ? "30%" : "20%" })}
      {swatch(spec.art.pickup.color, spec.art.pickup.shape, { left: template === "runner" ? "42%" : "74%", bottom: template === "runner" ? "62%" : "66%" })}
    </div>
  );
}

export function PlayableHome() {
  const router = useRouter();
  const store = useMemo(() => createGameStore(defaultKv()), []);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; needsKey?: boolean } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setGames(await store.list());
    } catch {
      setProblem({ text: "Storage is unavailable in this browser, so games can't be saved here." });
    } finally {
      setReady(true);
    }
  }, [store]);
  useEffect(() => { void refresh(); }, [refresh]);

  const startFrom = async (template: Template) => {
    const game = await store.create(defaultSpec(template), [{ who: "note", text: `Started from the ${TEMPLATE_INFO[template].name} template.`, at: Date.now() }]);
    router.push(`/playable/${game.id}`);
  };

  const make = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const answer = await gameFromIdea(idea).catch(() => ({ ok: false as const, reason: "Claude couldn't be reached. Try again." }));
    if (!answer.ok) {
      setProblem({ text: answer.reason, ...("needsKey" in answer && answer.needsKey ? { needsKey: true } : {}) });
      setBusy(false);
      return;
    }
    const at = Date.now();
    const game = await store.create(answer.spec, [{ who: "you", text: idea.trim(), at }, { who: "claude", text: answer.said, at }]);
    router.push(`/playable/${game.id}`);
  };

  const remove = async (summary: GameSummary) => {
    if (!window.confirm(`Delete “${summary.title}”? This can't be undone.`)) return;
    await store.remove(summary.id);
    await refresh();
  };

  return (
    <div className="app">
      <Nav current="Playable" />
      <div className="canvas pl-page">
        <section className="pl-hero">
          <span className="pl-eyebrow">Playable · beta</span>
          <h1>Describe a game.<br /><em>Play it.</em></h1>
          <p>Say what it&apos;s about and get a small game you can play right here. Change it by chatting, then make its art on Comfy, with the price shown before anything runs.</p>
          <div className="pl-composer">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void make(); }}
              placeholder="A fox collecting acorns in an autumn forest, avoiding hunters' traps…"
              rows={3}
              maxLength={2000}
              aria-label="Your game idea"
            />
            <div className="pl-composer-bar">
              <span className="pl-mono">Claude on your key · no credits</span>
              <button className="pl-go" onClick={() => void make()} disabled={busy || idea.trim().length < 4}>{busy ? "Designing…" : "Make game"}</button>
            </div>
          </div>
          <div className="pl-ideas">
            {IDEAS.map((text) => <button key={text} className="pl-chip" onClick={() => setIdea(text)}>{text}</button>)}
          </div>
          {problem ? (
            <p className="pl-problem" role="alert">
              {problem.text}
              {problem.needsKey ? <button className="pl-ghost pl-small" onClick={openKeys}>Add a Claude key</button> : null}
            </p>
          ) : null}
        </section>

        <section className="pl-section">
          <h2>Start from a template</h2>
          <p className="pl-sub">No key needed. Each one plays with placeholder shapes until you make its art.</p>
          <div className="pl-grid">
            {TEMPLATES.map((t) => (
              <button key={t} className="pl-card pl-template" onClick={() => void startFrom(t)}>
                <Preview template={t} />
                <span className="pl-eyebrow">{TEMPLATE_INFO[t].genre}</span>
                <strong>{defaultSpec(t).title}</strong>
                <span className="pl-card-says">{TEMPLATE_INFO[t].says}</span>
                <span className="pl-mono">{TEMPLATE_INFO[t].controls}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pl-section">
          <h2>Your games</h2>
          {!ready ? null : games.length === 0 ? (
            <p className="pl-sub">Nothing yet. Games are kept in this browser.</p>
          ) : (
            <div className="pl-grid">
              {games.map((g) => (
                <div key={g.id} className="pl-card pl-saved">
                  <Link href={`/playable/${g.id}`} className="pl-saved-cover" style={g.cover ? { backgroundImage: `url("${g.cover}")` } : { background: `linear-gradient(150deg, ${g.accent}55, var(--surface))` }} aria-label={`Open ${g.title}`} />
                  <div className="pl-saved-row">
                    <Link href={`/playable/${g.id}`} className="pl-saved-name">{g.title}</Link>
                    <button className="pl-plain" onClick={() => void remove(g)}>Delete</button>
                  </div>
                  <span className="pl-mono">{TEMPLATE_INFO[g.template].name} · {ago(g.updatedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
