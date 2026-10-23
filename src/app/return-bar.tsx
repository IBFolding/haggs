"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { pickUrl, safeReturn, type PickKind } from "../story/handoff";

/**
 * Shown on a builder you were sent to from another page. It says where you
 * came from and, once you have saved, takes you back with the new one chosen.
 */
export function ReturnBar({ kind, savedId, savedName }: { kind: PickKind; savedId?: string | undefined; savedName?: string | undefined }) {
  const router = useRouter();
  const [from, setFrom] = useState<{ back: string; label: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const back = safeReturn(q.get("return"));
    if (back) setFrom({ back, label: q.get("label")?.slice(0, 40) || "where you were" });
  }, []);
  if (!from) return null;
  return (
    <div className="rb" role="status">
      <span>{savedId ? <>Saved{savedName ? ` ${savedName}` : ""}. </> : <>You’re building this for <b>{from.label}</b>. </>}</span>
      {savedId ? (
        <button className="fire" onClick={() => router.push(pickUrl(from.back, kind, savedId))}>Use {savedName || "it"} in {from.label}</button>
      ) : (
        <button className="plain" onClick={() => router.push(from.back)}>← Back to {from.label}</button>
      )}
    </div>
  );
}

/** A link to a builder that remembers where you are. */
export function BuildLink({ href, label, children, className }: { href: string; label: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        const u = new URL(href, window.location.origin);
        const here = window.location.pathname + window.location.search;
        if (safeReturn(here)) { u.searchParams.set("return", here); u.searchParams.set("label", label.slice(0, 40)); }
        router.push(u.pathname + u.search);
      }}
    >
      {children}
    </a>
  );
}

/** On Photos, when a page sent you here to make a character, a place or an accessory from a picture. */
export function MakeBanner() {
  const [info, setInfo] = useState<{ kind: string; back: string; label: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const make = q.get("make");
    const back = safeReturn(q.get("return"));
    if (back && (make === "character" || make === "place" || make === "accessory")) setInfo({ kind: make, back, label: q.get("label")?.slice(0, 40) || "where you were" });
  }, []);
  const router = useRouter();
  if (!info) return null;
  return (
    <div className="rb" role="status">
      <span>Making {info.kind === "accessory" ? "an" : "a"} <b>{info.kind}</b> for <b>{info.label}</b>. When a picture is right, press Save and choose “Into my bank”; you’ll come straight back with it chosen.</span>
      <button className="plain" onClick={() => router.push(info.back)}>← Back to {info.label}</button>
    </div>
  );
}
