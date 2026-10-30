"use client";

import { loadAtlasDemo } from "./atlas-demo";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { defaultKv, idbKv } from "../../story/kv";
import { type SentGame } from "../../playable/claude";
import { GENRES, mcpCodeAsk, readCodeReply, type Quality } from "../../playable/code";
import { FEATURED, type Featured } from "../../playable/featured";
import { TEMPLATE_INFO, TEMPLATES, controlsOf, defaultSpec, genreOf, ruleChips, withArt, type GameSpec, type Shape, type Template, type TemplateSpec } from "../../playable/spec";
import { createGameStore, type GameSummary } from "../../playable/store";
import { Nav, openKeys } from "../nav";
import { BankPicker } from "../bank-picker";
import { QualitySwitch } from "./quality-switch";
import { pictureFile } from "./picture-file";
import { McpAsk, useSentGames } from "./sent";
import { writeGame } from "./write";

const IDEAS = [
  "Garden gnomes hold the vegetable patch against waves of snails: build and upgrade defences between waves",
  "A tiny ship clears asteroid fields to rescue stranded robots, with power-ups and a boss at the end",
  "A sock escapes a washing machine: a platformer through the spin cycle, the lint trap and the drain",
  "Gather a parade of penguins, pick the right gates to grow the crowd, and smash through the ice wall",
];

/** A picture the player brings to a new game: Claude names an asset after it, and the art follows it. */
type Reference = { id: string; label: string; image: string };
const slug = (name: string, taken: Set<string>) => {
  const base = `ref-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "picture"}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
};

function ago(at: number): string {
  const minutes = Math.round(Math.max(0, Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** A tiny picture of a game: a code game shows its cast as emoji over its colours; a template game its placeholder shapes. */
function Preview({ spec }: { spec: GameSpec }) {
  if (spec.template === "code") {
    const cast = spec.art.assets.filter((a) => a.kind === "sprite" && a.emoji).slice(0, 5);
    const place = spec.art.assets.find((a) => a.kind === "background" && a.emoji);
    return (
      <div className="pl-preview pl-preview-code" style={{ background: `radial-gradient(120% 90% at 50% 0%, ${spec.palette.ground}, ${spec.palette.sky})` }}>
        {place ? <span className="pl-preview-place" aria-hidden>{place.emoji}</span> : null}
        {cast.map((a, i) => <span key={a.id} className="pl-preview-emoji" style={{ left: `${12 + i * 19}%`, top: `${30 + ((i * 37) % 40)}%`, fontSize: i === 0 ? 42 : 30 }} aria-hidden>{a.emoji}</span>)}
        <span className="pl-preview-badge">{spec.three ? "3D · Claude" : "Written by Claude"}</span>
      </div>
    );
  }
  return <TemplatePreview spec={spec} />;
}

function TemplatePreview({ spec }: { spec: TemplateSpec }) {
  const template = spec.template;
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
  const [ask, setAsk] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality>("quality");
  const [three, setThree] = useState(false);
  const [lines, setLines] = useState(0);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [picking, setPicking] = useState(false);
  const addRef = (label: string, image: string) => setRefs((all) => (all.length >= 8 ? all : [...all, { id: slug(label, new Set(all.map((r) => r.id))), label, image }]));
  const { sent, drop } = useSentGames();
  const fresh = sent.filter((s) => !s.game);

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

  const startAtlasDemo = async () => {
    if (busy) return;
    setBusy(true); setProblem(null);
    try {
      const spec = await loadAtlasDemo();
      const saved = await createGameStore(idbKv()).create(spec, [{ who: "note", text: "Imported supplied deterministic Game Director atlas samples. No H3 inference was run.", at: Date.now() }]);
      router.push(`/playable/${saved.id}`);
    } catch (e) { setProblem({ text: e instanceof Error ? e.message : "Could not save the atlas demo. Enable browser storage and try again." }); }
    finally { setBusy(false); }
  };

  const startFrom = async (template: Template) => {
    const game = await store.create(defaultSpec(template), [{ who: "note", text: `Started from the ${TEMPLATE_INFO[template].name} template.`, at: Date.now() }]);
    router.push(`/playable/${game.id}`);
  };

  const make = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setAsk(null);
    setLines(0);
    const brief = { idea, ...(genre ? { genre } : {}), three };
    const written = await writeGame({ mode: "idea", quality, ...brief, references: refs.map(({ id, label }) => ({ id, label })) }, setLines);
    let made: { spec: GameSpec; said: string } | null = null;
    let reason = written.ok ? "" : written.reason;
    if (written.ok) {
      try {
        made = readCodeReply(written.text, { three });
      } catch (caught) {
        reason = caught instanceof Error ? caught.message : "Claude's reply couldn't be read.";
      }
    }
    if (!made) {
      const needsKey = !written.ok && Boolean(written.needsKey);
      setProblem({ text: reason, ...(needsKey ? { needsKey: true } : {}) });
      // On your own computer the connected Claude can make it over MCP instead, and send it here.
      if (needsKey && process.env.NODE_ENV !== "production") setAsk(mcpCodeAsk(brief));
      setBusy(false);
      return;
    }
    // The pictures you brought go on the assets Claude named after them.
    let spec = made.spec;
    for (const r of refs) spec = withArt(spec, `assets.${r.id}`, { ref: r.image });
    const at = Date.now();
    const game = await store.create(spec, [{ who: "you", text: idea.trim(), at }, { who: "claude", text: made.said, at }]);
    router.push(`/playable/${game.id}`);
  };

  const playFeatured = async (f: Featured) => {
    const game = await store.create(structuredClone(f.spec), [{ who: "note", text: `Started from ${f.spec.title}, a featured game. Change anything by chatting.`, at: Date.now() }]);
    router.push(`/playable/${game.id}`);
  };

  const applySent = async (s: SentGame) => {
    const game = await store.create(s.spec, [{ who: "claude", text: s.said, at: Date.now() }]);
    drop(s.id);
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
        <section className="pl-section" aria-label="Featured games">
          <h2>Featured games</h2>
          <p className="pl-sub">Jump into a finished game. No key needed to play.</p>
          <Link className="pl-card pl-template pl-neon-feature" href="/playable/neon-courier" aria-label="Play Neon Courier">
            <span className="pl-neon-scene" role="img" aria-label="The fox courier racing through the illuminated city from the game">
              <span className="pl-neon-fox" aria-hidden="true" />
              <span className="pl-preview-badge">Featured · Tap arcade</span>
            </span>
            <span className="pl-neon-copy">
              <span className="pl-eyebrow">One fox. One night shift.</span>
              <strong>Neon Courier</strong>
              <span className="pl-card-says">Race the neon skyline. Collect crystals, dodge drones, and build your rush in a sixty-second delivery run.</span>
              <span className="pl-go">Play now ↗</span>
              <span className="pl-mono">Tap a lane · Arrow keys or Space · Free to play</span>
            </span>
          </Link>
          <div className="pl-grid">
            {FEATURED.map((f) => (
              <button key={f.id} className="pl-card pl-template" onClick={() => void playFeatured(f)}>
                {f.cover ? <span className="pl-preview pl-cover"><img src={f.cover} alt="" loading="lazy" /><span className="pl-preview-badge">{f.spec.template === "code" && f.spec.three ? "3D · Claude" : "Written by Claude"}</span></span> : <Preview spec={f.spec} />}
                <span className="pl-eyebrow">{genreOf(f.spec)}</span>
                <strong>{f.spec.title}</strong>
                <span className="pl-card-says">{f.spec.pitch}</span>
                <span className="pl-mono">Play · {controlsOf(f.spec)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pl-panel" aria-label="Game Director animations">
          <h2>Bring Game Director sprites into Playable</h2>
          <p>Import atlas.png and atlas.json into a sprite slot in the Art panel. Choose an action, preview its frames, then play. No generation charge.</p>
          <button className="pl-go" disabled={busy} onClick={() => void startAtlasDemo()}>Try Game Director atlas demo · free</button>
          <p className="pl-sub">Uses supplied deterministic pose and VFX exports, not H3 renders. <Link href="/workflows/game-director/PLAYABLE-ASSESSMENT.md">Supported outputs and limits</Link></p>
        </section>
        <section className="pl-hero">
          <span className="pl-eyebrow">Playable · beta</span>
          <h1>Describe a game.<br /><em>Play it.</em></h1>
          <p>Say what it&apos;s about and Claude writes the whole game: rules, levels and every picture it needs. Play it right here, change it by chatting, then make its art on Comfy, with the price shown before anything runs.</p>
          <div className="pl-composer">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void make(); }}
              placeholder="A fox collecting acorns in an autumn forest, avoiding hunters' traps…"
              rows={3}
              maxLength={3000}
              aria-label="Your game idea"
            />
            {refs.length ? (
              <div className="pl-refs">
                {refs.map((r) => (
                  <span key={r.id} className="pl-ref-chip"><img src={r.image} alt="" />{r.label}<button className="pl-plain" aria-label={`Remove ${r.label}`} onClick={() => setRefs((all) => all.filter((x) => x.id !== r.id))}>×</button></span>
                ))}
              </div>
            ) : null}
            <div className="pl-composer-bar">
              <div className="pl-switches">
                <button className="pl-plain" onClick={() => setPicking(true)}>Add reference</button>
                <label className="pl-plain pl-upload">
                  Upload
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pictureFile(f, "sprite").then((img) => addRef(f.name.replace(/\.[a-z]+$/i, ""), img), (err: unknown) => setProblem({ text: err instanceof Error ? err.message : "That picture couldn't be used." })); }} />
                </label>
                <QualitySwitch value={quality} onChange={setQuality} />
                <button className="pl-chip" aria-pressed={three} onClick={() => setThree((v) => !v)} title="three.js, with your art on simple 3D shapes">3D · beta</button>
              </div>
              <button className="pl-go" onClick={() => void make()} disabled={busy || idea.trim().length < 4}>{busy ? (lines ? `Writing… ${lines} lines` : "Designing…") : "Make game"}</button>
            </div>
            <span className="pl-mono">Claude writes it on your key · art is priced before you make it{busy ? " · this takes a minute or two" : ""}</span>
          </div>
          <div className="pl-ideas" role="group" aria-label="Genre">
            {GENRES.map((g) => <button key={g} className="pl-chip" aria-pressed={genre === g} onClick={() => setGenre((v) => (v === g ? null : g))}>{g}</button>)}
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
          {ask ? <McpAsk text={ask} /> : null}
          {picking ? (
            <BankPicker
              kinds={["character", "place", "accessory"]}
              label="A picture for your game"
              allowPhotoBuild={false}
              onClose={() => setPicking(false)}
              onPick={(item) => {
                setPicking(false);
                if (!item.image) return setProblem({ text: `${item.name} has no picture yet. Make one first, or upload a picture.` });
                addRef(item.name, item.image);
              }}
            />
          ) : null}
        </section>

        {fresh.length > 0 ? (
          <section className="pl-section" aria-label="From Claude">
            <h2>From Claude</h2>
            <p className="pl-sub">Sent over MCP. Nothing is saved until you apply it.</p>
            <div className="pl-grid">
              {fresh.map((s) => (
                <div key={s.id} className="pl-card pl-sent">
                  <span className="pl-eyebrow">{genreOf(s.spec)}</span>
                  <strong>{s.spec.title}</strong>
                  <span className="pl-card-says">{s.summary}</span>
                  <span className="pl-mono">{ruleChips(s.spec).slice(0, 3).join(" · ")}</span>
                  <div className="pl-saved-row">
                    <button className="pl-go pl-small" onClick={() => void applySent(s)}>Apply</button>
                    <button className="pl-plain" onClick={() => drop(s.id)}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}


        <section className="pl-section">
          <h2>Quick start</h2>
          <p className="pl-sub">No key needed. Each one plays with placeholder shapes until you make its art.</p>
          <div className="pl-grid">
            {TEMPLATES.map((t) => (
              <button key={t} className="pl-card pl-template" onClick={() => void startFrom(t)}>
                <Preview spec={defaultSpec(t)} />
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
                  <span className="pl-mono">{g.template === "code" ? "Written by Claude" : TEMPLATE_INFO[g.template].name} · {ago(g.updatedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
