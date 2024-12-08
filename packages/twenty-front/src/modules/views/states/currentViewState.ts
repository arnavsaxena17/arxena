import { atom, selector } from 'recoil';
import { View } from '@/views/types/View'; // Adjust the import path as needed

export const currentViewWithFiltersState = atom<View | undefined>({
  key: 'currentViewWithFiltersState',
  default: undefined,
});

// Optional: Create a selector if you need computed values
export const currentViewWithFiltersSelector = selector({
  key: 'currentViewWithFiltersSelector',
  get: ({get}) => {
    return get(currentViewWithFiltersState);
  }
});