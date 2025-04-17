import { atom } from 'recoil';

export const chatSearchQueryState = atom<string>({
  key: 'chatSearchQueryState',
  default: '',
}); 