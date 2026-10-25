"use client";

import { useEffect, useState } from "react";

/** A small picture or video frame that says so when the file can't be reached, rather than showing a broken-image icon. */
export function MediaThumb({ url, kind, at = 0.1 }: { url: string; kind: "video" | "image" | "audio"; at?: number }) {
  const [gone, setGone] = useState(false);
  useEffect(() => setGone(false), [url]);
  if (gone) {
    const local = url.startsWith("/api/local/");
    return (
      <span className="thumb-gone" role="img" aria-label="Preview unavailable" title={local ? "This file is still on the computer that made it. Open the project there, signed in, and it copies to your account." : "This file couldn't be loaded. It may have expired."}>
        {local ? "On your computer" : "Not available"}
      </span>
    );
  }
  return kind === "video"
    ? <video src={`${url}#t=${at}`} muted preload="metadata" onError={() => setGone(true)} />
    : <img src={url} alt="" onError={() => setGone(true)} />;
}
