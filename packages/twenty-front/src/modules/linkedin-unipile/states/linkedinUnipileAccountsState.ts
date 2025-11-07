import { atom, selector } from 'recoil';
import type { UnipileLinkedinAccount } from 'twenty-shared';

export const linkedinUnipileAccountsState = atom<UnipileLinkedinAccount[]>({
  key: 'linkedinUnipileAccountsState',
  default: [],
});

export const isLinkedinUnipileConnectedSelector = selector<boolean>({
  key: 'isLinkedinUnipileConnectedSelector',
  get: ({ get }) => {
    const accounts = get(linkedinUnipileAccountsState);
    return accounts.some((account) => account.status === 'connected');
  },
});


