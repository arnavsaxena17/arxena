import { atom, selector } from 'recoil';
import { UnipileLinkedinAccount } from 'twenty-shared';

import { workspaceMemberProfileUnipileFieldsState } from '@/unipile/states/workspaceMemberProfileUnipileFieldsState';
import { hasMatchingConnectedLinkedinAccount } from '@/unipile/utils/matchUnipileToWorkspaceMemberProfile';

export const linkedinUnipileAccountsState = atom<UnipileLinkedinAccount[]>({
  key: 'linkedinUnipileAccountsState',
  default: [],
});

/** True when a connected LinkedIn Unipile account matches workspace member profile linkedinUrl (or stored linkedinUnipileAccountId). */
export const isLinkedinUnipileConnectedSelector = selector<boolean>({
  key: 'isLinkedinUnipileConnectedSelector',
  get: ({ get }) =>
    hasMatchingConnectedLinkedinAccount(
      get(linkedinUnipileAccountsState),
      get(workspaceMemberProfileUnipileFieldsState),
    ),
});
