"use client";

import { track } from "../activity/activity";
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
import { currentWork, workSince } from "../story/current-work";
import { looksTooBig, shrinkAll } from "./shrink";
import { createRunStore, isPicture, type PictureRun, type Run } from "../story/runs";
import { rates, run, type Rate, type RunResult } from "./actions";
import { Nav, openKeys } from "./nav";
import { BankPicker, useReturnedPick } from "./bank-picker";
import { MakeBanner } from "./return-bar";
import { readPick } from "../story/handoff";
import { REUSE_KEY } from "./gallery/gallery";
import { useStartProject } from "./start-project";
import { ModeTabs } from "./mode-tabs";
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

/** Whether any model is switched on for a surface. Edit a photo waits on fal, which is off until it is rolled out. */
export const surfaceAvailable = (surface: Surface) => MODELS.some((m) => SURFACE_CAPABILITIES[surface].includes(m.capability));

export function Studio(props: { surface?: Surface }) {
  return surfaceAvailable(props.surface ?? "Create") ? <StudioBody {...props} /> : <Waiting />;
}

function Waiting() {
  return (
    <div className="app">
      <Nav current="Photos" />
      <div className="canvas">
        <div className="swap">
          <header className="swap-head">
            <h1>Edit a photo is coming soon</h1>
            <p>It needs a provider that isn&rsquo;t switched on yet. Until then: fix part of any frame in the editor, relight, restyle or try an outfit on in Workflows.</p>
          </header>
          <p className="sheet-row"><Link className="fire" href="/workflows">See the workflows</Link><Link className="plain" href="/photos">Make a photo</Link></p>
        </div>
      </div>
    </div>
  );
}

function StudioBody({ surface = "Create" }: { surface?: Surface }) {
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
  /** The picture behind an accessory picked from your bank, by its words, sent as a reference alongside them. */
  const [outfitPics, setOutfitPics] = useState<Record<string, string>>({});
  const [tile, setTile] = useState<"character" | "location" | "wardrobe" | null>(null);
  const [custom, setCustom] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  // Back from making an accessory: it is on the character now.
  const pickAccessory = (item: { words: string; image: string | null }) => {
    if (!item.words) return;
    if (item.image) setOutfitPics((all) => ({ ...all, [item.words]: item.image! }));
    setOutfit((all) => (all.includes(item.words) ? all : [...all, item.words]));
  };
  useReturnedPick(["accessory"], pickAccessory);
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
  const [history, setHistory] = useState<PictureRun[]>([]);
  /* Photos and Video show this stretch of work; the Gallery keeps the rest. */
  const [since, setSince] = useState(Number.MAX_SAFE_INTEGER);
  const [reused, setReused] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState<PictureRun | null>(null);
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

  const shownRuns = useMemo(
    () => currentWork(history, surface === "Video" ? "video" : "image", since, reused),
    [history, surface, since, reused],
  );

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
    try {
      setSince(workSince(sessionStorage, Date.now()));
    } catch {
      setSince(Date.now());
    }
  }, []);

  useEffect(() => {
    void rates().then((list) => setRateMap(Object.fromEntries(list.map((r) => [r.id, r]))));
    void runs
      .list()
      .then((list) => {
        // Sounds live in the Gallery; Photos and Video show pictures and clips.
        setHistory(list.filter(isPicture));

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
        if (found) { reuse(found); setReused(found.id); }
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
    const refs = surface === "Edit" ? [] : castReferences({ attached: images, character: who?.sheet ?? null, place: where?.plate ?? null, accessories: outfit.map((w) => outfitPics[w]).filter((x): x is string => Boolean(x)), max: card.inputImages });
    // References are drawn smaller first: two full-size sheets together can pass the host's request limit.
    const sendRefs = await shrinkAll(refs);
    const sendImages = await shrinkAll(images, 1536);
    const result: RunResult = await track({ label: `Making a ${surface === "Edit" ? "picture edit" : "picture"}`, href: window.location.pathname + window.location.search, failure: (r) => (r.ok ? null : r.reason) }, () => (sendRefs.length ? run(modelId, sent, settings, sendRefs, false) : run(modelId, sent, settings, sendImages.length ? sendImages : undefined))).catch((e: unknown): RunResult => ({ ok: false, reason: looksTooBig(e) ? "Those pictures were too big to send together. Try one reference, or smaller pictures." : e instanceof Error ? e.message : "The picture didn't finish." }));

    setSlots((prior) => {
      const rest = prior.filter((slot) => slot.id !== id);
      return result.ok ? rest : [{ state: "failed", id, reason: result.reason }, ...rest];
    });

    if (result.ok) {
      // Recorded before it is shown, so what you are looking at is what
      // survives a refresh — not a copy of it held in component state.
      const kept: PictureRun[] = [];
      for (const shot of result.shots) {
        kept.push(
          (await runs.record({
            modelId,
            modelName: card.name,
            prompt: sent,
            settings,
            url: shot.url,
            kind: shot.kind,
            usd: result.usd === null ? null : result.usd / result.shots.length,
          })) as PictureRun,
        );
      }
      setHistory((prior) => [...kept.reverse(), ...prior]);
    }

    if (!result.ok && result.needsKey) openKeys();
    setBusy(false);
  }, [prompt, busy, needsImage, modelId, settings, images, card.name, runs, look, surface, who, where, outfit, outfitPics, card.inputImages]);

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
    async (item: PictureRun) => {
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
        {/* The tabs sit in the same place on every page; anything else goes under them. */}
        {surface === "Video" && <ModeTabs group="Video" current="/video" />}
        {surface !== "Video" && <ModeTabs group="Photos" current={surface === "Edit" ? "/edit" : "/photos"} canEdit={surfaceAvailable("Edit")} />}
        <AcademyNudge />
        {surface !== "Video" && <MakeBanner />}
        {slots.length === 0 && shownRuns.length === 0 ? (
          <div className="blank">
            <h1>
              {surface === "Edit" ? "Edit with " : "Start with "}
              {card.name}
            </h1>
            <p>{BLURB[surface]}</p>
            <p className="blank-rate">
              This model runs at <b>{rate?.label ?? "a rate loading now"}</b>. What you make
              shows up here with what it cost. Earlier work is in the <Link href="/gallery">Gallery</Link>.
            </p>
          </div>
        ) : (
          <>
          <p className="work-note">Showing what you've made this session. <Link href="/gallery">Everything else is in the Gallery</Link>.</p>
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
            {shownRuns.map((item) => (
              <RunTile
                key={item.id}
                run={item}
                onFavorite={() => void toggleKeep(item)}
                onReuse={() => reuse(item)}
                onSave={() => setSaving(item)}
                onStart={() => void startProject(item)}
                onAnimate={() => handOff(item, "Video")}
                {...(surfaceAvailable("Edit") ? { onEdit: () => handOff(item, "Edit") } : {})}
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
                <b>Accessories</b>
              </button>
            </div>
          )}
          {tile === "character" && surface !== "Edit" && <BankPicker kinds={["character"]} label={surface === "Video" ? "Video" : "Photos"} onClose={() => setTile(null)} onPick={(item) => setWho(people.find((p) => p.id === item.id) ?? null)} picked={who ? [`character:${who.id}`] : []} />}
          {tile === "location" && surface !== "Edit" && <BankPicker kinds={["place"]} label={surface === "Video" ? "Video" : "Photos"} onClose={() => setTile(null)} onPick={(item) => setWhere(places.find((p) => p.id === item.id) ?? null)} picked={where ? [`place:${where.id}`] : []} />}
          {tile === "wardrobe" && surface !== "Edit" && (
            <div className="cast-pick" onClick={(e) => e.stopPropagation()}>
              {tile === "wardrobe" && (
                <div className="cast-wardrobe">
                  <p className="wf-small">What the character wears or carries. Added to the words, so it works with any model.</p>
                  <div className="series-chips">
                    {OUTFIT_IDEAS.map((o) => <button key={o} className={outfit.includes(o) ? "on" : ""} onClick={() => setOutfit((all) => (all.includes(o) ? all.filter((x) => x !== o) : [...all, o]))}>{o}</button>)}
                    {outfit.filter((o) => !OUTFIT_IDEAS.includes(o)).map((o) => <button key={o} className="on" onClick={() => setOutfit((all) => all.filter((x) => x !== o))}>{o} ×</button>)}
                  </div>
                  <p className="cast-bank"><button className="plain" onClick={() => setBankOpen(true)}>From your accessories</button></p>
                  {bankOpen && <BankPicker kinds={["accessory"]} label={surface === "Video" ? "Video" : "Photos"} onClose={() => setBankOpen(false)} onPick={pickAccessory} />}
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
