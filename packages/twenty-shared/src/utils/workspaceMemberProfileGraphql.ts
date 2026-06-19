import { WORKSPACE_MEMBER_PROFILE_FIELD_NAMES } from '../constants/workspaceMemberProfileFields';
import type { WorkspaceMemberProfileUnipileFields } from './unipileWorkspaceMemberMatch';

export type WorkspaceMemberLinkedinCookieTokens = {
  linkedinLiAtToken: string | null;
  linkedinLiAToken: string | null;
  linkedinUserAgent: string | null;
  linkedinIp: string | null;
  linkedinCountry: string | null;
  linkedinCookiesLastSyncedAt: string | null;
  linkedinCookiesValidatedAt: string | null;
};

export type WorkspaceMemberProfileGraphqlNode = {
  id: string;
  workspaceMemberId?: string | null;
  phoneNumber?: string | null;
  linkedinUrl?: string | null;
  whatsappUnipileAccountId?: string | null;
  linkedinUnipileAccountId?: string | null;
  keepLinkedinConnected?: boolean | null;
  linkedinProfile?: unknown;
  linkedinLiAtToken?: string | null;
  linkedinLiAToken?: string | null;
  linkedinUserAgent?: string | null;
  linkedinIp?: string | null;
  linkedinCountry?: string | null;
  linkedinCookiesLastSyncedAt?: string | null;
  linkedinCookiesValidatedAt?: string | null;
};

export type WorkspaceMemberProfilesGraphqlResponse = {
  data?: {
    data?: {
      workspaceMemberProfiles?: {
        edges?: Array<{ node?: WorkspaceMemberProfileGraphqlNode | null } | null>;
      };
    };
  };
};

export const workspaceMemberProfileFilterByMemberId = (
  workspaceMemberId: string,
) => ({
  filter: { workspaceMemberId: { eq: workspaceMemberId } },
  limit: 1,
});

export const extractWorkspaceMemberProfileNode = (
  response: WorkspaceMemberProfilesGraphqlResponse | null | undefined,
): WorkspaceMemberProfileGraphqlNode | null =>
  response?.data?.data?.workspaceMemberProfiles?.edges?.[0]?.node ?? null;

const trimOrNull = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();

  return trimmed ? trimmed : null;
};

export const parseWorkspaceMemberProfileUnipileFields = (
  profile: WorkspaceMemberProfileGraphqlNode | null | undefined,
): WorkspaceMemberProfileUnipileFields | null => {
  if (!profile) {
    return null;
  }

  return {
    phoneNumber: trimOrNull(profile.phoneNumber),
    linkedinUrl: trimOrNull(profile.linkedinUrl),
    whatsappUnipileAccountId: trimOrNull(profile.whatsappUnipileAccountId),
    linkedinUnipileAccountId: trimOrNull(profile.linkedinUnipileAccountId),
  };
};

export const parseWorkspaceMemberLinkedinCookieTokensFromGraphql = (
  profile: WorkspaceMemberProfileGraphqlNode | null | undefined,
  options?: {
    decryptToken?: (value: string | null) => string | null;
    normalizeCountry?: (value: string) => string | null;
  },
): WorkspaceMemberLinkedinCookieTokens => {
  const decrypt = options?.decryptToken ?? ((value: string | null) => value);

  return {
    linkedinLiAtToken: decrypt(trimOrNull(profile?.linkedinLiAtToken)),
    linkedinLiAToken: decrypt(trimOrNull(profile?.linkedinLiAToken)),
    linkedinUserAgent: trimOrNull(profile?.linkedinUserAgent),
    linkedinIp: trimOrNull(profile?.linkedinIp),
    linkedinCountry: (() => {
      const raw = trimOrNull(profile?.linkedinCountry);
      if (!raw) {
        return null;
      }

      return options?.normalizeCountry?.(raw) ?? raw;
    })(),
    linkedinCookiesLastSyncedAt:
      profile?.linkedinCookiesLastSyncedAt != null
        ? String(profile.linkedinCookiesLastSyncedAt)
        : null,
    linkedinCookiesValidatedAt:
      profile?.linkedinCookiesValidatedAt != null
        ? String(profile.linkedinCookiesValidatedAt)
        : null,
  };
};

export const workspaceMemberProfileUnipileAccountFieldName = (
  type: 'linkedin' | 'whatsapp',
): typeof WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinUnipileAccountId | typeof WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.whatsappUnipileAccountId =>
  type === 'linkedin'
    ? WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinUnipileAccountId
    : WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.whatsappUnipileAccountId;
