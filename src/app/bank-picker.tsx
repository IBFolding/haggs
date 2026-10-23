"use client";

import { useCallback, useEffect, useState } from "react";

import { createAccessoryStore } from "../accessories/accessory";
import { createCharacterStore } from "../characters/character";
import { createPlaceStore } from "../locations/location";
import { KIND_NAME, fromAccessory, fromCharacter, fromPlace, type BankItem } from "../story/bank";
import { readPick, type PickKind } from "../story/handoff";
import { defaultKv } from "../story/kv";
import { BuildLink } from "./return-bar";

/** Everything in the bank, loaded from your browser. */
export async function loadBank(): Promise<BankItem[]> {
  const kv = defaultKv();
  const [c, p, a] = await Promise.all([createCharacterStore(kv).list().catch(() => []), createPlaceStore(kv).list().catch(() => []), createAccessoryStore(kv).list().catch(() => [])]);
  return [...c.map(fromCharacter), ...p.map(fromPlace), ...a.map(fromAccessory)];
}

/**
 * When a builder sends you back with `?pick=kind:id`, hand that item to the
 * page once and take the mark off the address, so a reload doesn't pick it again.
 */
export function useReturnedPick(accept: PickKind[], onPick: (item: BankItem) => void) {
  const acceptKey = accept.join();
  useEffect(() => {
    const pick = readPick(window.location.search);
    if (!pick || !acceptKey.split(",").includes(pick.kind)) return;
    void loadBank().then((all) => {
      const found = all.find((i) => i.kind === pick.kind && i.id === pick.id);
      if (found) onPick(found);
      const u = new URL(window.location.href);
      u.searchParams.delete("pick");
      window.history.replaceState(null, "", u.pathname + u.search);
    });
    // Once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptKey]);
}

/**
 * Choose from your bank without leaving the page: your characters, places
 * and accessories as pictures, and a way to make a new one that brings you
 * straight back here with it chosen.
 */
export function BankPicker({ kinds, label, onPick, onClose, picked = [] }: { kinds: PickKind[]; label: string; onPick: (item: BankItem) => void; onClose: () => void; picked?: string[] }) {
  const [items, setItems] = useState<BankItem[] | null>(null);
  const [tab, setTab] = useState<PickKind>(kinds[0]!);
  useEffect(() => { void loadBank().then(setItems); }, []);
  const close = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [close]);
  const shown = (items ?? []).filter((i) => i.kind === tab);
  return (
    <div className="veil" onClick={onClose}>
      <div className="sheet wide bank" role="dialog" aria-label="Choose from your bank" onClick={(e) => e.stopPropagation()}>
        <header className="bank-head">
          <h2>From your bank</h2>
          <button className="plain" onClick={onClose} aria-label="Close">×</button>
        </header>
        {kinds.length > 1 && (
          <div className="lab-chips" role="tablist">
            {kinds.map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{KIND_NAME[k].many}</button>)}
          </div>
        )}
        {items === null ? <p className="wf-small">Opening your bank…</p> : (
          <div className="bank-grid">
            {shown.map((i) => (
              <button key={i.id} className={picked.includes(`${i.kind}:${i.id}`) ? "on" : ""} onClick={() => { onPick(i); onClose(); }} title={i.words}>
                {i.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt="" /> : <span className="cm-noimg">{i.name.slice(0, 1)}</span>}
                <b>{i.name}</b>
              </button>
            ))}
            <BuildLink href={KIND_NAME[tab].builder} label={label} className="bank-new">+ Make a new {KIND_NAME[tab].one}</BuildLink>
          </div>
        )}
        {items !== null && shown.length === 0 && <p className="wf-small">No {KIND_NAME[tab].many.toLowerCase()} yet. Make one and you come straight back here with it chosen.</p>}
      </div>
    </div>
  );
}

/**
 * "Where it is and what they wear": the places and accessories chosen for a
 * piece of work, with a way to add from the bank or make a new one and come
 * straight back with it added.
 */
export function ExtrasRow({ items, onChange, label, title = "Where and what they wear" }: { items: BankItem[]; onChange: (items: BankItem[]) => void; label: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const add = useCallback((item: BankItem) => onChange(items.some((i) => i.kind === item.kind && i.id === item.id) ? items : [...items, item]), [items, onChange]);
  useReturnedPick(["place", "accessory"], add);
  return (
    <div className="extras">
      <b>{title}</b>
      <div className="lab-chips small">
        {items.map((i) => <button key={`${i.kind}:${i.id}`} onClick={() => onChange(items.filter((x) => x !== i))} title="Remove">{i.name} ×</button>)}
        <button className="on" onClick={() => setOpen(true)}>+ From your bank</button>
      </div>
      {open && <BankPicker kinds={["place", "accessory"]} label={label} onPick={add} onClose={() => setOpen(false)} picked={items.map((i) => `${i.kind}:${i.id}`)} />}
    </div>
  );
}
