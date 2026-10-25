/**
 * Pictures sent to the server as references only need to be big enough for
 * the model to see who and where. Sending the full-size sheets of a character
 * and a place together can pass the host's 4.5 MB request limit, which shows
 * up as an unreadable error. So they are drawn smaller first: a 1024-pixel
 * jpeg is a couple of hundred kilobytes.
 */

const load = (src: string) =>
  new Promise<HTMLImageElement>((ok, no) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => no(new Error("A reference picture couldn't be read."));
    i.src = src;
  });

/** One picture, scaled so its longest side is at most `max`, as a jpeg data link. A picture already small enough, or one that can't be redrawn, is returned as it was. */
export async function shrinkPicture(src: string, max = 1024): Promise<string> {
  if (typeof document === "undefined" || !src || (!src.startsWith("data:image") && !/^(https?:)?\/\//.test(src) && !src.startsWith("/"))) return src;
  // A small data link is left alone.
  if (src.startsWith("data:") && src.length < 350_000) return src;
  try {
    const img = await load(src);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (k === 1 && src.startsWith("data:") && src.length < 900_000) return src;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } catch {
    return src;
  }
}

export const shrinkAll = (list: string[], max = 1024) => Promise.all(list.map((s) => shrinkPicture(s, max)));

/** The words for an error from a request that was too big, which the host reports as a masked React error. */
export const looksTooBig = (e: unknown) => /#441|413|body exceeded|too large|payload/i.test(e instanceof Error ? e.message : String(e));
