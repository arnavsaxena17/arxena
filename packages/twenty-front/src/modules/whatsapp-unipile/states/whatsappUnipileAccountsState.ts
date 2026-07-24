import { atom, selector } from 'recoil';
import { UnipileWhatsappAccount } from 'twenty-shared';

import { workspaceMemberProfileUnipileFieldsState } from '@/unipile/states/workspaceMemberProfileUnipileFieldsState';
import { hasMatchingConnectedWhatsappAccount } from '@/unipile/utils/matchUnipileToWorkspaceMemberProfile';

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

/** True when a connected WhatsApp Unipile account matches workspace member profile phone (or stored whatsappUnipileAccountId). */
export const isWhatsappUnipileConnectedSelector = selector<boolean>({
  key: 'isWhatsappUnipileConnectedSelector',
  get: ({ get }) =>
    hasMatchingConnectedWhatsappAccount(
      get(whatsappUnipileAccountsState),
      get(workspaceMemberProfileUnipileFieldsState),
    ),
});
