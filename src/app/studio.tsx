"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MODELS, getModelCard, outputCount, searchModels } from "../catalog/models";
import { coerceSettings, defaultSettings, type Settings } from "../catalog/settings";
import type { Capability } from "../providers/types";
import { defaultKv } from "../story/kv";
import { createRunStore, type Run } from "../story/runs";
import { clearKey, hasKey, rates, run, saveKey, type Rate } from "./actions";
import { Nav } from "./nav";
import { REUSE_KEY } from "./gallery/gallery";
import { RunTile } from "./run-tile";
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
  const [keyed, setKeyed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [history, setHistory] = useState<Run[]>([]);
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
    void hasKey().then(setKeyed);
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

    if (!result.ok && result.needsKey) setSheet(true);
    setBusy(false);
  }, [prompt, busy, needsImage, modelId, settings, images, card.name, runs]);

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

  const commitKey = useCallback(async () => {
    await saveKey(keyDraft);
    setKeyed(true);
    setKeyDraft("");
    setSheet(false);
  }, [keyDraft]);

  return (
    <div className="app">
      <Nav current={surface}>
        <button className="key-state" onClick={() => setSheet(true)}>
          <span className={`lamp${keyed ? " live" : ""}`} />
          {keyed ? "fal connected" : "no key"}
        </button>
      </Nav>

      <div className="canvas" onClick={() => setPicking(false)}>
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
              />
            ))}
          </div>
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
            <textarea
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

      {sheet && (
        <div className="veil" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <h3>{keyed ? "fal key connected" : "Connect a fal key"}</h3>
            <p>
              Generation runs on your own fal account. The key is posted once and
              kept in an httpOnly cookie — it never reaches client JavaScript, and
              we never see it. Create one at{" "}
              <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer">
                fal.ai/dashboard/keys
              </a>
              .
            </p>
            <input
              type="password"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
              placeholder="fal key"
              autoFocus
            />
            <div className="sheet-row">
              <button className="fire" onClick={() => void commitKey()} disabled={!keyDraft.trim()}>
                Save key
              </button>
              {keyed && (
                <button
                  className="plain"
                  onClick={() => void clearKey().then(() => setKeyed(false))}
                >
                  Disconnect
                </button>
              )}
              <button className="plain" onClick={() => setSheet(false)}>
                Close
              </button>
            </div>
            <div className="sheet-note">
              Browsing and pricing work without a key — every rate on this page came
              from fal&rsquo;s published prices. Only generation needs one.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
