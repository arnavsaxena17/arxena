import { atom } from 'recoil';

export const rightDrawerSelectedRecordsState = atom<string[]>({
  key: 'rightDrawerSelectedRecordsState',
  default: [],
});

