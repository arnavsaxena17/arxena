import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import {
  type LinkedInSearchCategory,
  type LinkedInSearchType,
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
