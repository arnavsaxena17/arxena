import { atom, selector } from 'recoil';
import { TransformedCandidateForTable } from 'twenty-shared';

// Helper to load search metadata from localStorage
const loadSearchMetadataFromStorage = (): {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  searchType?: string;
  searchCategory?: string;
  searchParameters?: any;
} => {
  try {
    const persistenceKey = 'candidate-search-metadata';
    const persistedData = localStorage.getItem(persistenceKey);
    
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      const isRecent = Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (isRecent && parsed.metadata) {
        console.log('Loaded persisted search metadata from localStorage:', parsed.metadata);
        return parsed.metadata;
      } else {
        console.log('Persisted search metadata is too old or invalid, clearing...');
        // Clear will be handled by the exported function
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
  default: loadSearchMetadataFromStorage(),
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
export const addSearchResults = (setSearchResults: any) => (newResults: any[]) => {
  setSearchResults((prev: any[]) => {
    // Deduplicate based on ID (could be LinkedIn ID or tempId)
    const existingIds = new Set(prev.map(r => r.tempId || r.id));
    const uniqueNewResults = newResults.filter(result => !existingIds.has(result.tempId || result.id));
    const updatedResults = [...uniqueNewResults, ...prev]; // New results on top
    
    // Persist to localStorage
    persistSearchResultsToStorage(updatedResults);
    
    return updatedResults;
  });
};

// Helper to persist search results to localStorage
export const persistSearchResultsToStorage = (results: any[]) => {
  try {
    const persistenceKey = 'candidate-search-results';
    const persistedData = {
      results,
      timestamp: Date.now(),
    };
    localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
    console.log(`Persisted ${results.length} search results to localStorage`);
  } catch (error) {
    console.error('Failed to persist search results to localStorage:', error);
  }
};

// Helper to load search results from localStorage
export const loadSearchResultsFromStorage = (): any[] => {
  try {
    const persistenceKey = 'candidate-search-results';
    const persistedData = localStorage.getItem(persistenceKey);
    
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      const isRecent = Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (isRecent && parsed.results && Array.isArray(parsed.results)) {
        console.log(`Loaded ${parsed.results.length} persisted search results from localStorage`);
        return parsed.results;
      } else {
        console.log('Persisted search results are too old or invalid, clearing...');
        clearSearchResultsFromStorage();
      }
    }
  } catch (error) {
    console.error('Failed to load search results from localStorage:', error);
  }
  
  return [];
};

// Helper to clear search results from localStorage
export const clearSearchResultsFromStorage = () => {
  try {
    const persistenceKey = 'candidate-search-results';
    localStorage.removeItem(persistenceKey);
    console.log('Cleared search results from localStorage');
  } catch (error) {
    console.error('Failed to clear search results from localStorage:', error);
  }
};

// Helper to persist search metadata to localStorage
export const persistSearchMetadataToStorage = (metadata: {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  searchType?: string;
  searchCategory?: string;
  searchParameters?: any;
}) => {
  try {
    const persistenceKey = 'candidate-search-metadata';
    const persistedData = {
      metadata,
      timestamp: Date.now(),
    };
    localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
    console.log('Persisted search metadata to localStorage:', metadata);
  } catch (error) {
    console.error('Failed to persist search metadata to localStorage:', error);
  }
};

// Helper to clear search metadata from localStorage
export const clearSearchMetadataFromStorage = () => {
  try {
    const persistenceKey = 'candidate-search-metadata';
    localStorage.removeItem(persistenceKey);
    console.log('Cleared search metadata from localStorage');
  } catch (error) {
    console.error('Failed to clear search metadata from localStorage:', error);
  }
};

// Helper to remove saved candidates from search results
export const removeSavedFromSearchResults = (setSearchResults: any) => (savedCandidates: any[]) => {
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
    
    // Update localStorage
    persistSearchResultsToStorage(filteredResults);
    
    return filteredResults;
  });
};

// Helper to handle successful upload-profiles response
export const handleUploadProfilesSuccess = (setSearchResults: any, setSearchMetadata: any) => (response: any) => {
  if (response.status === 'ok' && response.savedCandidates) {
    console.log(`Successfully saved ${response.savedCandidates.length} candidates`);
    
    // Remove saved candidates from search results
    removeSavedFromSearchResults(setSearchResults)(response.savedCandidates);
    
    // Update search metadata to reflect the reduced count
    setSearchMetadata((prev: any) => ({
      ...prev,
      totalCount: Math.max(0, prev.totalCount - response.savedCandidates.length)
    }));
    
    console.log('Updated search results and metadata after successful upload');
  }
};

// Helper to clear all search results
export const clearSearchResults = (setSearchResults: any) => () => {
  setSearchResults([]);
  clearSearchResultsFromStorage();
  clearSearchMetadataFromStorage();
};
