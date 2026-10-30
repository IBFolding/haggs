"use client";
import {OpenWeightsStudio} from "./open-weights-studio";

import { sendStudioGeneration } from "../story/studio-request";
import { UploadImage } from "./board/upload-image";
import { track } from "../activity/activity";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MODELS, getModelCard, outputCount, searchModels } from "../catalog/models";
import { coerceSettings, defaultSettings, toWireSettings, type Settings } from "../catalog/settings";
import { cloudPrice } from "../providers/cloud-models";
import { slotIn, templatesFor, type Template } from "../catalog/templates";
import { recommend } from "../catalog/recommend";
import { withLook, type LookChoice } from "../catalog/look";
import { LookBar } from "./look-picker";
import { OUTFIT_IDEAS, castReferences, castWords } from "../catalog/cast";
import { createCharacterStore, identityLock, type Character } from "../characters/character";
import { createPlaceStore, placeLock, type SavedPlace } from "../locations/location";
import type { Capability } from "../providers/types";
import { defaultKv, idbKv } from "../story/kv";
import { currentWork, workSince } from "../story/current-work";
import { looksTooBig, shrinkAll } from "./shrink";
import { createRunStore, isPicture, type PictureRun, type Run } from "../story/runs";
import { run, type RunResult } from "./actions";
import { improvePrompt } from "./improve-actions";
import { Nav, openKeys } from "./nav";
import { BankPicker, loadBank } from "./bank-picker";
import { MakeBanner } from "./return-bar";
import { readPick } from "../story/handoff";
import { REUSE_KEY } from "./gallery/gallery";
import { useStartProject } from "./start-project";
import { Examples } from "./examples";
import { ModeTabs } from "./mode-tabs";
import { Workspace, type WorkItem } from "./workspace";
import { projectFromWorkspace } from "../story/workspace-project";
import { createProjectStore } from "../story/store";
import type { Layout } from "../story/workspace";
import { RunTile } from "./run-tile";
import { SaveToProject } from "./save-to-project";
import { SettingsRail } from "./settings-rail";
import { usePrefs } from "./prefs";
import { studioPrice, H3_RATE_SOURCE, COMFY_UNIT_SOURCE } from "../story/studio-price";

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
      <span><b>Don&rsquo;t know where to start?</b> Follow a guided workflow in the Academy.</span>
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
  Create: "Describe a scene, character, mood or style. The price is on the button before you press it, in credits.",
  Video: "Describe the shot — subject, camera move, light, pacing. Every setting below is one this model actually accepts.",
  Edit: "Attach an image and describe the change. The rest of the picture stays as it is.",
};

/** A picture handed from one page to the next: Animate sends it to Video as the first frame, Edit to Edit a photo. */
const HANDOFF_KEY = "haggs.handoff";

/** Whether any model is switched on for a surface. Edit a photo waits on fal, which is off until it is rolled out. */
export const surfaceAvailable = (surface: Surface) => MODELS.some((m) => SURFACE_CAPABILITIES[surface].includes(m.capability));

const hashOf = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i += Math.max(1, Math.floor(text.length / 4000))) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + text.length.toString(36);
};

export function Studio(props: { surface?: Surface }) {
  const {openOnly} = usePrefs();
  if (openOnly && (!props.surface || props.surface === "Create" || props.surface === "Video")) return <OpenWeightsStudio kind={props.surface === "Video" ? "video" : "image"} />;
  return surfaceAvailable(props.surface ?? "Create") ? <StudioBody key={props.surface ?? "Create"} {...props} /> : <Waiting />;
}

function Waiting() {

  return (
    <div className="app studio-app">
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
  const [draftReady,setDraftReady]=useState(false);
  const [draftNotice,setDraftNotice]=useState("Restoring your draft…");
  const draftWrites=useRef(Promise.resolve());
  const draftKey=`studio-draft:${surface}`;
  useEffect(()=>{ let live=true; void idbKv().get<{modelId:string;prompt:string;settings:Settings;images:string[];who:Character|null;where:SavedPlace|null;outfit:string[];outfitPics:Record<string,string>;custom:string}>(draftKey).then(d=>{
    if(!live)return;
    if(d){if(catalog.some(m=>m.id===d.modelId)){setModelId(d.modelId);setSettings(coerceSettings(getModelCard(d.modelId).settings,d.settings));}setPrompt(d.prompt??"");setImages(d.images??[]);setWho(d.who??null);setWhere(d.where??null);setOutfit(d.outfit??[]);setOutfitPics(d.outfitPics??{});setCustom(d.custom??"");}
    setDraftReady(true);setDraftNotice("Draft saved on this device");
  }).catch(()=>{if(live){setDraftReady(true);setDraftNotice("Draft storage is unavailable. Keep this page open while working.");}});return()=>{live=false;};},[draftKey,catalog]);
  useEffect(()=>{if(!draftReady)return;draftWrites.current=draftWrites.current.catch(()=>{}).then(()=>idbKv().set(draftKey,{modelId,prompt,settings,images,who,where,outfit,outfitPics,custom}));void draftWrites.current.catch(()=>setDraftNotice("Your draft could not be saved. Keep this page open and retry."));},[draftReady,draftKey,modelId,prompt,settings,images,who,where,outfit,outfitPics,custom]);
  // Back from making an accessory: it is on the character now.
  const pickAccessory = (item: { words: string; image: string | null }) => {
    if (!item.words) return;
    if (item.image) setOutfitPics((all) => ({ ...all, [item.words]: item.image! }));
    setOutfit((all) => (all.includes(item.words) ? all : [...all, item.words]));
  };

  useEffect(() => {
    if(!draftReady)return;
    const pick = readPick(window.location.search);
    void createCharacterStore(defaultKv()).list().then((all) => { setPeople(all); const c = pick?.kind === "character" ? all.find((x) => x.id === pick.id) : undefined; if (c) setWho(c); }).catch(() => undefined);
    void createPlaceStore(defaultKv()).list().then((all) => { setPlaces(all); const p = pick?.kind === "place" ? all.find((x) => x.id === pick.id) : undefined; if (p) setWhere(p); }).catch(() => undefined);
    if(pick)void loadBank().then(items=>{const found=items.find(i=>i.kind===pick.kind&&i.id===pick.id);if(found?.kind==='accessory')pickAccessory(found);if(!found?.image)setDraftNotice("That saved reference is missing or unfinished. Your draft is unchanged.");const u=new URL(window.location.href);u.searchParams.delete('pick');window.history.replaceState(null,'',u.pathname+u.search);});
  }, [draftReady]);
  useEffect(() => {
    if(!draftReady)return;
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      const gift = raw ? (JSON.parse(raw) as { url: string; to: Surface; prompt?: string }) : null;
      if (gift && gift.to === surface && typeof gift.url === "string") {
        sessionStorage.removeItem(HANDOFF_KEY);
        if (gift.url) setImages([gift.url]);
        if (typeof gift.prompt === "string" && gift.prompt.trim()) setPrompt(gift.prompt);
      }
    } catch {
      /* Private mode blocks sessionStorage; nothing was handed over. */
    }
  }, [surface,draftReady]);
  function handOff(item: Run, to: Surface) {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ url: item.url, to }));
    } catch {
      setDraftNotice("This image could not be passed to the next tool. Download it and use Upload image there, or retry.");
      return;
    }
    router.push(to === "Video" ? "/video" : "/edit");
  }

  const [picking, setPicking] = useState(false);
  const [hunt, setHunt] = useState("");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [history, setHistory] = useState<PictureRun[]>([]);
  /* Photos and Video show this stretch of work; the Gallery keeps the rest. */
  const [since, setSince] = useState(Number.MAX_SAFE_INTEGER);
  const [reused, setReused] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState<PictureRun | null>(null);
  const startProject = useStartProject();
  const [showTemplates, setShowTemplates] = useState(false);
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
  const [improving, setImproving] = useState(false);
  const [improveNote, setImproveNote] = useState<string | null>(null);
  const nextId = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const runs = useMemo(() => createRunStore(defaultKv()), []);

  const shownRuns = useMemo(
    () => currentWork(history, surface === "Video" ? "video" : "image", since, reused),
    [history, surface, since, reused],
  );

  /* The table and the minimised box are per-tab conveniences; they come back after a refresh. */
  const [view, setView] = useState<"grid" | "workspace">("grid");
  const [mini, setMini] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`haggs:view:${surface}`) === "workspace") setView("workspace");
      if (sessionStorage.getItem("haggs:mini") === "1") setMini(true);
    } catch { /* Private mode: the defaults are fine. */ }
  }, [surface]);
  const chooseView = (next: "grid" | "workspace") => {
    setView(next);
    try { sessionStorage.setItem(`haggs:view:${surface}`, next); } catch { /* A convenience only. */ }
    // The table needs the room; the box is one click away.
    if (next === "workspace") chooseMini(true);
  };
  const chooseMini = (next: boolean) => {
    setMini(next);
    try { sessionStorage.setItem("haggs:mini", next ? "1" : "0"); } catch { /* A convenience only. */ }
  };

  const card = useMemo(() => getModelCard(modelId), [modelId]);
  const { pro, openOnly } = usePrefs();
  const hasPro = Object.values(card.settings).some((f) => f.advanced);
  const workItems = useMemo<(WorkItem & { kind: "image" | "video" })[]>(
    () => [
      ...images.map((src) => ({ id: `ref:${hashOf(src)}`, src, kind: "image" as const, tag: "Reference" })),
      ...shownRuns.map((r) => ({ id: r.id, src: r.url, kind: r.kind, title: r.prompt, usd: r.usd, at: r.at })),
    ],
    [images, shownRuns],
  );

  const startFromWorkspace = useCallback(
    async (layout: Layout, name: string) => {
      const project = projectFromWorkspace(
        name,
        layout,
        workItems.map((i) => ({ id: i.id, src: i.src, kind: i.kind, ...(i.title ? { prompt: i.title } : {}), usd: i.usd ?? null, ...(i.at ? { at: i.at } : {}), reference: i.tag === "Reference" })),
      );
      if (!project) return;
      await createProjectStore(defaultKv()).save(project);
      router.push(`/board/${project.id}?b=${encodeURIComponent(project.boards![0]!.id)}`);
    },
    [workItems, router],
  );


  /** Put a past run back in the composer — model, prompt and the settings it ran with. */
  const reuse = useCallback((item: Run) => {
    const supported=catalog.find(m=>m.id===item.modelId);
    const chosen=supported??catalog[0]!;
    setModelId(chosen.id); setPrompt(item.prompt);
    setSettings(coerceSettings(chosen.settings,supported?item.settings:{}));
    if(!supported)setDraftNotice("The original model is unavailable here. Your prompt is restored; review the selected model before generating.");
  }, [catalog]);

  useEffect(() => {
    try {
      setSince(workSince(sessionStorage, Date.now()));
    } catch {
      setSince(Date.now());
    }
  }, []);

  useEffect(() => {
    if(!draftReady)return;
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
  }, [runs, reuse,draftReady]);

  // Changing model means the settings you were holding belong to the model you
  // just left. Keep what the new one also declares, and default the rest.
  useEffect(() => {
    setSettings((held) => coerceSettings(getModelCard(modelId).settings, held));
  }, [modelId]);

  // Use the same reference selection as submission; attached images are first frames.
  const priceReferences = surface === "Edit" ? [] : castReferences({ attached: images, character: who?.sheet ?? null, place: where?.plate ?? null, accessories: outfit.map((w) => outfitPics[w]).filter((x): x is string => Boolean(x)), max: card.inputImages });
  const price = studioPrice({
    modelId, settings, firstFrame: images.length > 0, referenceCount: priceReferences.length,
    otherUsd: card.provider === "comfy" ? cloudPrice(card.id, toWireSettings(card.settings, settings), outputCount(card, settings)) : null,
  });
  const costLabel = price.label;
  const needsImage = card.inputImages > 0 && images.length === 0;

  const attach = useCallback((files: File[]) => {
    const room = Math.max(1, card.inputImages);
    // fal accepts a data URI wherever it takes an image URL, which keeps this
    // working with no upload host. Big files make a big request body, so they are shrunk before they are sent.
    for (const file of files.slice(0, room)) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        const src = reader.result;
        setImages((held) => (held.includes(src) ? held : [...held, src].slice(-room)));
      };
      reader.readAsDataURL(file);
    }
  }, [card.inputImages]);

  const fire = useCallback(async () => {
    if (!draftReady || !prompt.trim() || busy || needsImage) return;
    setBusy(true);
    const id = nextId.current++;
    setSlots((prior) => [{ state: "working", id }, ...prior]);

    // The look's words go after the prompt, and the run keeps the prompt as it was sent.
    const cast = surface === "Edit" ? null : { characterLock: who ? identityLock(who.traits) : undefined, placeLock: where ? placeLock(where.traits) : undefined, outfit };
    const sent = surface === "Edit" ? prompt : withLook(cast ? castWords(prompt, cast) : prompt, look, surface === "Video");
    // A picture you attached is the opening frame; with none, your character's and place's sheets go in as references.
    const refs = surface === "Edit" ? [] : castReferences({ attached: images, character: who?.sheet ?? null, place: where?.plate ?? null, accessories: outfit.map((w) => outfitPics[w]).filter((x): x is string => Boolean(x)), max: card.inputImages });
    // References are drawn smaller first: two full-size sheets together can pass the host's request limit.
    const sendRefs = await shrinkAll(refs);
    const sendImages = await shrinkAll(images, 1536);
    const result: RunResult = await track({ label: `Making a ${surface === "Edit" ? "picture edit" : "picture"}`, href: window.location.pathname + window.location.search, failure: (r) => (r.ok ? null : r.reason) }, () => sendStudioGeneration(run, {model:modelId, prompt:sent, settings, images:sendImages, references:sendRefs})).catch((e: unknown): RunResult => ({ ok: false, reason: looksTooBig(e) ? "Those pictures were too big to send together. Try one reference, or smaller pictures." : e instanceof Error ? e.message : "The picture didn't finish." }));

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

  /** Claude rewrites the prompt into a fuller one; it lands in the box to read and change, and nothing is made. */
  const improve = useCallback(async () => {
    setImproving(true);
    setImproveNote(null);
    const r = await improvePrompt(prompt, surface);
    setImproving(false);
    if (r.ok) setPrompt(r.prompt);
    else {
      if (r.needsKey) openKeys();
      setImproveNote(r.reason);
    }
  }, [prompt, surface]);

  /** A model to try for what is typed, by plain rules; shown as a suggestion you can ignore. */
  const suggestion = useMemo(() => {
    if (prompt.trim().length < 12) return null;
    const r = recommend(prompt, surface, catalog.map((m) => ({ id: m.id, name: m.name, inputImages: getModelCard(m.id).inputImages })), images.length);
    return r && r.id !== modelId ? r : null;
  }, [prompt, surface, catalog, images.length, modelId]);

  return (
    <div className="app studio-app">
      <Nav current={surface === "Video" ? "Video" : "Photos"} />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}

      {/* The tabs sit in the same bar on every page, with how to show your pictures on the right. */}
      <div className="mode-bar">
        {surface === "Video" && <ModeTabs group="Video" current="/video" />}
        {surface !== "Video" && <ModeTabs group="Photos" current={surface === "Edit" ? "/edit" : "/photos"} canEdit={surfaceAvailable("Edit")} />}
        <div className="view-toggle" role="tablist" aria-label="How to show your pictures">
            <button role="tab" aria-selected={view === "grid"} onClick={() => chooseView("grid")}>Grid</button>
            <button role="tab" aria-selected={view === "workspace"} onClick={() => chooseView("workspace")}>Workspace</button>
        </div>
      </div>

      <div className="canvas" onClick={() => setPicking(false)}>
        <AcademyNudge />
        {surface !== "Video" && <MakeBanner />}
        {view === "workspace" ? (
          <Workspace
            storeKey={`workspace/${surface}`}
            items={workItems}
            onStart={(layout, name) => void startFromWorkspace(layout, name)}
            onUse={(src) => setImages((held) => (held.includes(src) ? held : [...held, src].slice(-Math.max(1, card.inputImages))))}
          />
        ) : slots.length === 0 && shownRuns.length === 0 ? (
          <div className="blank">
            <h1>
              {surface === "Edit" ? "Edit your image" : surface === "Video" ? "Make your next shot" : "Make your next image"}
            </h1>
            <p>{needsImage ? (surface === "Video" ? "Upload a starting image, describe the motion, then Generate." : surface === "Edit" ? "Upload an image, describe your changes, then Generate." : "Upload a reference, describe your image, then Generate.") : BLURB[surface]}</p>
            <p className="blank-rate">
              {card.name} · <b>{costLabel}</b> · <Link href="/gallery">Earlier work in Gallery</Link>
            </p>
            <Examples surface={surface} onUse={setPrompt} />
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
        <p id="studio-price-detail" className="wf-small" role="status" style={{ pointerEvents: "auto", background: "var(--surface)", padding: "8px 12px", borderRadius: 8, margin: "0 auto 8px", maxWidth: 980 }}>{price.detail} {modelId === "minimax/minimax-h3" && <><a href={H3_RATE_SOURCE} target="_blank" rel="noreferrer">Provider rates</a> · <a href={COMFY_UNIT_SOURCE} target="_blank" rel="noreferrer">Credit units</a></>}</p>
        {mini ? (
          <div className="composer mini">
            {images.length > 0 && (
              <div className="tray">
                {images.map((src) => (
                  <span key={src.slice(0, 64)} className="tray-item"><img src={src} alt="" /></span>
                ))}
              </div>
            )}
            <button className="mini-say" onClick={() => chooseMini(false)} title="Open the box">
              {prompt.trim() || "Describe the scene you imagine"}
            </button>
            <button className="fire" onClick={() => void fire()} disabled={busy || openOnly || !prompt.trim() || needsImage} title={openOnly ? "Open weights only is on: these models are partner APIs" : needsImage ? "Attach an image first" : undefined}>
              {busy ? "Generating…" : "Generate"}
              <span className="cost" aria-describedby="studio-price-detail">{costLabel}</span>
            </button>
            <button className="mini-toggle" onClick={() => chooseMini(false)} title="Open the box" aria-label="Open the box">▴</button>
          </div>
        ) : (
        <div className="composer compact" aria-busy={!draftReady}>
          <button className="mini-toggle" onClick={() => chooseMini(true)} title="Minimise the box" aria-label="Minimise the box">▾</button>
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
                <div className="picker-head">Models · select to estimate</div>
                {searchModels(hunt)
                  .filter((model) => catalog.includes(model))
                  .map((model) => {
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
                        <span className="opt-rate">
                          {model.id === modelId ? costLabel : "Select to estimate"}
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
              {images.map((src, index) => (
                <span key={`image-${index}`} className="tray-item">
                  <img src={src} alt={`Uploaded ${surface === "Video" && index === 0 ? "starting frame" : "reference"} ${index + 1}`} />
                  <UploadImage label="Replace image" onAttach={(url) => setImages(held => held.map((old, i) => i === index ? url : old))} />
                  <button aria-label={`Remove image ${index + 1}`} onClick={() => setImages((held) => held.filter((x) => x !== src))} title="Remove">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="composer-top">
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

          {prompt.trim().length >= 4 && (
            <p className="suggest" onClick={(e) => e.stopPropagation()}>
              <button className="plain" disabled={improving || busy} onClick={() => void improve()}>{improving ? "Improving…" : "Improve my prompt"}</button>
              <span> Claude fills it out; read it before you make anything. A few cents on your Claude key.</span>
              {improveNote && <span className="library-error" role="alert"> {improveNote}</span>}
            </p>
          )}
          {suggestion && (
            <p className="suggest" onClick={(e) => e.stopPropagation()}>
              Try <button className="plain" onClick={() => setModelId(suggestion.id)}>{suggestion.name}</button>: {suggestion.why}
            </p>
          )}

          {/* Who, where, what they wear, then the look: one row of small chips, each opening its own picker. */}
          {surface !== "Edit" && (
            <div className="composer-chips">
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
              <LookBar value={look} onChange={changeLook} video={surface === "Video"} />
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

          {card.inputImages === 0 && <p className="takes-note">This model accepts text only. Choose an image-capable model to upload a reference.</p>}

          {pro && hasPro && (
            <div className="composer-pro" onClick={(e) => e.stopPropagation()}>
              <span className="composer-pro-tag">Pro</span>
              <SettingsRail
                only="advanced"
                fields={card.settings}
                settings={settings}
                onChange={(key, value) => setSettings((held) => ({ ...held, [key]: value }))}
              />
            </div>
          )}
          {pro && !hasPro && <p className="composer-pro-none">{card.name} has no seed, negative prompt or CFG to set.</p>}

          <div className="composer-bottom">
            <span className="composer-upload"><UploadImage inputRef={fileInput} disabled={card.inputImages === 0} onAttach={(url) => setImages(held => [...held, url].slice(-Math.max(1,card.inputImages)))} /></span>
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

            {openOnly && (
              <span className="open-stop" role="status">
                Open weights only is on. These models are partner APIs. <Link href="/workflows">Use an open-weights app</Link>
              </span>
            )}

            <span className="wf-small composer-draft" role="status">{draftNotice}</span>

            <button
              className="fire"
              onClick={() => void fire()}
              disabled={busy || openOnly || !prompt.trim() || needsImage}
              title={openOnly ? "Open weights only is on: these models are partner APIs" : needsImage ? "Attach an image first" : undefined}
            >
              {busy ? "Generating…" : "Generate"}
              <span className="cost" aria-describedby="studio-price-detail">{costLabel}</span>
            </button>
          </div>
        </div>
        )}
      </div>

    </div>
  );
}
