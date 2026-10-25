import { examplesFor } from "../samples/examples";

/** Real results with the prompt that made each, on the empty page. Press one to put its prompt in the box. */
export function Examples({ surface, onUse }: { surface: string; onUse: (prompt: string) => void }) {
  const list = examplesFor(surface);
  if (!list.length) return null;
  return (
    <section className="examples" aria-label="Examples">
      <h2>See what it makes</h2>
      <ul>
        {list.map((e) => (
          <li key={e.src}>
            {e.kind === "video" ? <video src={e.src} muted loop playsInline autoPlay preload="metadata" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.src} alt="" loading="lazy" />}
            <small>{e.model} · {e.cost}</small>
            <button className="pill" onClick={() => onUse(e.prompt)}>Use this prompt</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
