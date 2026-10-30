/** Audio follows the source cut; returned picture already begins at frame zero. */
export function greyMuxArgs(video: string, sound: string, out: string, hasAudio: boolean, trimIn = 0): string[] {
  if (!Number.isFinite(trimIn) || trimIn < 0) throw new Error("The source start must be a non-negative number.");
  return hasAudio
    ? ["-y", "-v", "error", "-i", video, "-ss", String(trimIn), "-i", sound, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", out]
    : ["-y", "-v", "error", "-i", video, "-c", "copy", out];
}
