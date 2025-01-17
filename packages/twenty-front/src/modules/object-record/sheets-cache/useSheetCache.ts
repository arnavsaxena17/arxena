// src/google-sheet/hooks/useSheetCache.ts
import { useRecoilState } from 'recoil';
import { sheetCacheState } from './sheetCacheState';
import axios from 'axios';

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export const useSheetCache = () => {
  const [cache, setCache] = useRecoilState(sheetCacheState);

  const fetchSheetData = async (
    spreadsheetId: string,
    accessToken: string
  ) => {
    const cachedData = cache[spreadsheetId];
    const now = Date.now();

    // Return cached data if it exists and hasn't expired
    if (cachedData && (now - cachedData.lastFetched) < CACHE_EXPIRY) {
      return cachedData;
    }

    // Fetch fresh data
    const response = await axios.get(
      `${process.env.REACT_APP_SERVER_BASE_URL}/sheets/${spreadsheetId}/values/Sheet1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const sheetData = {
      headers: response.data.values?.[0] || [],
      values: response.data.values || [],
      lastFetched: now
    };

    // Update cache
    setCache(prev => ({
      ...prev,
      [spreadsheetId]: sheetData
    }));

    return sheetData;
  };

  const invalidateCache = (spreadsheetId: string) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[spreadsheetId];
      return newCache;
    });
  };

  return {
    fetchSheetData,
    invalidateCache,
    getCachedData: (spreadsheetId: string) => cache[spreadsheetId],
  };
};