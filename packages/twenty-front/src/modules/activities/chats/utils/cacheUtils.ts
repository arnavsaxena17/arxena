export const CACHE_KEYS = {
  CHATS_DATA: 'chats_data',
  JOBS_DATA: 'jobs_data',
  CACHE_TIMESTAMP: 'chats_cache_timestamp',
} as const;

export const cacheUtils = {
  setCache: (key: string, data: any) => {
    let dataToStore = data;
    try {
      // Trim the data before caching if it's chat data
      if (key === CACHE_KEYS.CHATS_DATA) {
        dataToStore = data.map((person: any) => ({
          id: person.id,
          name: person.name,
          candidates: {
            edges: person.candidates?.edges?.map((edge: any) => ({
              node: {
                id: edge.node.id,
                startChat: edge.node.startChat,
                // Include only the last 20 messages
                whatsappMessages: edge.node.whatsappMessages ? {
                  edges: edge.node.whatsappMessages.edges?.slice(0, 20)?.map((msgEdge: any) => ({
                    node: {
                      id: msgEdge.node.id,
                      message: msgEdge.node.message,
                      whatsappDeliveryStatus: msgEdge.node.whatsappDeliveryStatus,
                    }
                  }))
                } : null
              }
            }))
          }
        }));
      }

      // Check estimated size before storing
      const serializedData = JSON.stringify(dataToStore);
      const estimatedSize = new Blob([serializedData]).size;
      
      // If data is too large (over 2MB), only store essential data
      if (estimatedSize > 2 * 1024 * 1024) {
        console.warn('Data too large for cache, storing minimal version');
        if (key === CACHE_KEYS.CHATS_DATA) {
          dataToStore = data.map((person: any) => ({
            id: person.id,
            name: person.name,
            candidates: {
              edges: person.candidates?.edges?.map((edge: any) => ({
                node: {
                  id: edge.node.id,
                  startChat: edge.node.startChat,
                }
              }))
            }
          }));
        }
      }

      localStorage.setItem(key, JSON.stringify(dataToStore));
      localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
    } catch (error) {
      if (error instanceof Error) {
        // If quota exceeded, clear old cache and try again
        if (error.name === 'QuotaExceededError') {
          console.warn('Cache quota exceeded, clearing old cache');
          cacheUtils.clearCache();
          try {
            localStorage.setItem(key, JSON.stringify(dataToStore));
            localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
          } catch (retryError) {
            console.error('Failed to set cache even after clearing:', retryError);
          }
        } else {
          console.error('Error setting cache:', error);
        }
      }
    }
  },

  getCache: (key: string) => {
    try {
      const data = localStorage.getItem(key);
      const timestamp = Number(localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP));
      
      if (!data || !timestamp) return null;
      
      // Check if cache is still valid (30 minutes)
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