import { atom } from 'recoil';

export const isBulkMessageModalOpenState = atom<boolean>({
  key: 'isBulkMessageModalOpenState',
  default: false,
}); 