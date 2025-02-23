// states/selectedRecordsState.ts
import { atom } from 'recoil';

export const selectedRecordsForModalState = atom({
  key: 'selectedRecordsForModalState',
  default: [] as string[],
});