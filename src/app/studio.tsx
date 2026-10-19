"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_MODEL, MODELS, getModelCard, searchModels } from "../catalog/models";
import type { AspectRatio } from "../providers/types";
import { clearKey, hasKey, rates, run, saveKey, type Rate, type Shot } from "./actions";
import { Nav } from "./nav";

type Slot =
  | { state: "working"; id: number }
  | { state: "done"; id: number; shot: Shot; label: string }
  | { state: "failed"; id: number; reason: string };

export function Studio() {
  const [modelId, setModelId] = useState(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<AspectRatio>("1:1");
  const [count, setCount] = useState(1);

  const [picking, setPicking] = useState(false);
  const [hunt, setHunt] = useState("");
  const [ratioOpen, setRatioOpen] = useState(false);

  const [rateMap, setRateMap] = useState<Record<string, Rate>>({});
  const [keyed, setKeyed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);

  const card = useMemo(() => getModelCard(modelId), [modelId]);
  const rate = rateMap[modelId];

  useEffect(() => {
    void rates().then((list) => setRateMap(Object.fromEntries(list.map((r) => [r.id, r]))));
    void hasKey().then(setKeyed);
  }, []);

  // A model that cannot do the current ratio or count has to pull them back
  // into range, or the request is built against settings the endpoint rejects.
  useEffect(() => {
    if (!card.ratios.includes(ratio)) setRatio(card.ratios[0]!);
    if (count > card.maxCount) setCount(card.maxCount);
  }, [card, ratio, count]);

  /** What the run will cost, in dollars, before it runs. */
  const cost = useMemo(() => {
    if (!rate || rate.usd === null) return null;
    const perOutput = rate.unit === "image" || rate.unit === "video";
    return rate.usd * (perOutput ? count : 1);
  }, [rate, count]);

  const costLabel = cost === null ? (rate ? rate.label : "···") : `$${cost.toFixed(3)}`;

  const fire = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    const id = nextId.current++;
    setSlots((prior) => [{ state: "working", id }, ...prior]);

    const result = await run(modelId, prompt, ratio, count);

    setSlots((prior) => {
      const rest = prior.filter((slot) => slot.id !== id);
      if (!result.ok) {
        return [{ state: "failed", id, reason: result.reason }, ...rest];
      }
      const made = result.shots.map((shot, index) => ({
        state: "done" as const,
        id: nextId.current++,
        shot,
        label: `${card.name}${index > 0 ? ` · ${index + 1}` : ""}`,
      }));
      return [...made, ...rest];
    });

    if (!result.ok && result.needsKey) setSheet(true);
    setBusy(false);
  }, [prompt, busy, modelId, ratio, count, card.name]);

  const commitKey = useCallback(async () => {
    await saveKey(keyDraft);
    setKeyed(true);
    setKeyDraft("");
    setSheet(false);
  }, [keyDraft]);

  return (
    <div className="app">
      <Nav current="Create">
        <button className="key-state" onClick={() => setSheet(true)}>
          <span className={`lamp${keyed ? " live" : ""}`} />
          {keyed ? "fal connected" : "no key"}
        </button>
      </Nav>

      <div className="canvas" onClick={() => { setPicking(false); setRatioOpen(false); }}>
        {slots.length === 0 ? (
          <div className="blank">
            <div className="strip">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="strip-cell" />
              ))}
            </div>
            <h1>
              Start creating with <b>{card.name}</b>
            </h1>
            <p>
              Describe a scene, character, mood or style. The price is on the button
              before you press it — in dollars, not credits.
            </p>
          </div>
        ) : (
          <div className="grid">
            {slots.map((slot) => {
              if (slot.state === "working") {
                return <div key={slot.id} className="cell working" />;
              }
              if (slot.state === "failed") {
                return (
                  <div key={slot.id} className="cell failed">
                    <span className="cell-err">{slot.reason}</span>
                  </div>
                );
              }
              return (
                <div key={slot.id} className="cell">
                  {slot.shot.kind === "video" ? (
                    <video src={slot.shot.url} autoPlay loop muted playsInline />
                  ) : (
                    <img src={slot.shot.url} alt="" />
                  )}
                  <span className="cell-tag">{slot.label}</span>
                </div>
              );
            })}
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
                {searchModels(hunt).map((model) => {
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

          {ratioOpen && (
            <div className="picker" style={{ width: 190 }} onClick={(e) => e.stopPropagation()}>
              <div className="picker-list">
                <div className="picker-head">Aspect</div>
                {card.ratios.map((option) => (
                  <button
                    key={option}
                    className="opt"
                    aria-selected={option === ratio}
                    onClick={() => {
                      setRatio(option);
                      setRatioOpen(false);
                    }}
                  >
                    <span className="opt-main">
                      <span className="opt-name">{option}</span>
                    </span>
                    {option === ratio && <span className="tick">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="composer-top">
            <button className="attach" title="Attach an image">+</button>
            <textarea
              className="say"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the scene you imagine"
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
                setRatioOpen(false);
              }}
            >
              {card.name}
              <span className="caret">▾</span>
            </button>

            <button
              className="pill"
              onClick={(event) => {
                event.stopPropagation();
                setRatioOpen((open) => !open);
                setPicking(false);
              }}
            >
              {ratio}
              <span className="caret">▾</span>
            </button>

            {card.maxCount > 1 && (
              <span className="stepper">
                <button onClick={() => setCount((n) => Math.max(1, n - 1))} disabled={count <= 1}>
                  −
                </button>
                <span>
                  {count}/{card.maxCount}
                </span>
                <button
                  onClick={() => setCount((n) => Math.min(card.maxCount, n + 1))}
                  disabled={count >= card.maxCount}
                >
                  +
                </button>
              </span>
            )}

            <button className="fire" onClick={() => void fire()} disabled={busy || !prompt.trim()}>
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
