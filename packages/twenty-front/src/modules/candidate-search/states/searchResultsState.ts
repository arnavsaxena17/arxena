import { atom, selector } from 'recoil';
import { TransformedCandidateForTable } from 'twenty-shared';

// Helper to load search metadata from localStorage (job-aware)
export const loadSearchMetadataFromStorage = (jobId?: string): {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  searchType?: string;
  searchCategory?: string;
  searchParameters?: any;
} => {
  try {
    const persistenceKey = jobId 
      ? `candidate-search-metadata-${jobId}` 
      : 'candidate-search-metadata-standalone';
    const persistedData = localStorage.getItem(persistenceKey);
    
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      
      // Verify jobId matches
      if (parsed.jobId !== jobId) {
        console.log(`JobId mismatch in persisted metadata: expected ${jobId}, got ${parsed.jobId}`);
        return {
          totalCount: 0,
          currentPage: 0,
          totalPages: 0,
        };
      }
      
      const isRecent = Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (isRecent && parsed.metadata) {
        console.log(`Loaded persisted search metadata from localStorage for jobId: ${jobId || 'standalone'}:`, parsed.metadata);
        return parsed.metadata;
      } else {
        console.log('Persisted search metadata is too old or invalid, clearing...');
        clearSearchMetadataFromStorage(jobId);
      }
    }
  } catch (error) {
    console.error('Failed to load search metadata from localStorage:', error);
  }
  
  return {
    totalCount: 0,
    currentPage: 0,
    totalPages: 0,
  };
};


/**
 * State for temporary search results (not yet saved to database)
 * Stores transformed candidate objects which extend UserProfile from the backend
 * These come from the backend candidate-search service and include:
 * - All UserProfile fields (experience, education, skills, etc.)
 * - UI-specific fields (__isFetched, tempId)
 * - Display aliases (jobTitle, company, location)
 * - UI state fields (candConversationStatus, status, etc.)
 */
export const searchResultsState = atom<TransformedCandidateForTable[]>({
  key: 'candidate-search/searchResultsState',
  default: [],
});

// State for search metadata
// Note: This atom is initialized with empty default. Metadata should be loaded per-jobId in components.
export const searchMetadataState = atom<{
  totalCount: number;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  searchType?: string;
  searchCategory?: string;
  searchParameters?: any;
}>({
  key: 'candidate-search/searchMetadataState',
  default: {
    totalCount: 0,
    currentPage: 0,
    totalPages: 0,
  },
});

// Selector to get count of fetched candidates
export const fetchedCandidatesCountSelector = selector({
  key: 'candidate-search/fetchedCandidatesCountSelector',
  get: ({ get }) => {
    const searchResults = get(searchResultsState);
    return searchResults.length;
  },
});

// Selector to get count of saved candidates (from database)
export const savedCandidatesCountSelector = selector({
  key: 'candidate-search/savedCandidatesCountSelector',
  get: ({ get }) => {
    // This will be used with the main table data to count saved candidates
    // Implementation will be added when integrating with DataTable
    return 0;
  },
});

// Helper to add search results (transformed candidates from backend)
export const addSearchResults = (setSearchResults: any, jobId?: string) => (newResults: any[], onComplete?: (result: { added: number; duplicates: number }) => void) => {
  console.log('=== addSearchResults function called ===', {
    newResultsCount: newResults.length,
    jobId,
    newResultsSample: newResults.slice(0, 2).map((r: any) => ({
      id: r.id,
      tempId: r.tempId,
      fullName: r.fullName,
      keys: Object.keys(r)
    }))
  });

  setSearchResults((prev: any[]) => {
    console.log('=== addSearchResults - inside setSearchResults callback ===', {
      prevCount: prev.length,
      newResultsCount: newResults.length,
      prevSample: prev.slice(0, 2).map((r: any) => ({
        id: r.id,
        tempId: r.tempId,
        fullName: r.fullName
      }))
    });

    // Deduplicate based on ID (could be LinkedIn ID or tempId)
    const existingIds = new Set(prev.map(r => r.tempId || r.id));
    console.log('=== addSearchResults - existing IDs ===', {
      existingIdsCount: existingIds.size,
      existingIds: Array.from(existingIds).slice(0, 10)
    });

    const uniqueNewResults = newResults.filter(result => {
      const resultId = result.tempId || result.id;
      const isDuplicate = existingIds.has(resultId);
      if (isDuplicate) {
        console.log('=== addSearchResults - filtering duplicate ===', {
          resultId,
          fullName: result.fullName
        });
      }
      return !isDuplicate;
    });

    const duplicatesCount = newResults.length - uniqueNewResults.length;

    console.log('=== addSearchResults - after deduplication ===', {
      uniqueNewResultsCount: uniqueNewResults.length,
      filteredOut: duplicatesCount
    });

    const updatedResults = [...uniqueNewResults, ...prev]; // New results on top
    
    console.log('=== addSearchResults - final updated results ===', {
      totalCount: updatedResults.length,
      newResultsOnTop: uniqueNewResults.length,
      existingResults: prev.length
    });
    
    // Persist to localStorage with jobId
    persistSearchResultsToStorage(updatedResults, jobId);
    
    console.log('=== addSearchResults - returning updated results ===', {
      count: updatedResults.length
    });
    
    // Defer onComplete callback to avoid triggering state updates within a state updater
    // This ensures the callback runs after the current state update completes
    if (onComplete) {
      const result = {
        added: uniqueNewResults.length,
        duplicates: duplicatesCount
      };
      // Use setTimeout to defer execution after the current state update
      setTimeout(() => {
        onComplete(result);
      }, 0);
    }
    
    return updatedResults;
  });
};


export const clearPersistedSearchResultsFromStorage = async () => {
  try { 


  await Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('candidate-search-results-')) {
      try {
        const persistedData = JSON.parse(localStorage.getItem(key) || '{}');
        if (
          persistedData.timestamp &&
          typeof persistedData.timestamp === 'number' &&
          Date.now() - persistedData.timestamp > 3 * 24 * 60 * 60 * 1000
        ) {
          localStorage.removeItem(key);
          console.log(`Removed expired persisted search results: ${key}`);
        }
      } catch {
        // Ignore malformed JSON, but remove to avoid storage leaks
        localStorage.removeItem(key);
        console.log(`Removed malformed persisted search results: ${key}`);
      }
    }
  });

  } catch (error) {
    console.error('Failed to clear persisted search results from localStorage:', error);
  }
};
// Helper to persist search results to localStorage (job-aware)
export const persistSearchResultsToStorage = (results: any[], jobId?: string) => {
  const persistenceKey = jobId 
  ? `candidate-search-results-${jobId}` 
  : 'candidate-search-results-standalone';
const persistedData = {
  results,
  timestamp: Date.now(),
  jobId, // Store jobId for verification
};
  try {

    clearPersistedSearchResultsFromStorage().then(() => {
      localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
      console.log(`Persisted ${results.length} search results to localStorage for jobId: ${jobId || 'standalone'} after cleanup`);
    });
  } catch (error) {
    console.error('Failed to persist search results to localStorage:', error);
  }
};

// Helper to load search results from localStorage (job-aware)
export const loadSearchResultsFromStorage = (jobId?: string): any[] => {
  try {
    const persistenceKey = jobId 
      ? `candidate-search-results-${jobId}` 
      : 'candidate-search-results-standalone';
    const persistedData = localStorage.getItem(persistenceKey);
    
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      
      // Verify jobId matches
      if (parsed.jobId !== jobId) {
        console.log(`JobId mismatch in persisted data: expected ${jobId}, got ${parsed.jobId}`);
        return [];
      }
      
      const isRecent = Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (isRecent && parsed.results && Array.isArray(parsed.results)) {
        console.log(`Loaded ${parsed.results.length} persisted search results from localStorage for jobId: ${jobId || 'standalone'}`);
        
        // DEDUPLICATE when loading from localStorage
        const seen = new Map<string, any>();
        const deduplicated: any[] = [];
        
        for (const result of parsed.results) {
          const resultId = result.tempId || result.id;
          if (!resultId) continue;
          
          if (!seen.has(resultId)) {
            seen.set(resultId, result);
            deduplicated.push(result);
          }
        }
        
        if (deduplicated.length !== parsed.results.length) {
          console.log(`Deduplicated loaded results: ${parsed.results.length} -> ${deduplicated.length} (removed ${parsed.results.length - deduplicated.length} duplicates)`);
        }
        
        return deduplicated;
      } else {
        console.log('Persisted search results are too old or invalid, clearing...');
        clearSearchResultsFromStorage(jobId);
      }
    }
  } catch (error) {
    console.error('Failed to load search results from localStorage:', error);
  }
  
  return [];
};

// Helper to clear search results from localStorage (job-aware)
export const clearSearchResultsFromStorage = (jobId?: string) => {
  try {
    const persistenceKey = jobId 
      ? `candidate-search-results-${jobId}` 
      : 'candidate-search-results-standalone';
    localStorage.removeItem(persistenceKey);
    console.log(`Cleared search results from localStorage for jobId: ${jobId || 'standalone'}`);
  } catch (error) {
    console.error('Failed to clear search results from localStorage:', error);
  }
};

// Helper to persist search metadata to localStorage (job-aware)
export const persistSearchMetadataToStorage = (metadata: {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  searchType?: string;
  searchCategory?: string;
  searchParameters?: any;
}, jobId?: string) => {
  try {
    const persistenceKey = jobId 
      ? `candidate-search-metadata-${jobId}` 
      : 'candidate-search-metadata-standalone';
    const persistedData = {
      metadata,
      timestamp: Date.now(),
      jobId, // Store jobId for verification
    };
    localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
    console.log(`Persisted search metadata to localStorage for jobId: ${jobId || 'standalone'}:`, metadata);
  } catch (error) {
    console.error('Failed to persist search metadata to localStorage:', error);
  }
};

// Helper to clear search metadata from localStorage (job-aware)
export const clearSearchMetadataFromStorage = (jobId?: string) => {
  try {
    const persistenceKey = jobId 
      ? `candidate-search-metadata-${jobId}` 
      : 'candidate-search-metadata-standalone';
    localStorage.removeItem(persistenceKey);
    console.log(`Cleared search metadata from localStorage for jobId: ${jobId || 'standalone'}`);
  } catch (error) {
    console.error('Failed to clear search metadata from localStorage:', error);
  }
};

// Helper to remove saved candidates from search results
export const removeSavedFromSearchResults = (setSearchResults: any, jobId?: string) => (savedCandidates: any[]) => {
  setSearchResults((prev: any[]) => {
    // Extract unique string keys from saved candidates
    const savedUniqueKeys = new Set(savedCandidates.map(candidate => candidate.uniqueStringKey).filter(Boolean));
    
    // Filter out candidates that have been saved
    const filteredResults = prev.filter(result => {
      // Check if this result has been saved by comparing uniqueStringKey or id
      const resultKey = result.tempId || result.id;
      return !savedUniqueKeys.has(resultKey);
    });
    
    console.log(`Removed ${prev.length - filteredResults.length} saved candidates from search results`);
    
    // Update localStorage with jobId
    persistSearchResultsToStorage(filteredResults, jobId);
    
    return filteredResults;
  });
};

// Helper to handle successful upload-profiles response
export const handleUploadProfilesSuccess = (setSearchResults: any, setSearchMetadata: any, jobId?: string) => (response: any) => {
  if (response.status === 'ok' && response.savedCandidates) {
    console.log(`Successfully saved ${response.savedCandidates.length} candidates`);
    
    // Remove saved candidates from search results
    removeSavedFromSearchResults(setSearchResults, jobId)(response.savedCandidates);
    
    // Update search metadata to reflect the reduced count
    setSearchMetadata((prev: any) => ({
      ...prev,
      totalCount: Math.max(0, prev.totalCount - response.savedCandidates.length)
    }));
    
    console.log('Updated search results and metadata after successful upload');
  }
};

// Helper to clear all search results
export const clearSearchResults = (setSearchResults: any, jobId?: string) => () => {
  setSearchResults([]);
  clearSearchResultsFromStorage(jobId);
  clearSearchMetadataFromStorage(jobId);
};
