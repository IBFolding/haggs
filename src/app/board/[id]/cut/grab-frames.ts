import type { Clip } from "../../../../story/cut";
import type { Frame } from "../../../../story/focus";

const WIDTH = 512;

function draw(source: CanvasImageSource, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = Math.max(1, Math.round((WIDTH * h) / w));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

/** One small picture from the middle of a clip, or null if the browser can't read it (a file from another site that won't allow it). */
export async function grabFrame(clip: Clip): Promise<Frame | null> {
  try {
    if (clip.kind === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = clip.url;
      await img.decode();
      return { id: clip.shotId, jpeg: draw(img, img.naturalWidth, img.naturalHeight) };
    }
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.src = clip.url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    });
    const at = Math.min(Math.max(clip.from + clip.seconds / 2, 0), Math.max(0, (video.duration || clip.from + clip.seconds) - 0.05));
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = at;
    });
    return { id: clip.shotId, jpeg: draw(video, video.videoWidth, video.videoHeight) };
  } catch {
    return null;
  }
}
