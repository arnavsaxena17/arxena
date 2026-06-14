import type { UnipileLinkedinAccount } from '../types/ArxChatTypes';
import {
    findLinkedinUnipileAccountSameIdentityForProfile,
    isUnipileConnectedStatus,
    type WorkspaceMemberProfileUnipileFields,
} from './unipileWorkspaceMemberMatch';

/** Resolve the LinkedIn Unipile account id for the current workspace member. */
export const resolveLinkedinUnipileAccountIdForWorkspaceMember = (
  profile: WorkspaceMemberProfileUnipileFields | null,
  accounts: UnipileLinkedinAccount[],
): string | null => {
  const storedId = profile?.linkedinUnipileAccountId?.trim();
  if (storedId) {
    return storedId;
  }

  const matched = findLinkedinUnipileAccountSameIdentityForProfile(
    accounts,
    profile,
  );
  if (matched != null && isUnipileConnectedStatus(matched.status)) {
    return matched.id;
  }

  return null;
};
