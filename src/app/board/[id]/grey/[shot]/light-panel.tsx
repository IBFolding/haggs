"use client";

import { actorShadow, addLight, removeLight, setAtmos, setLook, setShadow, updateLight, NEUTRAL, type AtmosKind, type GreyScene, type LightKind, type Look } from "../../../../../story/grey-scene";
import { MAX_POWER } from "../../../../../story/grey-scene";
import { Slide } from "./set-panel";

const LIGHTS: { kind: LightKind; label: string; says: string }[] = [
  { kind: "key", label: "Key", says: "The main light, strong and from one side." },
  { kind: "fill", label: "Fill", says: "Softens the shadows the key leaves." },
  { kind: "glow", label: "Glow", says: "A warm pool of light, like a fire or a streetlamp." },
  { kind: "practical", label: "Lamp", says: "A small bright lamp that's in the scene." },
];

const AIR: { kind: AtmosKind; label: string }[] = [
  { kind: "fog", label: "Fog" }, { kind: "rain", label: "Rain" }, { kind: "snow", label: "Snow" },
  { kind: "dust", label: "Dust" }, { kind: "embers", label: "Embers" }, { kind: "beams", label: "Light beams" },
];

const LOOKS: { name: string; look: Look }[] = [
  { name: "Neutral", look: NEUTRAL },
  { name: "Warm evening", look: { exposure: -0.1, contrast: 0.15, warmth: 0.6, saturation: 0.1, vignette: 0.3 } },
  { name: "Cold night", look: { exposure: -0.25, contrast: 0.2, warmth: -0.7, saturation: -0.2, vignette: 0.45 } },
  { name: "Faded film", look: { exposure: 0.05, contrast: -0.2, warmth: 0.2, saturation: -0.35, vignette: 0.2 } },
];

/** The Light step: lights you drag on the picture, the colour of the whole frame, and what's in the air. */
export function LightPanel({ scene, selected, onSelect, onChange }: { scene: GreyScene; selected: string | null; onSelect: (id: string | null) => void; onChange: (next: GreyScene) => void }) {
  const look = { ...NEUTRAL, ...scene.look };
  const sel = scene.lights?.find((l) => l.id === selected) ?? null;
  return (
    <div className="gs-panel">
      <section className="gs-sec">
        <h3>Lights</h3>
        <div className="gs-row">
          {LIGHTS.map((l) => (
            <button key={l.kind} className="pill" title={l.says} onClick={() => { const next = addLight(scene, l.kind); onChange(next); onSelect(next.lights!.at(-1)!.id); }}>+ {l.label}</button>
          ))}
        </div>
        <p className="gs-soft">Drag the dots on the picture to place a light. These are quick, flat lights that show the mood; they don't cast real shadows.</p>
        {sel && (
          <div className="gs-sliders" aria-label={`${sel.kind} light controls`}>
            <label className="gs-slide"><span>Colour</span><input type="color" value={sel.color} onChange={(e) => onChange(updateLight(scene, sel.id, { color: e.target.value }))} /></label>
            <Slide label="Strength" min={0} max={1} step={0.01} value={sel.intensity} onChange={(v) => onChange(updateLight(scene, sel.id, { intensity: v }))} />
            <Slide label="Spread" min={0.05} max={1.5} step={0.01} value={sel.size} onChange={(v) => onChange(updateLight(scene, sel.id, { size: v }))} />
            {process.env.NEXT_PUBLIC_HOSTED !== "1" && (
              <>
                <div className="gs-row">
                  <button className={`pill${sel.spot ? " on" : ""}`} aria-pressed={sel.spot === true} onClick={() => onChange(updateLight(scene, sel.id, { spot: !sel.spot }))}>Spotlight</button>
                  <button className="plain" disabled={sel.power === undefined} onClick={() => onChange(updateLight(scene, sel.id, { power: Number.NaN }))}>Power: auto</button>
                </div>
                <Slide label="Power (W)" min={0} max={MAX_POWER} step={50} value={sel.power ?? Math.round(1500 * sel.intensity * Math.max(0.3, sel.size))} onChange={(v) => onChange(updateLight(scene, sel.id, { power: v }))} />
                <small className="gs-soft">Spotlight and power only change the Blender set. Auto follows strength and spread.</small>
              </>
            )}
            <button className="plain" onClick={() => { onChange(removeLight(scene, sel.id)); onSelect(null); }}>Remove this light</button>
          </div>
        )}
      </section>

      <section className="gs-sec">
        <h3>Look</h3>
        <div className="gs-row">
          {LOOKS.map((l) => <button key={l.name} className="pill" onClick={() => onChange(setLook(scene, l.look))}>{l.name}</button>)}
        </div>
        <div className="gs-sliders">
          {([["exposure", "Brightness", -1, 1], ["contrast", "Contrast", -1, 1], ["warmth", "Warm ↔ cool", -1, 1], ["saturation", "Colour", -1, 1], ["vignette", "Dark edges", 0, 1]] as const).map(([key, label, min, max]) => (
            <Slide key={key} label={label} min={min} max={max} step={0.01} value={look[key]} onChange={(v) => onChange(setLook(scene, { [key]: v }))} />
          ))}
        </div>
      </section>

      <section className="gs-sec">
        <h3>Shadows</h3>
        <div className="gs-sliders">
          <Slide label="Actor" min={0} max={1} step={0.05} value={actorShadow(scene).amount} onChange={(v) => onChange(setShadow(scene, { amount: v }))} />
          <Slide label="Falls toward" min={0} max={359} step={5} value={actorShadow(scene).angle} onChange={(v) => onChange(setShadow(scene, { angle: v }))} />
        </div>
        <p className="gs-soft">Props get a soft contact shadow of their own; change it under Set. These are fakes that sell the picture, not simulated light.</p>
      </section>

      <section className="gs-sec">
        <h3>In the air</h3>
        <div className="gs-sliders">
          {AIR.map((a) => <Slide key={a.kind} label={a.label} min={0} max={1} step={0.05} value={scene.atmos?.find((x) => x.kind === a.kind)?.amount ?? 0} onChange={(v) => onChange(setAtmos(scene, a.kind, v))} />)}
        </div>
      </section>
    </div>
  );
}
