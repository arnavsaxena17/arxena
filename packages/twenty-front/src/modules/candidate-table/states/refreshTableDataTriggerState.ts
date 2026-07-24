import { atom } from 'recoil';

export const refreshTableDataTriggerState = atom<boolean>({
  key: 'refreshTableDataTriggerState',
  default: false,
}); 