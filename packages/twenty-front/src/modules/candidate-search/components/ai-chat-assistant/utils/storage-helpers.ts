// localStorage persistence helpers - keyed by searchFilterId
export const getStorageKey = (searchFilterId: string, key: string) => `ai-chat-${searchFilterId}-${key}`;

export const saveToLocalStorage = (searchFilterId: string, key: string, data: any) => {
  try {
    localStorage.setItem(getStorageKey(searchFilterId, key), JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

export const loadFromLocalStorage = (searchFilterId: string, key: string) => {
  try {
    const item = localStorage.getItem(getStorageKey(searchFilterId, key));
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
};

export const clearLocalStorage = (searchFilterId: string, key: string) => {
  try {
    localStorage.removeItem(getStorageKey(searchFilterId, key));
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
};

export const clearAllLocalStorageForSearchFilter = (searchFilterId: string) => {
  try {
    const prefix = `ai-chat-${searchFilterId}-`;
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear all localStorage for search filter:', error);
  }
};

