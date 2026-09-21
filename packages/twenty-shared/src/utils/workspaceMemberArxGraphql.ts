import { WORKSPACE_MEMBER_ARX_FIELD_NAMES } from '../constants/workspaceMemberArxFields';
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

export type BrowserExtensionCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number | null;
  hostOnly?: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  session?: boolean;
  sameSite?: string | null;
  storeId?: string | null;
};

export type WorkspaceMemberArxGraphqlNode = {
  id: string;
  userEmail?: string | null;
  jobTitle?: string | null;
  name?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  phoneNumber?: string | null;
  linkedinUrl?: string | null;
  whatsappUnipileAccountId?: string | null;
  linkedinUnipileAccountId?: string | null;
  chromeExtensionId?: string | null;
  keepLinkedinConnected?: boolean | null;
  linkedinProfile?: unknown;
  outreachSenderProfile?: unknown;
  linkedinLiAtToken?: string | null;
  linkedinLiAToken?: string | null;
  linkedinUserAgent?: string | null;
  linkedinIp?: string | null;
  linkedinCountry?: string | null;
  linkedinCookiesLastSyncedAt?: string | null;
  linkedinCookiesValidatedAt?: string | null;
  crunchbaseCookies?: BrowserExtensionCookie[] | null;
  crunchbaseCookiesLastSyncedAt?: string | null;
  typeWorkspaceMember?: string | null;
};

export type WorkspaceMembersConnection = {
  edges?: Array<{ node?: WorkspaceMemberArxGraphqlNode | null } | null> | null;
};

export type WorkspaceMembersGraphqlResponse = {
  data?: {
    data?: {
      workspaceMembers?: WorkspaceMembersConnection;
    };
  };
};

export type WorkspaceMembersApolloData = {
  workspaceMembers?: WorkspaceMembersConnection | null;
};

export const workspaceMemberFilterById = (workspaceMemberId: string) => ({
  filter: { id: { eq: workspaceMemberId } },
  limit: 1,
});

export const extractWorkspaceMemberFromConnection = (
  connection: WorkspaceMembersConnection | null | undefined,
): WorkspaceMemberArxGraphqlNode | null => connection?.edges?.[0]?.node ?? null;

export const extractWorkspaceMemberNode = (
  response: WorkspaceMembersGraphqlResponse | null | undefined,
): WorkspaceMemberArxGraphqlNode | null =>
  extractWorkspaceMemberFromConnection(response?.data?.data?.workspaceMembers);

export const extractWorkspaceMemberFromApolloData = (
  data: WorkspaceMembersApolloData | null | undefined,
): WorkspaceMemberArxGraphqlNode | null =>
  extractWorkspaceMemberFromConnection(data?.workspaceMembers);

export const extractWorkspaceMemberFromRelationField = (
  relationField: unknown,
): WorkspaceMemberArxGraphqlNode | null => {
  if (!relationField || typeof relationField !== 'object') {
    return null;
  }

  const asConnection = relationField as WorkspaceMembersConnection;
  const fromEdges = extractWorkspaceMemberFromConnection(asConnection);

  if (fromEdges) {
    return fromEdges;
  }

  const asNode = relationField as WorkspaceMemberArxGraphqlNode;

  if (
    typeof asNode.id === 'string' &&
    !Array.isArray((relationField as { edges?: unknown }).edges)
  ) {
    return asNode;
  }

  return null;
};

export const workspaceMemberEmail = (
  member: WorkspaceMemberArxGraphqlNode | null | undefined,
): string | null => trimOrNull(member?.userEmail);

export const workspaceMemberFirstName = (
  member: WorkspaceMemberArxGraphqlNode | null | undefined,
): string => trimOrNull(member?.name?.firstName) ?? '';

export const workspaceMemberLastName = (
  member: WorkspaceMemberArxGraphqlNode | null | undefined,
): string => trimOrNull(member?.name?.lastName) ?? '';

export const workspaceMemberDisplayName = (
  member: WorkspaceMemberArxGraphqlNode | null | undefined,
): string => {
  const composed = [
    workspaceMemberFirstName(member),
    workspaceMemberLastName(member),
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  return composed;
};

const trimOrNull = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();

  return trimmed ? trimmed : null;
};

export const parseWorkspaceMemberUnipileFields = (
  member: WorkspaceMemberArxGraphqlNode | null | undefined,
): WorkspaceMemberProfileUnipileFields | null => {
  if (!member) {
    return null;
  }

  return {
    phoneNumber: trimOrNull(member.phoneNumber),
    linkedinUrl: trimOrNull(member.linkedinUrl),
    whatsappUnipileAccountId: trimOrNull(member.whatsappUnipileAccountId),
    linkedinUnipileAccountId: trimOrNull(member.linkedinUnipileAccountId),
  };
};

export const parseWorkspaceMemberLinkedinCookieTokensFromGraphql = (
  member: WorkspaceMemberArxGraphqlNode | null | undefined,
  options?: {
    decryptToken?: (value: string | null) => string | null;
    normalizeCountry?: (value: string) => string | null;
  },
): WorkspaceMemberLinkedinCookieTokens => {
  const decrypt = options?.decryptToken ?? ((value: string | null) => value);

  return {
    linkedinLiAtToken: decrypt(trimOrNull(member?.linkedinLiAtToken)),
    linkedinLiAToken: decrypt(trimOrNull(member?.linkedinLiAToken)),
    linkedinUserAgent: trimOrNull(member?.linkedinUserAgent),
    linkedinIp: trimOrNull(member?.linkedinIp),
    linkedinCountry: (() => {
      const raw = trimOrNull(member?.linkedinCountry);
      if (!raw) {
        return null;
      }

      return options?.normalizeCountry?.(raw) ?? raw;
    })(),
    linkedinCookiesLastSyncedAt:
      member?.linkedinCookiesLastSyncedAt != null
        ? String(member.linkedinCookiesLastSyncedAt)
        : null,
    linkedinCookiesValidatedAt:
      member?.linkedinCookiesValidatedAt != null
        ? String(member.linkedinCookiesValidatedAt)
        : null,
  };
};

const isCrunchbaseCookieDomain = (domain: string): boolean => {
  const normalized = domain.trim().toLowerCase().replace(/^\./, '');

  return (
    normalized === 'crunchbase.com' || normalized.endsWith('.crunchbase.com')
  );
};

export const parseBrowserExtensionCookieArray = (
  value: unknown,
): BrowserExtensionCookie[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const cookies: BrowserExtensionCookie[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const cookieValue =
      typeof record.value === 'string' ? record.value : null;
    const domain =
      typeof record.domain === 'string' ? record.domain.trim() : '';

    if (!name || cookieValue === null || !domain) {
      return null;
    }

    if (!isCrunchbaseCookieDomain(domain)) {
      return null;
    }

    cookies.push({
      name,
      value: cookieValue,
      domain,
      path: typeof record.path === 'string' ? record.path : '/',
      expirationDate:
        typeof record.expirationDate === 'number'
          ? record.expirationDate
          : null,
      hostOnly:
        typeof record.hostOnly === 'boolean' ? record.hostOnly : undefined,
      httpOnly:
        typeof record.httpOnly === 'boolean' ? record.httpOnly : undefined,
      secure: typeof record.secure === 'boolean' ? record.secure : undefined,
      session:
        typeof record.session === 'boolean' ? record.session : undefined,
      sameSite:
        record.sameSite === null || typeof record.sameSite === 'string'
          ? (record.sameSite as string | null)
          : null,
      storeId:
        record.storeId === null || typeof record.storeId === 'string'
          ? (record.storeId as string | null)
          : null,
    });
  }

  return cookies;
};

export const parseWorkspaceMemberCrunchbaseCookies = (
  member: WorkspaceMemberArxGraphqlNode | null | undefined,
): {
  crunchbaseCookies: BrowserExtensionCookie[] | null;
  crunchbaseCookiesLastSyncedAt: string | null;
} => ({
  crunchbaseCookies: parseBrowserExtensionCookieArray(
    member?.crunchbaseCookies,
  ),
  crunchbaseCookiesLastSyncedAt:
    member?.crunchbaseCookiesLastSyncedAt != null
      ? String(member.crunchbaseCookiesLastSyncedAt)
      : null,
});

export const workspaceMemberUnipileAccountFieldName = (
  type: 'linkedin' | 'whatsapp',
):
  | typeof WORKSPACE_MEMBER_ARX_FIELD_NAMES.linkedinUnipileAccountId
  | typeof WORKSPACE_MEMBER_ARX_FIELD_NAMES.whatsappUnipileAccountId =>
  type === 'linkedin'
    ? WORKSPACE_MEMBER_ARX_FIELD_NAMES.linkedinUnipileAccountId
    : WORKSPACE_MEMBER_ARX_FIELD_NAMES.whatsappUnipileAccountId;
