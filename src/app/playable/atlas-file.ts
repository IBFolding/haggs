import { ATLAS_LIMITS, pngSize, readAtlas } from '../../playable/atlas';

/** Explicit local files only; metadata paths, scripts and extra fields are never executed. */
export async function atlasFiles(png: File, json: File) {
  if (png.size > ATLAS_LIMITS.pngBytes || !png.size) throw new Error('Keep the atlas PNG under 2 MB. Export smaller cells.');
  if (json.size > ATLAS_LIMITS.jsonBytes || !json.size) throw new Error('Keep atlas JSON under 256 KB.');
  const bytes = new Uint8Array(await png.arrayBuffer());
  const { width, height } = pngSize(bytes);
  let manifest: unknown;
  try { manifest = JSON.parse(await json.text()); } catch { throw new Error('The atlas JSON is not valid JSON.'); }
  const atlas = readAtlas(manifest, width, height);
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  try {
    const image = new Image(); image.src = objectUrl;
    await image.decode();
    if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error('PNG dimensions did not match its header.');
    // Re-encode decoded pixels to discard metadata and preserve the actual alpha channel.
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(image, 0, 0);
    const url = canvas.toDataURL('image/png');
    if (url.length >= 3_000_000) throw new Error('Decoded atlas is too large to save. Export smaller cells.');
    return { url, atlas };
  } catch (e) { throw new Error(e instanceof Error ? e.message : 'The PNG could not be decoded.'); }
  finally { URL.revokeObjectURL(objectUrl); }
}
