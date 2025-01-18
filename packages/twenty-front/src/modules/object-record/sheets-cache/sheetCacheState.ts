import { atom } from 'recoil';

interface SheetData {
  headers: string[];
  values: any[][];
  lastFetched: number;
}

interface SheetCache {
  [spreadsheetId: string]: SheetData;
}

export const sheetCacheState = atom<SheetCache>({
  key: 'twenty/googleSheets/sheetCacheState', // More specific, namespaced key
  default: {},
});