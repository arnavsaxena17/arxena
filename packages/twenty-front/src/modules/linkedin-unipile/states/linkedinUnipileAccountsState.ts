import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { UnipileLinkedinAccount } from 'twenty-shared/arx';

import { workspaceMemberUnipileFieldsState } from '@/unipile/states/workspaceMemberUnipileFieldsState';
import { hasMatchingUsableLinkedinAccount } from '@/unipile/utils/matchUnipileToWorkspaceMemberProfile';

export const linkedinUnipileAccountsState = createAtomState<
  UnipileLinkedinAccount[]
>({
  key: 'linkedinUnipileAccountsState',
  defaultValue: [],
});

/** True when a usable LinkedIn Unipile account matches workspace member profile (connected or pending). */
export const isLinkedinUnipileConnectedSelector = createAtomSelector<boolean>({
  key: 'isLinkedinUnipileConnectedSelector',
  get: ({ get }) =>
    hasMatchingUsableLinkedinAccount(
      get(linkedinUnipileAccountsState),
      get(workspaceMemberUnipileFieldsState),
    ),
});
