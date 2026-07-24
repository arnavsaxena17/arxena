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

// Global state for the current assistant thread id (candidate-search chat session)
export const activeAssistantThreadIdState = atom<string>({
  key: 'candidate-search/activeAssistantThreadIdState',
  default: '',
});
