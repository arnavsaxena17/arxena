import { atom } from 'recoil';
import { LinkedInSearchCategory, LinkedInSearchType } from '../types/CandidateSearch';

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
