"use client";

import { useEffect, useState } from "react";

import { makeMusic, quoteMusic } from "../../../actions";
import { galleryAudio } from "../../../gallery-log";
import { openKeys } from "../../../nav";
import { creditsText } from "../../../../story/price-text";

const LOW = 5;
const HIGH = 180;

/** Music from words, at the length of the film by default. The price shows before you press Make. */
export function MusicMaker({ seconds, onMade }: { seconds: number; onMade: (music: { url: string; name: string }) => void }) {
  const [text, setText] = useState("");
  const [length, setLength] = useState(() => Math.min(HIGH, Math.max(LOW, Math.round(seconds || 30))));
  const [price, setPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void quoteMusic(length).then((p) => live && setPrice(p));
    return () => { live = false; };
  }, [length]);

  async function make() {
    setBusy(true);
    setError(null);
    const r = await makeMusic(text, length);
    setBusy(false);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    galleryAudio(r.url, text, "Music", r.usd);
    onMade({ url: r.url, name: text.trim().slice(0, 40) });
    setText("");
  }

  return (
    <div className="music-maker">
      <label>
        Or describe the music
        <input type="text" maxLength={500} placeholder="Slow strings that swell, then a single piano" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label>
        Seconds
        <input type="number" min={LOW} max={HIGH} value={length} onChange={(e) => setLength(Math.min(HIGH, Math.max(LOW, Math.round(Number(e.target.value) || LOW))))} />
      </label>
      <button className="pill" disabled={busy || text.trim().length < 4} onClick={() => void make()}>
        {busy ? "Making…" : price === null ? "Make music" : `Make music · ${creditsText(price)}`}
      </button>
      {error && <p className="library-error" role="alert">{error}</p>}
    </div>
  );
}
