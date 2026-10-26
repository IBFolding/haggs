"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** An uploaded still stays in the project's persisted take history, not a temporary blob URL. */
export function UploadImage({ onAttach, label = "Upload image", disabled = false, inputRef }: { onAttach: (url: string, name: string) => void; label?: string; disabled?: boolean; inputRef?: RefObject<HTMLInputElement | null> }) {
  const ownInput = useRef<HTMLInputElement>(null);
  const input = inputRef ?? ownInput;
  const request = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { request.current++; }, []);

  async function upload(file: File) {
    const token = ++request.current;
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 20 * 1024 * 1024) {
      setError("Choose a PNG, JPEG or WebP image up to 20 MB.");
      return;
    }
    setBusy(true);
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 64_000_000) throw new Error("Choose an image smaller than 64 megapixels.");
      const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable. Please try again.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/png");
      if (token === request.current) onAttach(url, file.name);
    } catch (caught) {
      if (token === request.current) setError(caught instanceof Error ? caught.message : "This image could not be read. Please try another file.");
    } finally {
      bitmap?.close();
      if (token === request.current) setBusy(false);
    }
  }

  return <span>
    <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label={label} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) void upload(file);
    }} />
    <button className="pill" disabled={busy || disabled} onClick={() => input.current?.click()}>{busy ? "Preparing image…" : label}</button>
    {busy && <button className="pill" onClick={() => { request.current++; setBusy(false); }}>Cancel upload</button>}
    {error && <span role="alert">{error}</span>}
  </span>;
}
