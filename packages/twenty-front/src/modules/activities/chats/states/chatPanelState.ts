import { atom } from 'recoil';

export const chatPanelState = atom<{
  selectedRecordIds: string[];
}>({
  key: 'chatPanelState',
  default: {
    selectedRecordIds: []
  }
});