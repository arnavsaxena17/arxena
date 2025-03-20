import { atom } from 'recoil';

export const hasCustomDataSourceState = atom<boolean>({
  key: 'hasCustomDataSourceState',
  default: false,
});
