import { atom } from 'recoil';
import { CustomSortState } from '../types/sortTypes';

export const customSortState = atom<CustomSortState>({
  key: 'customSortState',
  default: {
    field: 'updatedAt',
    direction: 'desc',
  },
});
