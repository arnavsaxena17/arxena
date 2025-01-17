// // useGoogleSheetData.ts
// import { useCallback } from 'react';
// import axios from 'axios';
// import { useSheetCache } from './sheetCache';

// const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// export const useGoogleSheetData = () => {
//   const { cache, setCache } = useSheetCache();

//   const fetchSheetData = useCallback(async (
//     spreadsheetId: string, 
//     accessToken: string
//   ) => {
//     const cachedData = cache[spreadsheetId];
//     const now = Date.now();

//     // Return cached data if it exists and hasn't expired
//     if (cachedData && (now - cachedData.lastFetched) < CACHE_EXPIRY) {
//       return cachedData;
//     }

//     // Fetch fresh data
//     const response = await axios.get(
//       `${process.env.REACT_APP_SERVER_BASE_URL}/sheets/${spreadsheetId}/values/Sheet1`,
//       {
//         headers: { Authorization: `Bearer ${accessToken}` }
//       }
//     );

//     const sheetData = {
//       headers: response.data.values?.[0] || [],
//       values: response.data.values || [],
//       lastFetched: now
//     };

//     // Update cache
//     setCache(spreadsheetId, sheetData);

//     return sheetData;
//   }, [cache, setCache]);

//   return { fetchSheetData };
// };