import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import {
  LinkedInSearchCategory,
  LinkedInSearchType,
} from '../types/candidate-search.types';

// State for search panel open/close
export const isSearchPanelOpenState = createAtomState<boolean>({
  key: 'candidate-search/isSearchPanelOpenState',
  defaultValue: false,
});

// State for search panel width (for responsive behavior)
export const searchPanelWidthState = createAtomState<number>({
  key: 'candidate-search/searchPanelWidthState',
  defaultValue: 350,
});

// State for persistent search configuration
export const persistentSearchConfigState = createAtomState<{
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
}>({
  key: 'candidate-search/persistentSearchConfigState',
  defaultValue: {
    searchType: 'classic',
    searchCategory: 'people',
  },
});

// State for persistent search parameters
export const persistentSearchParametersState = createAtomState<any>({
  key: 'candidate-search/persistentSearchParametersState',
  defaultValue: null,
});

// State for recent searches
export const recentSearchesState = createAtomState<
  Array<{
    id: string;
    name: string;
    searchType: string;
    searchCategory: string;
    parameters: any;
    resultCount: number;
    timestamp: Date;
  }>
>({
  key: 'candidate-search/recentSearchesState',
  defaultValue: [],
});

// Helper to add a recent search
export const addRecentSearch = (setRecentSearches: any) => (search: {
  name: string;
  searchType: string;
  searchCategory: string;
  parameters: any;
  resultCount: number;
}) => {
  setRecentSearches((prev: any[]) => {
    const newSearch = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...search,
      timestamp: new Date(),
    };
    
    // Keep only last 10 searches
    const updated = [newSearch, ...prev].slice(0, 10);
    return updated;
  });
};

// Helper to persist search configuration
export const persistSearchConfig = (setSearchConfig: any) => (config: {
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
}) => {
  setSearchConfig(config);
  
  // Also persist to localStorage for cross-session persistence
  try {
    const persistenceKey = 'candidate-search-config';
    const persistedData = {
      config,
      timestamp: Date.now(),
    };
    localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
    console.log('Persisted search config to localStorage:', config);
  } catch (error) {
    console.error('Failed to persist search config to localStorage:', error);
  }
};

// Helper to persist search parameters
export const persistSearchParameters = (setSearchParameters: any) => (parameters: any) => {
  setSearchParameters(parameters);
  
  // Also persist to localStorage for cross-session persistence
  try {
    const persistenceKey = 'candidate-search-parameters';
    const persistedData = {
      parameters,
      timestamp: Date.now(),
    };
    localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
    console.log('Persisted search parameters to localStorage:', parameters);
  } catch (error) {
    console.error('Failed to persist search parameters to localStorage:', error);
  }
};

// Helper to load search configuration from localStorage
export const loadSearchConfigFromStorage = (): {
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
} => {
  try {
    const persistenceKey = 'candidate-search-config';
    const persistedData = localStorage.getItem(persistenceKey);
    
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      const isRecent = Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (isRecent && parsed.config) {
        console.log('Loaded persisted search config from localStorage:', parsed.config);
        return parsed.config;
      } else {
        console.log('Persisted search config is too old or invalid, using defaults...');
      }
    }
  } catch (error) {
    console.error('Failed to load search config from localStorage:', error);
  }
  
  return {
    searchType: 'classic',
    searchCategory: 'people',
  };
};

// Helper to load search parameters from localStorage
export const loadSearchParametersFromStorage = (): any => {
  try {
    const persistenceKey = 'candidate-search-parameters';
    const persistedData = localStorage.getItem(persistenceKey);
    
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      const isRecent = Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (isRecent && parsed.parameters) {
        console.log('Loaded persisted search parameters from localStorage:', parsed.parameters);
        return parsed.parameters;
      } else {
        console.log('Persisted search parameters are too old or invalid, clearing...');
        clearSearchParametersFromStorage();
      }
    }
  } catch (error) {
    console.error('Failed to load search parameters from localStorage:', error);
  }
  
  return null;
};

// Helper to clear search parameters from localStorage
export const clearSearchParametersFromStorage = () => {
  try {
    const persistenceKey = 'candidate-search-parameters';
    localStorage.removeItem(persistenceKey);
    console.log('Cleared search parameters from localStorage');
  } catch (error) {
    console.error('Failed to clear search parameters from localStorage:', error);
  }
};

// Helper to clear search config from localStorage
export const clearSearchConfigFromStorage = () => {
  try {
    const persistenceKey = 'candidate-search-config';
    localStorage.removeItem(persistenceKey);
    console.log('Cleared search config from localStorage');
  } catch (error) {
    console.error('Failed to clear search config from localStorage:', error);
  }
};
