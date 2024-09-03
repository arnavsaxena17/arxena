import { atom } from 'recoil';

export const statusFilterState = atom<string | null>({
  key: 'statusFilterState',
  default: null,
});
