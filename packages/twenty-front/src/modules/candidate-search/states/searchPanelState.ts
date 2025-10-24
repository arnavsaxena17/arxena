import { atom } from 'recoil';

// State for search panel open/close
export const isSearchPanelOpenState = atom<boolean>({
  key: 'candidate-search/isSearchPanelOpenState',
  default: false,
});

// State for search panel width (for responsive behavior)
export const searchPanelWidthState = atom<number>({
  key: 'candidate-search/searchPanelWidthState',
  default: 350, // Default desktop width
});

// State for recent searches
export const recentSearchesState = atom<Array<{
  id: string;
  name: string;
  searchType: string;
  searchCategory: string;
  parameters: any;
  resultCount: number;
  timestamp: Date;
}>>({
  key: 'candidate-search/recentSearchesState',
  default: [],
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
