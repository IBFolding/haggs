/**
 * The hero's picture: three columns of real results sliding past, tilted,
 * each tagged with the model that made it. All of it came out of haggs on
 * Comfy; the clips are playing, not posters.
 */

type Item = { src: string; kind: "video" | "image"; tag: string; poster?: string };

const A: Item[] = [
  { src: "/showcase/recreate-outfit-check.mp4", poster: "/showcase/recreate-outfit-check.jpg", kind: "video", tag: "Recreate · MiniMax H3" },
  { src: "/showcase/outfit-0.jpg", kind: "image", tag: "FLUX 3" },
  { src: "/templates/dolly-zoom.mp4", poster: "/templates/poster-dolly-zoom.webp", kind: "video", tag: "Dolly zoom · MiniMax H3" },
  { src: "/showcase/outfit-3.jpg", kind: "image", tag: "FLUX 3" },
];
const B: Item[] = [
  { src: "/templates/ugc-talking.mp4", poster: "/templates/poster-ugc-talking.webp", kind: "video", tag: "Influencer · MiniMax H3" },
  { src: "/templates/key-art.webp", kind: "image", tag: "Key art · FLUX 3" },
  { src: "/templates/product-orbit.mp4", poster: "/templates/poster-product-orbit.webp", kind: "video", tag: "Product 360 · MiniMax H3" },
  { src: "/showcase/outfit-1.jpg", kind: "image", tag: "FLUX 3" },
];
const C: Item[] = [
  { src: "/showcase/outfit-2.jpg", kind: "image", tag: "Same man, every shot" },
  { src: "/templates/establishing-drone.mp4", poster: "/templates/poster-establishing-drone.webp", kind: "video", tag: "Drone · MiniMax H3" },
  { src: "/templates/character-sheet.webp", kind: "image", tag: "Character sheet · FLUX 3" },
  { src: "/templates/animate-still.mp4", poster: "/templates/poster-animate-still.webp", kind: "video", tag: "A still, alive" },
];

function Column({ items, dir }: { items: Item[]; dir: "up" | "down" }) {
  return (
    <div className={`hr-col ${dir}`}>
      <div className="hr-track">
        {[...items, ...items].map((it, i) => (
          <figure key={i} aria-hidden={i >= items.length}>
            {it.kind === "video" ? (
              <video src={it.src} poster={it.poster} muted loop playsInline autoPlay preload={i < items.length ? "auto" : "none"} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.src} alt="" loading="lazy" />
            )}
            <figcaption>{it.tag}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function HeroReel() {
  return (
    <div className="hr" aria-hidden="true">
      <div className="hr-tilt">
        <Column items={A} dir="up" />
        <Column items={B} dir="down" />
        <Column items={C} dir="up" />
      </div>
      <span className="hr-badge b1">52 credits a clip</span>
      <span className="hr-badge b2">Open source</span>
      <span className="hr-badge b3">Every price shown</span>
    </div>
  );
}
