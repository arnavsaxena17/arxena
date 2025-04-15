import { atom } from 'recoil';

export const selectedCandidateIdState = atom<string | null>({
  key: 'selectedCandidateIdState',
  default: null,
}); 