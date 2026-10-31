/** Updates the tempo directive while leaving the production sheet untouched. */
export function setTempo(sheet: string, bpm: number) {
  if (!Number.isFinite(bpm)) return sheet;
  const value = Math.min(220, Math.max(60, bpm));
  const directive = /^bpm\s+\d+(?:\.\d+)?$/im;
  return directive.test(sheet) ? sheet.replace(directive, `bpm ${value}`) : `bpm ${value}\n${sheet}`;
}
