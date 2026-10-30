"use client";
import { useRef, useState } from "react";
import type { Panel } from "../../comic/comic";
import { animationRequest, type PanelAnimation } from "../../comic/living";
import { estimateGeneration, run } from "../actions";
import { creditsText } from "../../story/price-text";

export function AnimatePanel({ panel, picture, onAnimation, onBusy }: { panel: Panel; picture: string; onAnimation: (clip: PanelAnimation) => void; onBusy: (busy: boolean) => void }) {
  const request = animationRequest(panel, picture);
  const fingerprint = JSON.stringify(request);
  const [quote, setQuote] = useState<{ key: string; usd: number | null; basis: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function perform(generate: boolean) {
    if (pending.current || (generate && (quote?.key !== fingerprint || quote.usd == null))) return;
    pending.current = true; setBusy(true); onBusy(true); setMessage("");
    try {
      if (!generate) {
        const price = await estimateGeneration(request.model, request.prompt, request.settings, request.images, true);
        setQuote({ ...price, key: fingerprint });
      } else {
        setQuote(null);
        const result = await run(request.model, request.prompt, request.settings, request.images, true);
        if (!result.ok) { setMessage(result.reason); return; }
        const clip = result.shots.find(s => s.kind === "video");
        if (!clip) { setMessage("No video returned. Your existing artwork and animation are preserved."); return; }
        onAnimation({ url: clip.url, source: picture, prompt: request.prompt, model: request.model });
        setMessage("Animation saved to this panel. Read it on the living page.");
      }
    } catch { setMessage(generate ? "The request did not finish. Check provider activity before retrying; no automatic retry was sent." : "Estimate unavailable. No generation was submitted."); }
    finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  return <div>
    <p className="wf-small">Animate this artwork · MiniMax H3 · {request.settings.duration}s · 768P. One paid clip per click.</p>
    <button type="button" className="pill" disabled={busy} onClick={() => void perform(false)}>Estimate panel animation</button>
    {quote?.key === fingerprint && <p role="status">{quote.usd == null ? "Price unavailable" : `Estimated ${creditsText(quote.usd)}`} · {quote.basis}</p>}
    <button type="button" className="pill" disabled={busy || quote?.key !== fingerprint || quote.usd == null} onClick={() => void perform(true)}>Generate panel animation{quote?.key === fingerprint && quote.usd != null ? ` · about ${creditsText(quote.usd)}` : ""}</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
