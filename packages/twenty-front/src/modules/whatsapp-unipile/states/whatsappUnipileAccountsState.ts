import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { UnipileWhatsappAccount } from 'twenty-shared/arx';

import { workspaceMemberProfileUnipileFieldsState } from '@/unipile/states/workspaceMemberProfileUnipileFieldsState';
import { hasMatchingConnectedWhatsappAccount } from '@/unipile/utils/matchUnipileToWorkspaceMemberProfile';

export const whatsappUnipileAccountsState = createAtomState<
  UnipileWhatsappAccount[]
>({
  key: 'whatsappUnipileAccountsState',
  defaultValue: [],
});

export const isWhatsappUnipileLoggedInSelector = createAtomSelector<boolean>({
  key: 'isWhatsappUnipileLoggedInSelector',
  get: ({ get }) => {
    const accounts = get(whatsappUnipileAccountsState);
    return accounts.length > 0;
  },
});

/** True when a connected WhatsApp Unipile account matches workspace member profile phone (or stored whatsappUnipileAccountId). */
export const isWhatsappUnipileConnectedSelector = createAtomSelector<boolean>({
  key: 'isWhatsappUnipileConnectedSelector',
  get: ({ get }) =>
    hasMatchingConnectedWhatsappAccount(
      get(whatsappUnipileAccountsState),
      get(workspaceMemberProfileUnipileFieldsState),
    ),
});
