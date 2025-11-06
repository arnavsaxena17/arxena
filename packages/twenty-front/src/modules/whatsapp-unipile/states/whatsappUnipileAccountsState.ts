import { atom, selector } from 'recoil';
import type { UnipileWhatsappAccount } from 'twenty-shared';

export const whatsappUnipileAccountsState = atom<UnipileWhatsappAccount[]>({
  key: 'whatsappUnipileAccountsState',
  default: [],
});

export const isWhatsappUnipileLoggedInSelector = selector<boolean>({
  key: 'isWhatsappUnipileLoggedInSelector',
  get: ({ get }) => {
    const accounts = get(whatsappUnipileAccountsState);
    return accounts.length > 0;
  },
});

