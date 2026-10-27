import { addRow, type Sheets } from './sheets';
import type { BankItem } from '../story/bank';
/** Project-local reference to an existing asset. Never creates or changes a bank record. */
export function useSheetAsset(sheets: Sheets, item: BankItem, targetId?: string): Sheets {
  if (item.kind !== 'character' && item.kind !== 'place') throw new Error('Choose a character or location.');
  if (!item.image || !item.name.trim()) throw new Error('Finish and save this asset with its reference picture before adding it.');
  const field = item.kind === 'character' ? 'characters' : 'locations';
  const key = `${item.kind}:${item.id}`;
  const rows = sheets[field];
  if (!targetId && rows.some((r) => r.bankId === key)) return sheets;
  const found = targetId ? rows.find((r) => r.id === targetId) : rows.find((r) => r.name.toUpperCase() === item.name.trim().toUpperCase());
  if (targetId && !found) throw new Error('That project row is no longer available.');
  const next = found ? sheets : addRow(sheets, field, {name:item.name});
  const id = found?.id ?? item.name.trim().toUpperCase();
  return { ...next, [field]: next[field].map((row) => row.id === id ? {...row, bankId:key, lock:item.words, refs:[item.image!,...(row.refs ?? []).filter((r)=>r!==item.image)].slice(0,8)} : row) };
}
export const useSheetAssets = (sheets: Sheets, items: BankItem[]) => items.reduce((s,i)=>useSheetAsset(s,i),sheets);
