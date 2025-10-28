import { atom } from 'recoil';
import { LinkedInSearchCategory, LinkedInSearchType } from '../types/candidate-search.types';

export type SearchConfig = {
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
};

export const searchConfigState = atom<SearchConfig>({
  key: 'searchConfigState',
  default: {
    searchType: 'classic',
    searchCategory: 'people',
  },
});

// Global state to track the currently active searchFilterId
// This ensures AIChatAssistant and SearchParametersForm stay in sync
export const activeSearchFilterIdState = atom<string>({
  key: 'candidate-search/activeSearchFilterIdState',
  default: '',
});
