"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { defaultKv } from "../../story/kv";
import { recoveryReferences } from "../../story/recovery-references";
import { useSession } from "../session";
import type { RunStore } from "../../story/runs";
import { hasAmbiguousLegacy, recoveryId, unrecovered } from "../../story/comfy-recovery";
import { openKeys } from "../nav";
import { listComfyRenders, recoverComfyRender, type Recoverable } from "../recover-actions";

const idOf = recoveryId;

/**
 * Bring back renders you made earlier from your own Comfy account. It only
 * reads what Comfy still has; nothing is generated and nothing is charged.
 */
export function RecoverPanel({ runs, added, onAdded }: { runs: RunStore; added: Set<string>; onAdded: () => void }) {
  const [items, setItems] = useState<Recoverable[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const {session}=useSession();
  const owner=session?.user.id;
  const currentOwner=useRef(owner);currentOwner.current=owner;
  const references=useMemo(()=>owner?recoveryReferences(defaultKv(),owner):null,[owner]);
  useEffect(()=>{let active=true;setItems(null);setDone(new Set());if(references)void references.read().then(saved=>{if(active&&saved.length){setItems(saved);setNote("Saved recovery references. Add reads the original from your own Comfy account; it does not use the expired preview link or generate again.");}},()=>undefined);return()=>{active=false;};},[references]);


  async function load() {
    const scope=owner;
    setBusy("list");
    setNote(null);
    try {
      const r = await listComfyRenders();
      if(scope!==currentOwner.current)return;
      if (!r.ok) { if (r.needsKey) openKeys(); return setNote(r.reason); }
      const saved=references?await references.remember(r.items):[];
      if(scope!==currentOwner.current)return;
      const byId=new Map(saved.map(item=>[idOf(item),item as Recoverable]));
      for(const item of r.items)byId.set(idOf(item),item);
      setItems([...byId.values()]);
      if (!r.items.length) setNote(saved.length ? "Comfy returned no recent files. Saved references remain available, but the provider may have removed their originals." : "Comfy has no finished renders for this account to bring back.");
    } catch { setNote("Your Comfy account couldn't be reached. Try looking again."); }
    finally { setBusy(null); }
  }

  async function add(item: Recoverable): Promise<boolean> {
    const scope=owner;if(scope!==currentOwner.current)return false;
    try {
      const got = await recoverComfyRender(item);
      if(scope!==currentOwner.current)return false;
      if (!got.ok) { setNote(got.reason); return false; }
      await runs.record({ modelId: "comfy-recovered", modelName: "Recovered from Comfy", prompt: `Recovered: ${item.filename}`, settings: {}, url: got.url, kind: item.kind, usd: null, comfyJob: idOf(item) }, item.at || undefined);
      setDone((d) => new Set(d).add(idOf(item)));
      return true;
    } catch { setNote("Haggs couldn't confirm that the render was saved. Check your Gallery before adding it again; no new generation was started."); return false; }
  }

  const fresh = unrecovered(items ?? [],new Set([...added,...done]));
  const ambiguous = hasAmbiguousLegacy(items ?? [], added);

  return (
    <section className="rc" aria-label="Bring back earlier renders">
      <div className="rc-head">
        <div>
          <b>Bring back earlier renders</b>
          <small>Reads your Comfy account for finished renders. Free, and nothing is generated.</small>
        </div>
        <button className="pill" disabled={busy !== null} onClick={() => void load()}>{busy === "list" ? "Looking…" : items ? "Look again" : "Look in Comfy"}</button>
      </div>
      {note && <p className="gallery-note" role="status">{note}</p>}
      {items && fresh.length > 0 && (
        <>
          <div className="rc-bar">
            <span>{fresh.length} available to add</span>
            <button className="fire" disabled={busy !== null || ambiguous} onClick={async () => { setBusy("all"); for (const i of fresh) if (!(await add(i))) break; setBusy(null); onAdded(); }}>{busy === "all" ? "Adding…" : "Add all"}</button>
          </div>
          {ambiguous && <p className="gallery-note">Some older saves may already be in your Gallery. Check the previews and add the ones you want individually.</p>}
          <ul className="rc-grid">
            {fresh.map((i) => (
              <li key={idOf(i)}>
                {i.preview ? (i.kind === "video" ? <video src={i.preview} muted playsInline preload="metadata" /> : i.kind === "audio" ? <audio src={i.preview} controls preload="none" /> : <img src={i.preview} alt="" loading="lazy" />) : <span className="rc-none">No preview</span>}
                <small>{i.at ? new Date(i.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : i.kind}</small>
                <button className="plain" disabled={busy !== null} onClick={async () => { setBusy(idOf(i)); await add(i); setBusy(null); onAdded(); }}>{busy === idOf(i) ? "Adding…" : "Add"}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {items && items.length > 0 && fresh.length === 0 && <p className="gallery-note">Everything Comfy still has is already in your Gallery.</p>}
    </section>
  );
}
