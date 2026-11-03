/** The HTML composition HyperFrames (Apache-2.0, heygen-com/hyperframes) renders into an animated title. Pure so it can be tested. */

export const TITLE_STYLES = { blur: "Blur in", slide: "Slide up", words: "Word by word" } as const;
export type TitleStyle = keyof typeof TITLE_STYLES;
export const TITLE_SHAPES = { landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080] } as const;
export type TitleShape = keyof typeof TITLE_SHAPES;
export const TITLE_FORMATS = { mp4: "MP4", webm: "WebM, transparent background", mov: "ProRes 4444, transparent background" } as const;
export type TitleFormat = keyof typeof TITLE_FORMATS;

export type TitleBrief = { title: string; subtitle: string; style: TitleStyle; shape: TitleShape; seconds: number; ink: string; ground: string; format: TitleFormat };

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isTitleStyle = (v: unknown): v is TitleStyle => typeof v === "string" && v in TITLE_STYLES;
export const isTitleShape = (v: unknown): v is TitleShape => typeof v === "string" && v in TITLE_SHAPES;
export const isTitleFormat = (v: unknown): v is TitleFormat => typeof v === "string" && v in TITLE_FORMATS;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Reads the request, with safe defaults and limits. */
export function titleBrief(body: Record<string, unknown>): TitleBrief {
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const secs = typeof body.seconds === "number" && Number.isFinite(body.seconds) ? body.seconds : 4;
  return {
    title: text(body.title, 120) || "Your title",
    subtitle: text(body.subtitle, 160),
    style: isTitleStyle(body.titleStyle) ? body.titleStyle : "blur",
    shape: isTitleShape(body.shape) ? body.shape : "landscape",
    seconds: Math.min(10, Math.max(2, Math.round(secs))),
    ink: typeof body.ink === "string" && HEX.test(body.ink) ? body.ink : "#ffffff",
    ground: typeof body.ground === "string" && HEX.test(body.ground) ? body.ground : "#000000",
    format: isTitleFormat(body.format) ? body.format : "mp4",
  };
}

export function titleHtml(b: TitleBrief): string {
  const [w, h] = TITLE_SHAPES[b.shape];
  const transparent = b.format !== "mp4";
  const size = Math.round(Math.min(w, h) * (b.shape === "landscape" ? 0.085 : 0.095));
  const words = b.style === "words" ? b.title.split(" ").map((x, i) => `<span class="w" data-i="${i}">${escape(x)}</span>`).join(" ") : escape(b.title);
  const motion = {
    blur: `tl.fromTo("#title", { opacity: 0, filter: "blur(10px)", y: 24 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.8, ease: "power4.out" }, 0.3);`,
    slide: `tl.fromTo("#title", { opacity: 0, y: 90 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.3);`,
    words: `tl.fromTo(".w", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.18 }, 0.3);`,
  }[b.style];
  const sub = b.subtitle ? `tl.fromTo("#sub", { opacity: 0, y: 20 }, { opacity: 0.8, y: 0, duration: 0.6, ease: "power2.out" }, 1.1);` : "";
  const out = `tl.to("#stack", { opacity: 0, duration: 0.4, ease: "power1.in" }, ${b.seconds - 0.5});`;
  return `<!doctype html>
<html lang="en" data-resolution="${b.shape}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${w}, height=${h}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: ${transparent ? "transparent" : b.ground}; }
      #root { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: "Helvetica Neue", Arial, sans-serif; }
      #stack { display: flex; flex-direction: column; align-items: center; gap: ${Math.round(size * 0.3)}px; padding: 0 ${Math.round(w * 0.08)}px; text-align: center; }
      #title { color: ${b.ink}; font-size: ${size}px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
      .w { display: inline-block; }
      #sub { color: ${b.ink}; font-size: ${Math.round(size * 0.38)}px; font-weight: 400; opacity: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${b.seconds}" data-width="${w}" data-height="${h}">
      <div id="stack" class="clip" data-start="0" data-duration="${b.seconds}" data-track-index="0">
        <h1 id="title">${words}</h1>${b.subtitle ? `\n        <p id="sub">${escape(b.subtitle)}</p>` : ""}
      </div>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      ${motion}
      ${sub}
      ${out}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
}
