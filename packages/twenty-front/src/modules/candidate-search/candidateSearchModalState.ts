import { atom } from 'recoil';

export const isCandidateSearchModalOpenState = atom<boolean>({
  key: 'isCandidateSearchModalOpenState',
  default: false,
});
