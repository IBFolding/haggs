import Link from "next/link";

/**
 * The models, shown as the posters they are: what each is for, what a run
 * costs, and whether the weights are open. Prices are Comfy's published
 * partner rates; estimates, not invoices.
 */

type Model = { name: string; href: string; line: string; does: string; price: string; open?: boolean; media: string; poster?: string; kind: "video" | "image"; tint: string };

const MODELS: Model[] = [
  { name: "MiniMax H3", href: "/video", line: "Cinematic video with sound", does: "Text or a picture to a clip, 5 to 15 seconds, up to 2K.", price: "13 credits a second", media: "/templates/product-orbit.mp4", poster: "/templates/poster-product-orbit.webp", kind: "video", tint: "#35e48a" },
  { name: "FLUX 3", href: "/photos", line: "The picture model", does: "Photoreal stills, character sheets, key art, the first frame of every shot.", price: "7 credits a picture", media: "/templates/key-art.webp", kind: "image", tint: "#7dd3fc" },
  { name: "FLUX Kontext", href: "/edit", line: "Fix just one thing", does: "Change a part of a frame and nothing else, then re-render the take.", price: "4 credits a fix", media: "/showcase/outfit-1.jpg", kind: "image", tint: "#f5a524" },
  { name: "Kling Omni", href: "/swap", line: "Edit video with words", does: "Swap a person, restyle a take, recast a scene.", price: "13 credits a second", media: "/templates/dolly-zoom.mp4", poster: "/templates/poster-dolly-zoom.webp", kind: "video", tint: "#c4a7ff" },
  { name: "Runway Aleph", href: "/workflows", line: "Change the shot itself", does: "New angle, new light, same performance.", price: "Price on the button", media: "/templates/establishing-drone.mp4", poster: "/templates/poster-establishing-drone.webp", kind: "video", tint: "#ff7a90" },
  { name: "Genjutsu", href: "/recreate", line: "One video, many versions", does: "Recast any motion with your characters and places.", price: "Price on the button", media: "/templates/animate-still.mp4", poster: "/templates/poster-animate-still.webp", kind: "video", tint: "#35e48a" },
  { name: "ElevenLabs", href: "/editor", line: "Voices and sound", does: "Dry, human voices and sound effects made from words.", price: "11 credits per 1,000 letters", media: "/templates/ugc-talking.mp4", poster: "/templates/poster-ugc-talking.webp", kind: "video", tint: "#7dd3fc" },
  { name: "Qwen · Wan · LTX", href: "/docs", line: "Open weights", does: "The same jobs on weights anyone can run. Point haggs at your own GPU and they cost nothing.", price: "Free on your GPU", open: true, media: "/templates/location-plate.webp", kind: "image", tint: "#35e48a" },
];

export function ModelsWall() {
  return (
    <section className="mw" aria-label="The models">
      <h2 data-kicker="The models">The models, and what each one is for.</h2>
      <p className="mw-lede">Everything runs on Comfy. Pick the model for the job, see the price first, and swap any step for an open-weights one.</p>
      <ul className="mw-row">
        {MODELS.map((m) => (
          <li key={m.name} className="mw-card" style={{ "--tint": m.tint } as React.CSSProperties}>
            {m.kind === "video" ? <video src={m.media} poster={m.poster} muted loop playsInline autoPlay preload="none" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.media} alt="" loading="lazy" />}
            <Link className="mw-link" href={m.href} aria-label={`${m.name}: ${m.line}`} />
            <div className="mw-shade" />
            {m.open && <span className="mw-open">Open weights</span>}
            <div className="mw-text">
              <small>{m.line}</small>
              <b>{m.name}</b>
              <p>{m.does}</p>
              <em>{m.price}</em>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
