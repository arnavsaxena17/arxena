import { atom } from 'recoil';

export const refetchFunctionAtom = atom({
  key: 'refetchFunctionAtom',
  default: () => {}, // Default to an empty function
});
