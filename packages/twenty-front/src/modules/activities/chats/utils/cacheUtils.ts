// cacheUtils.ts
export const CACHE_KEYS = {
    CHATS_DATA: 'chats_data',
    JOBS_DATA: 'jobs_data',
    CACHE_TIMESTAMP: 'chats_cache_timestamp',
  } as const;
  
  export const cacheUtils = {
    setCache: (key: string, data: any) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
      } catch (error) {
        console.error('Error setting cache:', error);
      }
    },
  
    getCache: (key: string) => {
      try {
        const data = localStorage.getItem(key);
        const timestamp = Number(localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP));
        
        if (!data || !timestamp) return null;
        
        // Check if cache is still valid
        if (Date.now() - timestamp > CACHE_DURATION) {
          cacheUtils.clearCache();
          return null;
        }
        
        return JSON.parse(data);
      } catch (error) {
        console.error('Error getting cache:', error);
        return null;
      }
    },
  
    clearCache: () => {
      try {
        Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
    }
  };
  
  const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes