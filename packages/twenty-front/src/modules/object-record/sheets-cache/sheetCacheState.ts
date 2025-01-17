// src/google-sheet/states/sheetCacheState.ts
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
  key: 'sheetCacheState',
  default: {},
});