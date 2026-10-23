/** A title card: words on black, drawn as a picture the editor can place like any shot. */

export type CardSize = { w: number; h: number };

export const cardSize = (aspect: "16:9" | "9:16"): CardSize => (aspect === "9:16" ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 });

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function cardSvg(text: string, sub: string, { w, h }: CardSize): string {
  const title = text.trim().slice(0, 80);
  // The longer the title, the smaller it is set, so it stays inside the frame.
  const size = Math.round(Math.min(w * 0.11, (w * 0.86) / Math.max(8, title.length * 0.58)));
  const subtitle = sub.trim().slice(0, 100);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#08080a"/><text x="${w / 2}" y="${h / 2}" font-family="Optima, Helvetica, Arial, sans-serif" font-size="${size}" letter-spacing="${Math.round(size * 0.12)}" text-anchor="middle" fill="#f4f4f0">${esc(title)}</text>${subtitle ? `<text x="${w / 2}" y="${h / 2 + size * 0.9}" font-family="Optima, Helvetica, Arial, sans-serif" font-size="${Math.round(size * 0.3)}" letter-spacing="${Math.round(size * 0.06)}" text-anchor="middle" fill="#a8a094">${esc(subtitle)}</text>` : ""}</svg>`;
}

export type TitlePlace = "center" | "lower" | "top";

/** Words on a transparent frame, to lay over the picture: a title, a lower third. */
export function titleSvg(text: string, place: TitlePlace, size: { w: number; h: number }): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = text.trim().split(/\n/).slice(0, 3);
  const px = Math.round(size.h * (place === "center" ? 0.09 : 0.055));
  const y0 = place === "center" ? size.h / 2 - ((lines.length - 1) * px * 1.15) / 2 : place === "top" ? size.h * 0.12 : size.h * 0.86 - (lines.length - 1) * px * 1.15;
  const anchor = place === "lower" ? "start" : "middle";
  const x = place === "lower" ? size.w * 0.07 : size.w / 2;
  const body = lines.map((l, i) => `<text x="${x}" y="${Math.round(y0 + i * px * 1.15)}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${px}" text-anchor="${anchor}" fill="#fff" stroke="#000" stroke-opacity=".55" stroke-width="${Math.round(px / 14)}" paint-order="stroke" stroke-linejoin="round">${esc(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}">${body}</svg>`;
}
