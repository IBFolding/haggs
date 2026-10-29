"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultKv } from "../../../story/kv";
import { creditsText, totalText } from "../../../story/price-text";
import { mcpEditAsk, type SentGame } from "../../../playable/claude";
import { readCodeReply, type Quality } from "../../../playable/code";
import { bare, forArt, genreOf, keepMadeArt, readSpec, ruleChips, slotsOf, withArt, type CodeSpec, type GameSpec, type Slot } from "../../../playable/spec";
import { createGameStore, type ChatLine, type SavedGame } from "../../../playable/store";
import { Nav, openKeys } from "../../nav";
import { editGame, makeArt, quoteArt, type ArtQuote } from "../actions";
import { BankPicker, useReturnedPick } from "../../bank-picker";
import { CodeFrame } from "../code-frame";
import { GameCanvas } from "../game-canvas";
import { pictureFile } from "../picture-file";
import { McpAsk, useSentGames } from "../sent";
import { QualitySwitch } from "../quality-switch";
import { writeGame } from "../write";

const line = (who: ChatLine["who"], text: string): ChatLine => ({ who, text, at: Date.now() });

export function Studio({ id }: { id: string }) {
  const store = useMemo(() => createGameStore(defaultKv()), []);
  const [game, setGame] = useState<SavedGame | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [thinking, setThinking] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const { sent, drop } = useSentGames();
  const mine = sent.filter((s) => s.game === id);
  const [quality, setQuality] = useState<Quality>("quality");
  const [lines, setLines] = useState(0);
  const [bug, setBug] = useState<string | null>(null);
  const onBug = useCallback((m: string | null) => setBug(m), []);

  useEffect(() => {
    store.get(id).then((g) => setGame(g ?? null), () => setGame(null));
  }, [id, store]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest" }); }, [game?.chat.length, mine.length]);

  /** A code game rewritten by Claude on your key, streamed; made art stays where its asset didn't change. */
  const rewrite = async (spec: CodeSpec, body: { mode: "edit"; message: string } | { mode: "fix"; error: string }) => {
    setLines(0);
    const written = await writeGame({ ...body, quality, game: bare(spec) }, setLines);
    if (!written.ok) return { ok: false as const, reason: written.reason, ...(written.needsKey ? { needsKey: true } : {}) };
    try {
      const reply = readCodeReply(written.text, { three: spec.three, before: spec });
      return { ok: true as const, spec: reply.spec, said: reply.said };
    } catch (caught) {
      return { ok: false as const, reason: caught instanceof Error ? caught.message : "Claude's reply couldn't be read." };
    }
  };

  const send = async () => {
    const text = message.trim();
    if (!game || !text || thinking) return;
    setThinking(true);
    setMessage("");
    const spec = game.spec;
    const answer = await (spec.template === "code" ? rewrite(spec, { mode: "edit", message: text }) : editGame(bare(spec), text)).catch(() => ({ ok: false as const, reason: "Claude couldn't be reached. Try again." }));
    const keyless = !answer.ok && "needsKey" in answer && Boolean(answer.needsKey);
    // On your own computer the connected Claude can change it over MCP instead, and send it here.
    setAsk(keyless && process.env.NODE_ENV !== "production" ? mcpEditAsk(game.id, bare(game.spec), text) : null);
    const next = answer.ok
      ? await store.change(game.id, keepMadeArt(game.spec, answer.spec), line("you", text), line("claude", answer.said))
      : await store.say(game.id, line("you", text), line("note", answer.reason));
    setNeedsKey(keyless);
    if (next) setGame(next);
    setThinking(false);
  };

  /** One round of Claude reading the bug and fixing the game. */
  const fixBug = async () => {
    if (!game || game.spec.template !== "code" || !bug || thinking) return;
    setThinking(true);
    const error = bug;
    const answer = await rewrite(game.spec, { mode: "fix", error });
    const next = answer.ok
      ? await store.change(game.id, answer.spec, line("note", `Asked Claude to fix: ${error}`), line("claude", answer.said))
      : await store.say(game.id, line("note", answer.reason));
    const keyless = !answer.ok && "needsKey" in answer && Boolean(answer.needsKey);
    setNeedsKey(keyless);
    // On your own computer the connected Claude can fix it over MCP instead.
    if (keyless && process.env.NODE_ENV !== "production") setAsk(mcpEditAsk(game.id, bare(game.spec), `Fix this bug: ${error}`));
    if (next) setGame(next);
    setThinking(false);
  };

  /** A change Claude sent over MCP; art already made stays where the prompt didn't change. */
  const applySent = async (s: SentGame) => {
    if (!game) return;
    const next = await store.change(game.id, keepMadeArt(game.spec, s.spec), line("claude", s.said));
    drop(s.id);
    setAsk(null);
    if (next) setGame(next);
  };

  const undo = async () => {
    if (!game) return;
    const next = await store.undo(game.id);
    if (next) setGame(next);
  };

  /** Art and hand edits are spec changes too, so they can be undone like a chat edit. */
  const changeSpec = useCallback(async (spec: GameSpec, note?: string) => {
    const next = await store.change(id, spec, ...(note ? [line("note", note)] : []));
    if (next) setGame(next);
    return next;
  }, [id, store]);

  if (game === undefined) return <div className="app"><Nav current="Playable" /><div className="canvas pl-page" /></div>;
  if (game === null) {
    return (
      <div className="app">
        <Nav current="Playable" />
        <div className="canvas pl-page">
          <section className="pl-hero">
            <h1>Game not found</h1>
            <p>It may have been deleted, or it was made in another browser. Games are kept in the browser they were made in.</p>
            <Link className="pl-go pl-inline" href="/playable">Back to Playable</Link>
          </section>
        </div>
      </div>
    );
  }

  const spec = game.spec;
  const genre = genreOf(spec);
  return (
    <div className="app">
      <Nav current="Playable" />
      <div className="canvas pl-page pl-studio-page">
        <header className="pl-studio-head">
          <Link href="/playable" className="pl-back">← Playable</Link>
          <h1>{spec.title}</h1>
          <span className="pl-badge">{genre}</span>
        </header>
        <div className="pl-studio">
          <aside className="pl-panel pl-chat" aria-label="Chat">
            <h2>Change it by chatting</h2>
            <div className="pl-log">
              {game.chat.length === 0 ? <p className="pl-sub">Say what to change: faster, harder, a different hero, a winter theme, a different kind of game.</p> : null}
              {game.chat.map((l, i) => <p key={i} className={`pl-line pl-${l.who}`}>{l.text}</p>)}
              {thinking ? <p className="pl-line pl-claude pl-thinking">{spec.template === "code" ? `Changing the game… ${lines ? `${lines} lines` : "thinking"}` : "Changing the game…"}</p> : null}
              {mine.map((s) => (
                <div key={s.id} className="pl-line pl-claude pl-sent-line">
                  <span>Claude sent a change over MCP: {s.summary}</span>
                  <span className="pl-saved-row">
                    <button className="pl-go pl-small" onClick={() => void applySent(s)}>Apply</button>
                    <button className="pl-plain" onClick={() => drop(s.id)}>Dismiss</button>
                  </span>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            {needsKey ? <button className="pl-ghost pl-small" onClick={openKeys}>Add a Claude key</button> : null}
            {ask ? <McpAsk text={ask} /> : null}
            <div className="pl-composer pl-composer-small">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="Make it faster and set it on the moon"
                rows={2}
                maxLength={2000}
                aria-label="Change the game"
              />
              <div className="pl-composer-bar">
                <button className="pl-ghost pl-small" onClick={() => void undo()} disabled={!game.history.length || thinking}>Undo</button>
                {spec.template === "code" ? <QualitySwitch value={quality} onChange={setQuality} /> : <span className="pl-mono">Claude · your key</span>}
                <button className="pl-go pl-small" onClick={() => void send()} disabled={!message.trim() || thinking}>Send</button>
              </div>
            </div>

            <h2>Spec</h2>
            <p className="pl-pitch">{spec.pitch}</p>
            <div className="pl-chips">{ruleChips(spec).map((c) => <span key={c} className="pl-chip pl-static">{c}</span>)}</div>
            <button className="pl-plain" onClick={() => setShowJson((v) => !v)} aria-expanded={showJson}>{showJson ? "Hide" : "Show and edit"} the spec as JSON</button>
            {showJson ? <SpecEditor key={JSON.stringify(spec)} spec={spec} onApply={(next) => changeSpec(next, "Edited the spec by hand.")} /> : null}
          </aside>

          <main className="pl-main">
            {spec.template === "code" ? <CodeFrame spec={spec} onBug={onBug} /> : <GameCanvas spec={spec} />}
            {spec.template === "code" && bug ? (
              <div className="pl-bug" role="alert">
                <span>This game hit a bug: {bug}</span>
                <button className="pl-go pl-small" disabled={thinking} onClick={() => void fixBug()}>{thinking ? "Fixing…" : "Ask Claude to fix · your key"}</button>
              </div>
            ) : null}
          </main>

          <ArtPanel spec={spec} onChange={changeSpec} />
        </div>
      </div>
    </div>
  );
}

function ArtPanel({ spec, onChange }: { spec: GameSpec; onChange: (spec: GameSpec, note?: string) => Promise<SavedGame | undefined> }) {
  const [quote, setQuote] = useState<ArtQuote | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<{ text: string; needsKey?: boolean } | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  // Prices follow the prompts; reading them starts nothing.
  const prompts = slotsOf(spec).map((s) => s.art.prompt).join("|") + spec.title + spec.pitch;
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      quoteArt(forArt(specRef.current)).then((q) => { if (live) setQuote(q); }, () => undefined);
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [prompts]);

  const prices = quote?.ok ? quote.prices : {};
  const openOnly = quote?.ok ? quote.openOnly : false;
  const slots = slotsOf(spec);
  const missing = slots.filter((s) => !s.art.url);

  const make = async (wanted: Slot[]) => {
    setProblem(null);
    setBusy((b) => new Set([...b, ...wanted.map((s) => s.key)]));
    // One at a time: each is charged on its own, and a failure stops the rest.
    for (const slot of wanted) {
      const follow = slotsOf(specRef.current).find((s) => s.key === slot.key)?.art.ref;
      const made = await makeArt(forArt(specRef.current), slot.key, ...(follow ? [follow] : [])).catch(() => ({ ok: false as const, reason: "The art couldn't be made. Nothing was retried." }));
      setBusy((b) => { const n = new Set(b); n.delete(slot.key); return n; });
      if (!made.ok) {
        setProblem({ text: made.reason, ...("needsKey" in made && made.needsKey ? { needsKey: true } : {}) });
        setBusy(new Set());
        return;
      }
      const next = await onChange(withArt(specRef.current, slot.key, { url: made.url }), `Made the ${slot.label.toLowerCase()} art${made.usd ? ` · ${creditsText(made.usd)}` : ""}.`);
      if (next) specRef.current = next.spec;
    }
  };

  const [picking, setPicking] = useState<Slot | null>(null);
  const follow = (slot: Slot, ref: string, from: string) => {
    setProblem(null);
    void onChange(withArt(specRef.current, slot.key, { ref }), `The ${slot.label.toLowerCase()} art will follow ${from}.`);
  };
  // Building a new character or place leaves the page; it comes back with `?pick=`, for the slot it was for.
  const PICK_SLOT = "playable/pick-slot";
  useReturnedPick(["character", "place", "accessory"], (item) => {
    let key: string | null = null;
    try { key = sessionStorage.getItem(PICK_SLOT); sessionStorage.removeItem(PICK_SLOT); } catch { /* no storage */ }
    const slot = slotsOf(specRef.current).find((s) => s.key === key);
    if (slot && item.image) follow(slot, item.image, item.name);
  });

  const upload = async (slot: Slot, file: File | undefined) => {
    if (!file) return;
    try {
      follow(slot, await pictureFile(file, slot.kind), "your picture");
    } catch (caught) {
      setProblem({ text: caught instanceof Error ? caught.message : "That picture couldn't be used." });
    }
  };

  const total = missing.map((s) => prices[s.key]).filter((p): p is number => typeof p === "number");
  const working = busy.size > 0;
  return (
    <aside className="pl-panel pl-art" aria-label="Art">
      <h2>Art</h2>
      <p className="pl-sub">Placeholder shapes until you make a picture. {quote?.ok ? `Made with ${quote.model} on Comfy.` : ""}</p>
      {openOnly ? <p className="pl-problem">Open weights only is on. Game art uses a partner model, so it can&apos;t be made while the switch is on; the shapes still play.</p> : null}
      <ul className="pl-slots">
        {slots.map((slot) => (
          <li key={slot.key} className="pl-slot">
            <div className="pl-slot-head">
              <span className="pl-swatch" style={slot.art.url ? { backgroundImage: `url("${slot.art.url}")` } : {}}>
                {slot.art.url ? null : <i className={`pl-shape pl-${slot.art.shape}`} style={{ background: slot.art.color }} />}
              </span>
              <strong>{slot.label}</strong>
              <span className="pl-mono">{slot.kind}</span>
            </div>
            <PromptBox key={`${slot.key}:${slot.art.prompt}`} value={slot.art.prompt} onSave={(prompt) => void onChange(withArt(specRef.current, slot.key, { prompt }))} />
            {slot.art.ref ? (
              <div className="pl-ref">
                <img src={slot.art.ref} alt="" />
                <span className="pl-mono">Make follows this picture</span>
                <button className="pl-ghost pl-small" disabled={working} onClick={() => void onChange(withArt(specRef.current, slot.key, { url: slot.art.ref }), `Using your picture as the ${slot.label.toLowerCase()}.`)}>Use as is · free</button>
                <button className="pl-plain" disabled={working} onClick={() => void onChange(withArt(specRef.current, slot.key, { ref: undefined }))}>Remove</button>
              </div>
            ) : (
              <div className="pl-pair">
                <button className="pl-plain" disabled={working} onClick={() => setPicking(slot)}>Your pictures</button>
                <label className="pl-plain pl-upload">
                  Upload
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { void upload(slot, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            )}
            <div className="pl-pair">
              <button className="pl-go pl-small" disabled={openOnly || working || !quote?.ok} onClick={() => void make([slot])}>
                {busy.has(slot.key) ? "Making…" : `${slot.art.url ? "Make again" : "Make"} · ${creditsText(prices[slot.key])}`}
              </button>
              {slot.art.url ? <button className="pl-ghost pl-small" disabled={working} onClick={() => void onChange(withArt(specRef.current, slot.key, { url: undefined }), `Back to the shape for the ${slot.label.toLowerCase()}.`)}>Use shape</button> : null}
            </div>
          </li>
        ))}
      </ul>
      {missing.length > 1 ? (
        <button className="pl-go" disabled={openOnly || working || !quote?.ok || total.length !== missing.length} onClick={() => void make(missing)}>
          Make all {missing.length} · {total.length === missing.length ? totalText(total) : "···"}
        </button>
      ) : null}
      {problem ? (
        <p className="pl-problem" role="alert">
          {problem.text}
          {problem.needsKey ? <button className="pl-ghost pl-small" onClick={openKeys}>Keys</button> : null}
        </p>
      ) : null}
      {picking ? (
        <BankPicker
          kinds={picking.kind === "background" ? ["place", "character", "accessory"] : ["character", "accessory", "place"]}
          label={`A picture for the ${picking.label.toLowerCase()}`}
          allowPhotoBuild={false}
          beforeBuild={async () => { try { sessionStorage.setItem(PICK_SLOT, picking.key); } catch { /* no storage */ } }}
          onClose={() => setPicking(null)}
          onPick={(item) => {
            const slot = picking;
            setPicking(null);
            if (!item.image) return setProblem({ text: `${item.name} has no picture yet. Make one first, or upload a picture.` });
            follow(slot, item.image, item.name);
          }}
        />
      ) : null}
    </aside>
  );
}

/** The spec by hand: whatever is applied is read like Claude's replies, so it is clamped into a playable game. */
function SpecEditor({ spec, onApply }: { spec: GameSpec; onApply: (spec: GameSpec) => Promise<unknown> }) {
  const [text, setText] = useState(() => JSON.stringify(spec, null, 2));
  const [problem, setProblem] = useState<string | null>(null);
  const apply = () => {
    let next: GameSpec;
    try {
      next = readSpec(JSON.parse(text));
    } catch (caught) {
      setProblem(caught instanceof SyntaxError ? "That isn't valid JSON." : caught instanceof Error ? caught.message : "That spec can't be read.");
      return;
    }
    setProblem(null);
    void onApply(next);
  };
  return (
    <>
      <textarea className="pl-json" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={14} aria-label="The spec as JSON" />
      <div className="pl-pair">
        <button className="pl-ghost pl-small" onClick={apply} disabled={text === JSON.stringify(spec, null, 2)}>Apply</button>
        <span className="pl-mono">Numbers are kept within playable ranges.</span>
      </div>
      {problem ? <p className="pl-problem" role="alert">{problem}</p> : null}
    </>
  );
}

function PromptBox({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [text, setText] = useState(value);
  const save = () => { if (text.trim() && text.trim() !== value) onSave(text.trim()); };
  return <textarea className="pl-prompt" value={text} rows={2} maxLength={400} onChange={(e) => setText(e.target.value)} onBlur={save} aria-label="What the picture shows" />;
}

