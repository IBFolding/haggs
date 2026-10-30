/** Scale from the pointer's distance to the object centre; works for tall and rotated images. */
export function draggedWidth(initialWidth: number, initialDistance: number, distance: number): number {
  if (![initialWidth, initialDistance, distance].every(Number.isFinite) || initialDistance <= 0) return initialWidth;
  return Math.min(1.5, Math.max(.03, initialWidth * Math.max(0, distance) / initialDistance));
}
