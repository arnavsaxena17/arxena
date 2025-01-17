// sheetCache.ts
import { createContext, useContext } from 'react';

interface SheetData {
  headers: string[];
  values: any[][];
  lastFetched: number;
}

interface SheetCache {
  [spreadsheetId: string]: SheetData;
}

export const SheetCacheContext = createContext<{
  cache: SheetCache;
  setCache: (spreadsheetId: string, data: SheetData) => void;
}>({
  cache: {},
  setCache: () => {},
});

export const useSheetCache = () => useContext(SheetCacheContext);