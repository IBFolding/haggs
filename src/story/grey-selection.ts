export type AreaPoint = { x: number; y: number };
export type AreaSelection = { points: AreaPoint[]; aspect: number };
export function validSelection(value: AreaSelection | undefined): value is AreaSelection {
  return !!value && Number.isFinite(value.aspect) && value.aspect > 0 && Array.isArray(value.points) && value.points.length >= 3 && value.points.length <= 80 && value.points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) && polygonArea(value.points) > 0.0001;
}
export function polygonArea(points: AreaPoint[]): number {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]!; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
}
/** Bounds in the original image; the mask supplies the precise polygon edge. */
export function selectionBounds(selection: AreaSelection) {
  const xs = selection.points.map(p => p.x), ys = selection.points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
/** Match the source image's contain-fit in the preview and rendered frame. */
export function selectionFrame(selection: AreaSelection, size: { w: number; h: number }) {
  const bounds = selectionBounds(selection);
  const w = Math.min(size.w, size.h * selection.aspect), h = w / selection.aspect;
  return { x: Math.round((size.w - w) / 2 + bounds.x * w), y: Math.round((size.h - h) / 2 + bounds.y * h), w: Math.max(1, Math.round(bounds.w * w)), h: Math.max(1, Math.round(bounds.h * h)) };
}
