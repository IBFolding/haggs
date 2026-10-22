"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MODELS, getModelCard, outputCount, searchModels } from "../catalog/models";
import { coerceSettings, defaultSettings, type Settings } from "../catalog/settings";
import { slotIn, templatesFor, type Template } from "../catalog/templates";
import type { Capability } from "../providers/types";
import { defaultKv } from "../story/kv";
import { createRunStore, type Run } from "../story/runs";
import { rates, run, type Rate } from "./actions";
import { Nav, openKeys } from "./nav";
import { REUSE_KEY } from "./gallery/gallery";
import { RunTile } from "./run-tile";
import { SaveToProject } from "./save-to-project";
import { Squares } from "./squares";
import { SettingsRail } from "./settings-rail";

/** In-flight work only. Anything finished is a Run and lives in storage. */
type Slot =
  | { state: "working"; id: number }
  | { state: "failed"; id: number; reason: string };

/** Which part of the catalog a surface shows. The nav items are these. */
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

export function Studio({ surface = "Create" }: { surface?: Surface }) {
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

  const [picking, setPicking] = useState(false);
  const [hunt, setHunt] = useState("");

  const [rateMap, setRateMap] = useState<Record<string, Rate>>({});

  const [slots, setSlots] = useState<Slot[]>([]);
  const [history, setHistory] = useState<Run[]>([]);
  const [saving, setSaving] = useState<Run | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
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

    const result = await run(modelId, prompt, settings, images.length ? images : undefined);

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
            prompt,
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
  }, [prompt, busy, needsImage, modelId, settings, images, card.name, runs]);

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
        {surface !== "Video" && (
          <nav className="modes" aria-label="Photos">
            <Link href="/photos" aria-current={surface === "Create" ? "page" : undefined}>Make</Link>
            <Link href="/edit" aria-current={surface === "Edit" ? "page" : undefined}>Edit a photo</Link>
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
            <Squares surface={surface} templates={templates} onPick={applyTemplate} />
          </div>
        ) : (
          <>
          <Squares surface={surface} templates={templates} onPick={applyTemplate} />
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
            {templates.length > 0 && (
              <div className="tpl-wrap" onClick={(e) => e.stopPropagation()}>
                <button className="tpl-open" aria-expanded={showTemplates} onClick={() => setShowTemplates((v) => !v)}>
                  Templates
                </button>
                {showTemplates && (
                  <div className="tpl-menu" role="menu">
                    {templates.map((t) => (
                      <button key={t.id} role="menuitem" onClick={() => applyTemplate(t)}>
                        <b>{t.name}</b>
                        <span>{t.blurb}</span>
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
