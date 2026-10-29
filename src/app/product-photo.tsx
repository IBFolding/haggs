"use client";

import { useRef, useState } from "react";

import { productPhotoPrompt, samplePhotoFor, type SavedProduct } from "../brand/product";
import { SAMPLES } from "../brand/samples";
import { creditsText } from "../story/price-text";
import { galleryStill } from "./gallery-log";
import { openKeys } from "./nav";
import { makeStill } from "./series-actions";
import { uploadFile } from "./upload-client";

const PRICE = 0.07;

/**
 * A product's photo: add your own, make one from what it looks like (one picture, priced on the button), or, for one of
 * the Ads samples, use its ready photo. The photo is what the ads keep the product looking like.
 */
export function ProductPhoto({ product, onPicture }: { product: SavedProduct; onPicture: (url: string | null) => Promise<void> }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const sample = samplePhotoFor(product, SAMPLES);

  async function add(f: File) {
    if (!f.type.startsWith("image/") || f.size > 20 * 1024 * 1024) return setProblem("Choose a picture under 20 MB.");
    setBusy("Adding…"); setProblem(null);
    const r = await uploadFile(f);
    if (!r.ok || r.kind !== "image") { setBusy(null); return setProblem(r.ok ? "Choose a picture." : r.reason); }
    await onPicture(r.url);
    setBusy(null);
  }

  async function make() {
    setBusy("Making…"); setProblem(null);
    const prompt = productPhotoPrompt(product);
    const r = await makeStill(prompt, "1:1", [], "");
    galleryStill(prompt, "Product photo")(r);
    if (!r.ok) { setBusy(null); if (r.needsKey) openKeys(); return setProblem(r.reason); }
    await onPicture(r.url);
    setBusy(null);
  }

  return (
    <div className="pp" aria-label={`Photo of ${product.name}`}>
      <span className="pp-pic">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {product.picture ? <img src={product.picture} alt={product.name} /> : <i>{product.name.slice(0, 1)}</i>}
      </span>
      <div className="pp-side">
        <b>{product.name}</b>
        <small>{product.picture ? "The ads keep it looking like this photo." : "No photo yet. Ads draw it from its words alone."}</small>
        <div className="cm-row">
          <button className="pill" disabled={busy !== null} onClick={() => file.current?.click()}>{product.picture ? "Change the photo" : "Add a photo"}</button>
          <button className="pill" disabled={busy !== null || (product.words.trim().length + product.name.trim().length) < 4} onClick={() => void make()}>{busy === "Making…" ? "Making…" : "Make one"} <span className="cost">about {creditsText(PRICE)}</span></button>
          {sample && product.picture !== sample && <button className="pill" disabled={busy !== null} onClick={() => void onPicture(sample)}>Use the sample photo</button>}
          {product.picture && <button className="plain" disabled={busy !== null} onClick={() => void onPicture(null)}>Remove</button>}
        </div>
        {busy === "Adding…" && <small role="status">Adding…</small>}
        {problem && <small className="library-error" role="alert">{problem}</small>}
      </div>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void add(f); }} />
    </div>
  );
}
