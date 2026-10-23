"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MODELS, getModelCard, outputCount, searchModels } from "../catalog/models";
import { coerceSettings, defaultSettings, type Settings } from "../catalog/settings";
import { slotIn, templatesFor, type Template } from "../catalog/templates";
import { lookPhrase, withLook, type LookChoice } from "../catalog/look";
import { LookPanel } from "./look-panel";
import { OUTFIT_IDEAS, castReferences, castWords } from "../catalog/cast";
import { createCharacterStore, identityLock, type Character } from "../characters/character";
import { createPlaceStore, placeLock, type SavedPlace } from "../locations/location";
import type { Capability } from "../providers/types";
import { defaultKv } from "../story/kv";
import { createRunStore, type Run } from "../story/runs";
import { rates, run, type Rate } from "./actions";
import { Nav, openKeys } from "./nav";
import { BuildLink } from "./return-bar";
import { readPick } from "../story/handoff";
import { REUSE_KEY } from "./gallery/gallery";
import { useStartProject } from "./start-project";
import { RunTile } from "./run-tile";
import { SaveToProject } from "./save-to-project";
import { SettingsRail } from "./settings-rail";

/** In-flight work only. Anything finished is a Run and lives in storage. */
type Slot =
  | { state: "working"; id: number }
  | { state: "failed"; id: number; reason: string };

/** Which part of the catalog a surface shows. The nav items are these. */
/** A dismissible pointer to the Academy for people who don't know where to start. */
function AcademyNudge() {
  const [gone, setGone] = useState(true);
  useEffect(() => {
    try {
      setGone(localStorage.getItem("haggs.academy.nudge") === "off");
    } catch {
      setGone(false);
    }
  }, []);
  if (gone) return null;
  return (
    <div className="nudge" role="note">
      <span><b>Don&rsquo;t know where to start?</b> The Academy&rsquo;s first lesson makes a video in one minute.</span>
      <Link className="pill on" href="/academy">Learn now</Link>
      <button className="plain" aria-label="Hide this" onClick={() => { setGone(true); try { localStorage.setItem("haggs.academy.nudge", "off"); } catch { /* private window */ } }}>×</button>
    </div>
  );
}

export type Surface = "Create" | "Video" | "Edit";

const SURFACE_CAPABILITIES: Record<Surface, readonly Capability[]> = {
  Create: ["text-to-image"],
  Video: ["text-to-video", "image-to-video"],
  Edit: ["image-edit"],
};

const BLURB: Record<Surface, string> = {
  Create: "Describe a scene, character, mood or style. The price is on the button before you press it — in dollars, not credits.",
  Video: "Describe the shot — subject, camera move, light, pacing. Every setting below is one this model actually accepts.",
  Edit: "Attach an image and describe the change. The rest of the picture stays as it is.",
};

/** A picture handed from one page to the next: Animate sends it to Video as the first frame, Edit to Edit a photo. */
const HANDOFF_KEY = "haggs.handoff";

export function Studio({ surface = "Create" }: { surface?: Surface }) {
  const router = useRouter();
  const catalog = useMemo(
    () => MODELS.filter((model) => SURFACE_CAPABILITIES[surface].includes(model.capability)),
    [surface],
  );

  const [modelId, setModelId] = useState(catalog[0]!.id);
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<Settings>(() =>
    defaultSettings(getModelCard(catalog[0]!.id).settings),
  );
  const [images, setImages] = useState<string[]>([]);
  // Who and where, and what they wear: saved characters and places, added to whatever you type.
  const [people, setPeople] = useState<Character[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [who, setWho] = useState<Character | null>(null);
  const [where, setWhere] = useState<SavedPlace | null>(null);
  const [outfit, setOutfit] = useState<string[]>([]);
  const [tile, setTile] = useState<"character" | "location" | "wardrobe" | null>(null);
  const [custom, setCustom] = useState("");
  useEffect(() => {
    const pick = readPick(window.location.search);
    void createCharacterStore(defaultKv()).list().then((all) => { setPeople(all); const c = pick?.kind === "character" ? all.find((x) => x.id === pick.id) : undefined; if (c) setWho(c); }).catch(() => undefined);
    void createPlaceStore(defaultKv()).list().then((all) => { setPlaces(all); const p = pick?.kind === "place" ? all.find((x) => x.id === pick.id) : undefined; if (p) setWhere(p); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      const gift = raw ? (JSON.parse(raw) as { url: string; to: Surface }) : null;
      if (gift && gift.to === surface && typeof gift.url === "string") {
        sessionStorage.removeItem(HANDOFF_KEY);
        setImages([gift.url]);
      }
    } catch {
      /* Private mode blocks sessionStorage; nothing was handed over. */
    }
  }, [surface]);
  function handOff(item: Run, to: Surface) {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ url: item.url, to }));
    } catch {
      /* Without sessionStorage the page still opens, just empty. */
    }
    router.push(to === "Video" ? "/video" : "/edit");
  }

  const [picking, setPicking] = useState(false);
  const [hunt, setHunt] = useState("");

  const [rateMap, setRateMap] = useState<Record<string, Rate>>({});

  const [slots, setSlots] = useState<Slot[]>([]);
  const [history, setHistory] = useState<Run[]>([]);
  const [saving, setSaving] = useState<Run | null>(null);
  const startProject = useStartProject();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLook, setShowLook] = useState(false);
  const [look, setLook] = useState<LookChoice>({});
  const lookKey = `haggs.look.${surface}`;
  useEffect(() => {
    try {
      const kept = localStorage.getItem(lookKey);
      if (kept) setLook(JSON.parse(kept) as LookChoice);
    } catch {
      // Nothing kept.
    }
  }, [lookKey]);
  const changeLook = (next: LookChoice) => {
    setLook(next);
    try {
      localStorage.setItem(lookKey, JSON.stringify(next));
    } catch {
      // A convenience only.
    }
  };
  const say = useRef<HTMLTextAreaElement>(null);
  /** A template's prompt waiting to be in the box, so its first [bracket] can be selected. */
  const pendingSlot = useRef<string | null>(null);
  const templates = useMemo(() => templatesFor(surface), [surface]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const runs = useMemo(() => createRunStore(defaultKv()), []);

  const card = useMemo(() => getModelCard(modelId), [modelId]);
  const rate = rateMap[modelId];

  /** Put a past run back in the composer — model, prompt and the settings it ran with. */
  const reuse = useCallback((item: Run) => {
    setModelId(item.modelId);
    setPrompt(item.prompt);
    setSettings((held) =>
      coerceSettings(getModelCard(item.modelId).settings, { ...held, ...item.settings }),
    );
  }, []);

  useEffect(() => {
    void rates().then((list) => setRateMap(Object.fromEntries(list.map((r) => [r.id, r]))));
    void runs
      .list()
      .then((list) => {
        setHistory(list);

        // Arriving from Reuse in the gallery: load that run into the composer.
        // Read once and clear, so a later refresh does not silently overwrite
        // whatever you have typed since.
        let wanted: string | null = null;
        try {
          wanted = sessionStorage.getItem(REUSE_KEY);
          if (wanted) sessionStorage.removeItem(REUSE_KEY);
        } catch {
          /* Private mode blocks sessionStorage; nothing to restore. */
        }
        const found = wanted ? list.find((item) => item.id === wanted) : undefined;
        if (found) reuse(found);
      })
      .catch(() => setHistory([]));
  }, [runs, reuse]);

  // Changing model means the settings you were holding belong to the model you
  // just left. Keep what the new one also declares, and default the rest.
  useEffect(() => {
    setSettings((held) => coerceSettings(getModelCard(modelId).settings, held));
  }, [modelId]);

  /** What the run will cost, in dollars, before it runs. */
  const cost = useMemo(() => {
    if (!rate || rate.usd === null) return null;
    const perOutput = rate.unit === "image" || rate.unit === "video";
    return rate.usd * (perOutput ? outputCount(card, settings) : 1);
  }, [rate, card, settings]);

  const costLabel = cost === null ? (rate ? rate.label : "···") : `$${cost.toFixed(3)}`;
  const needsImage = card.inputImages > 0 && images.length === 0;

  const attach = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      // fal accepts a data URI wherever it takes an image URL, which keeps this
      // working with no upload host. Big files make a big request body — a real
      // blob store is the fix when that starts to bite.
      if (typeof reader.result === "string") setImages([reader.result]);
    };
    reader.readAsDataURL(file);
  }, []);

  const fire = useCallback(async () => {
    if (!prompt.trim() || busy || needsImage) return;
    setBusy(true);
    const id = nextId.current++;
    setSlots((prior) => [{ state: "working", id }, ...prior]);

    // The look's words go after the prompt, and the run keeps the prompt as it was sent.
    const cast = surface === "Edit" ? null : { characterLock: who ? identityLock(who.traits) : undefined, placeLock: where ? placeLock(where.traits) : undefined, outfit };
    const sent = surface === "Edit" ? prompt : withLook(cast ? castWords(prompt, cast) : prompt, look);
    // A picture you attached is the opening frame; with none, your character's and place's sheets go in as references.
    const refs = surface === "Edit" ? [] : castReferences({ attached: images, character: who?.sheet ?? null, place: where?.plate ?? null, max: card.inputImages });
    const result = refs.length ? await run(modelId, sent, settings, refs, false) : await run(modelId, sent, settings, images.length ? images : undefined);

    setSlots((prior) => {
      const rest = prior.filter((slot) => slot.id !== id);
      return result.ok ? rest : [{ state: "failed", id, reason: result.reason }, ...rest];
    });

    if (result.ok) {
      // Recorded before it is shown, so what you are looking at is what
      // survives a refresh — not a copy of it held in component state.
      const kept: Run[] = [];
      for (const shot of result.shots) {
        kept.push(
          await runs.record({
            modelId,
            modelName: card.name,
            prompt: sent,
            settings,
            url: shot.url,
            kind: shot.kind,
            usd: result.usd === null ? null : result.usd / result.shots.length,
          }),
        );
      }
      setHistory((prior) => [...kept.reverse(), ...prior]);
    }

    if (!result.ok && result.needsKey) openKeys();
    setBusy(false);
  }, [prompt, busy, needsImage, modelId, settings, images, card.name, runs, look, surface, who, where, outfit, card.inputImages]);

  useEffect(() => {
    if (pendingSlot.current === null || pendingSlot.current !== prompt) return;
    pendingSlot.current = null;
    const slot = slotIn(prompt);
    say.current?.focus();
    if (slot) say.current?.setSelectionRange(slot.start, slot.end);
  }, [prompt]);

  /** Fill the composer from a template and select the first part to make your own. */
  const applyTemplate = useCallback(
    (t: Template) => {
      // A template that starts from a picture needs a model that takes one.
      const model = t.fromPicture && getModelCard(modelId).inputImages === 0 ? catalog.find((m) => getModelCard(m.id).inputImages > 0) : undefined;
      const target = getModelCard(model?.id ?? modelId);
      if (model) setModelId(model.id);
      setSettings((held) => {
        const next = coerceSettings(target.settings, held);
        const key = Object.entries(target.settings).find(([, f]) => f.input === "aspect_ratio" && "values" in f && (f.values as readonly string[]).includes(t.aspect ?? ""))?.[0];
        return key && t.aspect ? { ...next, [key]: t.aspect } : next;
      });
      pendingSlot.current = t.prompt;
      setPrompt(t.prompt);
      setShowTemplates(false);
      if (t.fromPicture && !images.length) requestAnimationFrame(() => fileInput.current?.click());
    },
    [modelId, catalog, images.length],
  );

  // A link from the home page (…?template=dolly-zoom) opens with that template already in the box.
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current) return;
    linked.current = true;
    const id = new URLSearchParams(window.location.search).get("template");
    const found = id ? templates.find((t) => t.id === id) : undefined;
    if (found) applyTemplate(found);
  }, [templates, applyTemplate]);

  const toggleKeep = useCallback(
    async (item: Run) => {
      const next = !item.favorite;
      setHistory((prior) =>
        prior.map((run) => (run.id === item.id ? { ...run, favorite: next } : run)),
      );
      await runs.setFavorite(item.id, next);
    },
    [runs],
  );

  return (
    <div className="app">
      <Nav current={surface === "Video" ? "Video" : "Photos"} />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}

      <div className="canvas" onClick={() => setPicking(false)}>
        <AcademyNudge />
        {surface === "Video" && (
          <nav className="modes" aria-label="Video">
            <Link href="/video" aria-current="page">Make a clip</Link>
            <Link href="/series">Series</Link>
            <Link href="/recreate">Recreate an edit</Link>
          </nav>
        )}
        {surface !== "Video" && (
          <nav className="modes" aria-label="Photos">
            <Link href="/photos" aria-current={surface === "Create" ? "page" : undefined}>Make</Link>
            <Link href="/edit" aria-current={surface === "Edit" ? "page" : undefined}>Edit a photo</Link>
            <Link href="/characters">Characters</Link>
            <Link href="/locations">Locations</Link>
            <Link href="/comic">Comic strip</Link>
          </nav>
        )}
        {slots.length === 0 && history.length === 0 ? (
          <div className="blank">
            <h1>
              {surface === "Edit" ? "Edit with " : "Start with "}
              {card.name}
            </h1>
            <p>{BLURB[surface]}</p>
            <p className="blank-rate">
              This model runs at <b>{rate?.label ?? "a rate loading now"}</b>. Every run you
              make is kept here with what it cost.
            </p>
          </div>
        ) : (
          <>
          <div className="grid">
            {slots.map((slot) =>
              slot.state === "working" ? (
                <div key={slot.id} className="cell working" />
              ) : (
                <div key={slot.id} className="cell failed">
                  <span className="cell-err">{slot.reason}</span>
                </div>
              ),
            )}
            {history.map((item) => (
              <RunTile
                key={item.id}
                run={item}
                onFavorite={() => void toggleKeep(item)}
                onReuse={() => reuse(item)}
                onSave={() => setSaving(item)}
                onStart={() => void startProject(item)}
                onAnimate={() => handOff(item, "Video")}
                onEdit={() => handOff(item, "Edit")}
              />
            ))}
          </div>
          </>
        )}
      </div>

      <div className="dock">
        <div className="composer">
          {picking && (
            <div className="picker" onClick={(event) => event.stopPropagation()}>
              <input
                className="picker-hunt"
                autoFocus
                value={hunt}
                onChange={(event) => setHunt(event.target.value)}
                placeholder="Search…"
              />
              <div className="picker-list">
                <div className="picker-head">Models · live rates from fal</div>
                {searchModels(hunt)
                  .filter((model) => catalog.includes(model))
                  .map((model) => {
                    const modelRate = rateMap[model.id];
                    return (
                      <button
                        key={model.id}
                        className="opt"
                        aria-selected={model.id === modelId}
                        onClick={() => {
                          setModelId(model.id);
                          setPicking(false);
                          setHunt("");
                        }}
                      >
                        <span className="opt-glyph">{model.name.slice(0, 2).toUpperCase()}</span>
                        <span className="opt-main">
                          <span className="opt-name">
                            {model.name}
                            {model.badge && <span className={`badge ${model.badge}`}>{model.badge}</span>}
                          </span>
                          <span className="opt-blurb">{model.blurb}</span>
                        </span>
                        <span className={`opt-rate${modelRate?.usd == null ? " dim" : ""}`}>
                          {modelRate?.label ?? "···"}
                        </span>
                        {model.id === modelId && <span className="tick">✓</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {images.length > 0 && (
            <div className="tray">
              {images.map((src) => (
                <span key={src.slice(0, 64)} className="tray-item">
                  <img src={src} alt="" />
                  <button onClick={() => setImages([])} title="Remove">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {surface !== "Edit" && (
            <div className="cast">
              <button className={`cast-tile${who ? " set" : ""}`} onClick={() => setTile(tile === "character" ? null : "character")} aria-expanded={tile === "character"}>
                {who ? <img src={who.sheet} alt="" /> : <span className="cast-plus">+</span>}
                <b>{who ? who.traits.name : "Character"}</b>
                {who && <i role="button" aria-label="Remove the character" onClick={(e) => { e.stopPropagation(); setWho(null); }}>×</i>}
              </button>
              <button className={`cast-tile${where ? " set" : ""}`} onClick={() => setTile(tile === "location" ? null : "location")} aria-expanded={tile === "location"}>
                {where ? <img src={where.plate} alt="" /> : <span className="cast-plus">+</span>}
                <b>{where ? where.traits.name : "Location"}</b>
                {where && <i role="button" aria-label="Remove the location" onClick={(e) => { e.stopPropagation(); setWhere(null); }}>×</i>}
              </button>
              <button className={`cast-tile${outfit.length ? " set" : ""}`} onClick={() => setTile(tile === "wardrobe" ? null : "wardrobe")} aria-expanded={tile === "wardrobe"}>
                <span className="cast-plus">{outfit.length || "+"}</span>
                <b>Wardrobe</b>
              </button>
            </div>
          )}
          {tile && surface !== "Edit" && (
            <div className="cast-pick" onClick={(e) => e.stopPropagation()}>
              {tile === "character" && (people.length ? (
                <div className="cast-list">{people.map((c) => <button key={c.id} onClick={() => { setWho(c); setTile(null); }}><img src={c.sheet} alt="" /><span>{c.traits.name}</span></button>)}</div>
              ) : <p className="wf-small">No characters yet. <BuildLink href="/characters" label={surface === "Video" ? "Video" : "Photos"}>Build one</BuildLink> and they&rsquo;ll be here.</p>)}
              {tile === "location" && (places.length ? (
                <div className="cast-list">{places.map((c) => <button key={c.id} onClick={() => { setWhere(c); setTile(null); }}><img src={c.plate} alt="" /><span>{c.traits.name}</span></button>)}</div>
              ) : <p className="wf-small">No places yet. <BuildLink href="/locations" label={surface === "Video" ? "Video" : "Photos"}>Build one</BuildLink> and it&rsquo;ll be here.</p>)}
              {tile === "wardrobe" && (
                <div className="cast-wardrobe">
                  <p className="wf-small">What the character wears or carries. Added to the words, so it works with any model.</p>
                  <div className="series-chips">
                    {OUTFIT_IDEAS.map((o) => <button key={o} className={outfit.includes(o) ? "on" : ""} onClick={() => setOutfit((all) => (all.includes(o) ? all.filter((x) => x !== o) : [...all, o]))}>{o}</button>)}
                    {outfit.filter((o) => !OUTFIT_IDEAS.includes(o)).map((o) => <button key={o} className="on" onClick={() => setOutfit((all) => all.filter((x) => x !== o))}>{o} ×</button>)}
                  </div>
                  <form className="cast-add" onSubmit={(e) => { e.preventDefault(); const v = custom.trim(); if (v && !outfit.includes(v)) setOutfit((all) => [...all, v]); setCustom(""); }}>
                    <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Something else: a silver watch, a red kimono…" aria-label="Add clothing or an accessory" maxLength={60} />
                    <button className="pill">Add</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {showLook && surface !== "Edit" && <LookPanel value={look} onChange={changeLook} />}
          <div className="composer-top">
            <button
              className={`attach${needsImage ? " wanted" : ""}`}
              title={card.inputImages > 0 ? "Attach an image" : "This model takes text only"}
              disabled={card.inputImages === 0}
              onClick={() => fileInput.current?.click()}
            >
              +
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) attach(file);
              }}
            />
            {surface !== "Edit" && (
              <button className={`tpl-open${lookPhrase(look) ? " set" : ""}`} aria-expanded={showLook} onClick={(e) => { e.stopPropagation(); setShowLook((v) => !v); setShowTemplates(false); }}>
                Look{lookPhrase(look) ? " ·" : ""}
              </button>
            )}
            {templates.length > 0 && (
              <div className="tpl-wrap" onClick={(e) => e.stopPropagation()}>
                <button className="tpl-open" aria-expanded={showTemplates} onClick={() => setShowTemplates((v) => !v)}>
                  Templates
                </button>
                {showTemplates && (
                  <div className="tpl-menu" role="menu">
                    {templates.map((t) => (
                      <button key={t.id} role="menuitem" onClick={() => applyTemplate(t)}>
                        {t.sample && (/\.mp4$/.test(t.sample) ? <video src={t.sample} muted loop autoPlay playsInline /> : <img src={t.sample} alt="" />)}
                        <span className="tpl-words"><b>{t.name}</b><span>{t.blurb}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <textarea
              ref={say}
              className="say"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={surface === "Edit" ? "Describe the change" : "Describe the scene you imagine"}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void fire();
              }}
            />
          </div>

          <div className="composer-bottom">
            <button
              className="pill on"
              onClick={(event) => {
                event.stopPropagation();
                setPicking((open) => !open);
              }}
            >
              {card.name}
              <span className="caret">▾</span>
            </button>

            <SettingsRail
              fields={card.settings}
              settings={settings}
              onChange={(key, value) => setSettings((held) => ({ ...held, [key]: value }))}
            />

            <button
              className="fire"
              onClick={() => void fire()}
              disabled={busy || !prompt.trim() || needsImage}
              title={needsImage ? "Attach an image first" : undefined}
            >
              {busy ? "Generating…" : "Generate"}
              <span className="cost">{costLabel}</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
