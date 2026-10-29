import { normalizeSheets, putSheetsView, sheetsView, type Sheets } from "../sheets/sheets";
import { applyBreakdown, validateBreakdown } from "./breakdown";
export function applyBoardBreakdown(all: Sheets, target: string, first: string, payload: unknown): Sheets {
  const base = normalizeSheets(all, first);
  return putSheetsView(base, target, applyBreakdown(sheetsView(base, target), validateBreakdown(payload)).sheets);
}
