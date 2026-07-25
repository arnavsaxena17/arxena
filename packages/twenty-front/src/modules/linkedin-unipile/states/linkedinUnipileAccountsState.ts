import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { UnipileLinkedinAccount } from 'twenty-shared/arx';

import { workspaceMemberProfileUnipileFieldsState } from '@/unipile/states/workspaceMemberProfileUnipileFieldsState';
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
      get(workspaceMemberProfileUnipileFieldsState),
    ),
});
