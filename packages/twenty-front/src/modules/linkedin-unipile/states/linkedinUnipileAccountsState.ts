import { atom, selector } from 'recoil';
import { UnipileLinkedinAccount } from 'twenty-shared';

import { workspaceMemberProfileUnipileFieldsState } from '@/unipile/states/workspaceMemberProfileUnipileFieldsState';
import { hasMatchingUsableLinkedinAccount } from '@/unipile/utils/matchUnipileToWorkspaceMemberProfile';

export const linkedinUnipileAccountsState = atom<UnipileLinkedinAccount[]>({
  key: 'linkedinUnipileAccountsState',
  default: [],
});

/** True when a usable LinkedIn Unipile account matches workspace member profile (connected or pending). */
export const isLinkedinUnipileConnectedSelector = selector<boolean>({
  key: 'isLinkedinUnipileConnectedSelector',
  get: ({ get }) =>
    hasMatchingUsableLinkedinAccount(
      get(linkedinUnipileAccountsState),
      get(workspaceMemberProfileUnipileFieldsState),
    ),
});
