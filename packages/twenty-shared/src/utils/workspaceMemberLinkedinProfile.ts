import type { UnipileAccountOwnerProfile } from './inferLinkedInSearchTypeFromUnipileOwnerProfile';

export type WorkspaceMemberLinkedinProfileStorage = {
  linkedinUnipileAccountId?: string;
  me?: UnipileAccountOwnerProfile & Record<string, unknown>;
  fullProfile?: Record<string, unknown>;
  publicIdentifier?: string;
  fetchedAt?: string;
};

export const parseWorkspaceMemberLinkedinProfile = (
  raw: unknown,
): WorkspaceMemberLinkedinProfileStorage | null => {
  if (raw == null) {
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return null;
    }

    try {
      return parseWorkspaceMemberLinkedinProfile(
        JSON.parse(trimmed) as unknown,
      );
    } catch {
      return null;
    }
  }

  if (typeof raw !== 'object') {
    return null;
  }

  return raw as WorkspaceMemberLinkedinProfileStorage;
};

export const hasWorkspaceMemberLinkedinOwnerProfile = (
  stored: WorkspaceMemberLinkedinProfileStorage | null,
): stored is WorkspaceMemberLinkedinProfileStorage & {
  me: NonNullable<WorkspaceMemberLinkedinProfileStorage['me']>;
} => stored?.me != null && typeof stored.me === 'object';

export const hasWorkspaceMemberLinkedinFullProfile = (
  stored: WorkspaceMemberLinkedinProfileStorage | null,
): stored is WorkspaceMemberLinkedinProfileStorage & {
  me: NonNullable<WorkspaceMemberLinkedinProfileStorage['me']>;
  fullProfile: NonNullable<WorkspaceMemberLinkedinProfileStorage['fullProfile']>;
  publicIdentifier: string;
} =>
  hasWorkspaceMemberLinkedinOwnerProfile(stored) &&
  stored.fullProfile != null &&
  typeof stored.fullProfile === 'object' &&
  typeof stored.publicIdentifier === 'string' &&
  stored.publicIdentifier.trim() !== '';

export const mergeWorkspaceMemberLinkedinProfile = (
  existing: WorkspaceMemberLinkedinProfileStorage | null,
  patch: WorkspaceMemberLinkedinProfileStorage,
): WorkspaceMemberLinkedinProfileStorage => ({
  ...(existing ?? {}),
  ...patch,
  linkedinUnipileAccountId:
    patch.linkedinUnipileAccountId ?? existing?.linkedinUnipileAccountId,
  me: patch.me ?? existing?.me,
  fullProfile: patch.fullProfile ?? existing?.fullProfile,
  publicIdentifier: patch.publicIdentifier ?? existing?.publicIdentifier,
  fetchedAt: patch.fetchedAt ?? existing?.fetchedAt,
});

export const workspaceMemberLinkedinProfileMatchesAccountId = (
  stored: WorkspaceMemberLinkedinProfileStorage | null,
  accountId: string,
): boolean => {
  const trimmedAccountId = accountId.trim();
  if (!trimmedAccountId || !stored) {
    return false;
  }

  const storedAccountId = stored.linkedinUnipileAccountId?.trim();
  if (!storedAccountId) {
    return true;
  }

  return storedAccountId === trimmedAccountId;
};
