"use client";

import { useEffect, useMemo, useState } from "react";

import { defaultKv } from "../../../../../story/kv";
import { sceneIsEmpty, type GreyScene } from "../../../../../story/grey-scene";
import { applySet, captureSet, createSetStore, type SavedSet } from "../../../../../story/set-bank";

/** Saved sets: keep the room you built, put it on another shot, or on every shot in the scene. */
export function SetsPanel({ scene, others, onUse, onUseEverywhere }: {
  scene: GreyScene;
  /** How many other shots on this board the set could go on. */
  others: number;
  onUse: (next: GreyScene) => void;
  onUseEverywhere: (set: SavedSet) => void;
}) {
  const store = useMemo(() => createSetStore(defaultKv()), []);
  const [sets, setSets] = useState<SavedSet[]>([]);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const empty = sceneIsEmpty({ ...scene, matte: undefined as never });

  useEffect(() => { void store.list().then(setSets); }, [store]);

  async function save() {
    setProblem(null);
    try {
      await store.save(captureSet(scene, name));
      setName("");
      setSets(await store.list());
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "It couldn't be saved.");
    }
  }

  return (
    <section className="gs-sec">
      <h3>Saved sets</h3>
      <p className="gs-soft">Keep this set — the room, props, lights and look — to use again on another shot. It doesn't include the actor.</p>
      <div className="gs-row">
        <input className="gs-name" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Victorian dining room" aria-label="Name for this set" />
        <button className="pill" disabled={empty || !name.trim()} onClick={() => void save()}>Save this set</button>
      </div>
      {problem && <p className="library-error" role="alert">{problem}</p>}
      {sets.length > 0 && (
        <ul className="gs-layers" aria-label="Your saved sets">
          {sets.map((s) => (
            <li key={s.id}>
              <span className="gs-lname" title={s.name}>{s.name} <small className="gs-soft">{s.scene.props?.length ?? 0} props</small></span>
              <span className="gs-lact gs-lact-text">
                <button onClick={() => { onUse(applySet(scene, s)); setDone(`${s.name} is on this shot.`); }}>Use here</button>
                {others > 0 && (confirm === s.id
                  ? <button className="warn" onClick={() => { onUseEverywhere(s); setConfirm(null); setDone(`${s.name} is on all ${others + 1} shots. Each still needs its own cut-out.`); }}>Replace {others} other sets?</button>
                  : <button onClick={() => setConfirm(s.id)}>Use on all</button>)}
                <button aria-label={`Delete ${s.name}`} title="Delete" onClick={async () => { await store.remove(s.id); setSets(await store.list()); }}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {done && <p className="gs-done" role="status">{done}</p>}
    </section>
  );
}
