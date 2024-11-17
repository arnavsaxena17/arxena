import { atom } from 'recoil';

export interface ChatPanelState {
  isOpen: boolean;
  selectedRecordId: string | null;
}

export const chatPanelState = atom<ChatPanelState>({
  key: 'chatPanelState',
  default: {
    isOpen: false,
    selectedRecordId: null,
  },
});