// localStorage persistence helpers - keyed by assistantThreadId
export const getStorageKey = (assistantThreadId: string, key: string) => `ai-chat-${assistantThreadId}-${key}`;

/**
 * Deletes all localStorage entries for other assistantThreadIds (not the current one)
 * This is used when localStorage quota is exceeded
 */
const clearOtherAssistantThreadLocalStorage = (currentAssistantThreadId: string) => {
  try {
    const prefix = 'ai-chat-';
    const currentPrefix = `ai-chat-${currentAssistantThreadId}-`;
    const keysToRemove: string[] = [];
    
    // Iterate through all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix) && !key.startsWith(currentPrefix)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all keys for other assistantThreadIds
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove localStorage key ${key}:`, error);
      }
    });
    
    console.log(`Cleared ${keysToRemove.length} localStorage entries for other assistant threads`);
    return keysToRemove.length;
  } catch (error) {
    console.warn('Failed to clear other assistant thread localStorage:', error);
    return 0;
  }
};

export const saveToLocalStorage = (assistantThreadId: string, key: string, data: any) => {
  try {
    localStorage.setItem(getStorageKey(assistantThreadId, key), JSON.stringify(data));
  } catch (error: any) {
    // Check if it's a QuotaExceededError
    if (error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014) {
      console.warn('localStorage quota exceeded. Attempting to clear entries for other assistant threads...');
      
      // Clear localStorage entries for other assistantThreadIds
      const clearedCount = clearOtherAssistantThreadLocalStorage(assistantThreadId);
      
      if (clearedCount > 0) {
        // Retry saving after clearing
        try {
          localStorage.setItem(getStorageKey(assistantThreadId, key), JSON.stringify(data));
          console.log('Successfully saved to localStorage after clearing other entries');
        } catch (retryError) {
          console.error('Failed to save to localStorage even after clearing other entries:', retryError);
        }
      } else {
        console.warn('No other assistant thread entries found to clear. localStorage may still be full.');
      }
    } else {
      console.warn('Failed to save to localStorage:', error);
    }
  }
};

export const loadFromLocalStorage = (assistantThreadId: string, key: string) => {
  try {
    const item = localStorage.getItem(getStorageKey(assistantThreadId, key));
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
};

export const clearLocalStorage = (assistantThreadId: string, key: string) => {
  try {
    localStorage.removeItem(getStorageKey(assistantThreadId, key));
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
};

export const clearAllLocalStorageForAssistantThread = (assistantThreadId: string) => {
  try {
    const prefix = `ai-chat-${assistantThreadId}-`;
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear all localStorage for assistant thread:', error);
  }
};

