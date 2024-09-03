import { atom } from 'recoil';

export const jobFilterState = atom<string | null>({
  key: 'jobFilterState',
  default: null,
});
