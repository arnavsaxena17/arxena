import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import {
  LinkedInSearchCategory,
  LinkedInSearchType,
} from '../types/candidate-search.types';

export type SearchConfig = {
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
};

export const searchConfigState = createAtomState<SearchConfig>({
  key: 'searchConfigState',
  defaultValue: {
    searchType: 'classic',
    searchCategory: 'people',
  },
});

// Global state for the current assistant thread id (candidate-search chat session)
export const activeAssistantThreadIdState = createAtomState<string>({
  key: 'candidate-search/activeAssistantThreadIdState',
  defaultValue: '',
});
