import {
  type UnipileLinkedinAccount,
  type UnipileWhatsappAccount,
} from '../types/ArxChatTypes';

export type WorkspaceMemberProfileUnipileFields = {
  phoneNumber: string | null;
  linkedinUrl: string | null;
  whatsappUnipileAccountId: string | null;
  linkedinUnipileAccountId: string | null;
};

export const normalizeUnipileStatus = (status?: string | null): string =>
  status != null && status !== '' ? status.toLowerCase() : '';

/** True when Unipile reports the account as fully connected (not pending/checkpoint). */
export const isUnipileConnectedStatus = (status?: string | null): boolean =>
  normalizeUnipileStatus(status) === 'connected';

export const normalizePhoneDigits = (value: string): string =>
  value.replace(/\D/g, '');

const phonesMatch = (a: string, b: string): boolean => {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (da === '' || db === '') {
    return false;
  }
  if (da === db) {
    return true;
  }
  if (da.length >= 10 && db.length >= 10) {
    return da.slice(-10) === db.slice(-10);
  }
  return false;
};

export const extractLinkedinSlugFromUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (trimmed === '') {
    return '';
  }
  try {
    const withHost = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const url = new URL(withHost);
    const path = url.pathname.replace(/\/+$/, '');
    const inMatch = path.match(/\/in\/([^/]+)/i);
    if (inMatch != null && inMatch[1] != null && inMatch[1] !== '') {
      return inMatch[1].toLowerCase();
    }
    const segments = path.split('/').filter(Boolean);
    return (segments[segments.length - 1] ?? '').toLowerCase();
  } catch {
    const withoutQuery = trimmed.split('?')[0] ?? trimmed;
    const inMatch = withoutQuery.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (inMatch != null && inMatch[1] != null && inMatch[1] !== '') {
      return inMatch[1].toLowerCase();
    }
    return withoutQuery.replace(/^\/+|\/+$/g, '').toLowerCase();
  }
};

const getUnipileLinkedinPublicIdentifier = (
  account: UnipileLinkedinAccount,
): string => {
  const im = account.connection_params?.im as
    | { publicIdentifier?: unknown }
    | undefined;
  const raw = im?.publicIdentifier;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().toLowerCase();
  }
  return '';
};

const normalizeLinkedinAccountIdentifier = (
  account: UnipileLinkedinAccount,
): string => {
  const fromPublicId = getUnipileLinkedinPublicIdentifier(account);
  if (fromPublicId !== '') {
    return fromPublicId.replace(/^@/, '');
  }
  const fromUsername = account.username?.trim().toLowerCase() ?? '';
  if (fromUsername.includes('linkedin.com')) {
    return extractLinkedinSlugFromUrl(fromUsername);
  }
  return fromUsername.replace(/^@/, '');
};

const linkedinSlugMatchesProfile = (
  profileLinkedinUrl: string,
  account: UnipileLinkedinAccount,
): boolean => {
  const profileSlug = extractLinkedinSlugFromUrl(profileLinkedinUrl);
  if (profileSlug === '') {
    return false;
  }
  const accountSlug = normalizeLinkedinAccountIdentifier(account);
  if (accountSlug === '') {
    return false;
  }
  if (profileSlug === accountSlug) {
    return true;
  }
  return (
    profileSlug === extractLinkedinSlugFromUrl(account.username) ||
    accountSlug === extractLinkedinSlugFromUrl(profileLinkedinUrl)
  );
};

export const shouldRestrictWhatsappByProfile = (
  profile: WorkspaceMemberProfileUnipileFields | null,
): boolean => {
  if (profile == null) {
    return false;
  }
  return Boolean(profile.phoneNumber?.trim());
};

export const shouldRestrictLinkedinByProfile = (
  profile: WorkspaceMemberProfileUnipileFields | null,
): boolean => {
  if (profile == null) {
    return false;
  }
  return (
    Boolean(profile.linkedinUrl?.trim()) ||
    Boolean(profile.linkedinUnipileAccountId?.trim())
  );
};

export const whatsappAccountMatchesWorkspaceMemberProfile = (
  profile: WorkspaceMemberProfileUnipileFields,
  account: UnipileWhatsappAccount,
): boolean => {
  if (!isUnipileConnectedStatus(account.status)) {
    return false;
  }
  const storedId = profile.whatsappUnipileAccountId?.trim();
  if (storedId != null && storedId !== '' && storedId === account.id) {
    return true;
  }
  const profilePhone = profile.phoneNumber?.trim();
  if (profilePhone == null || profilePhone === '') {
    return false;
  }
  const accountPhone =
    account.phone_number?.trim() ?? account.username?.trim() ?? '';
  return phonesMatch(profilePhone, accountPhone);
};

export const linkedinAccountMatchesWorkspaceMemberProfile = (
  profile: WorkspaceMemberProfileUnipileFields,
  account: UnipileLinkedinAccount,
): boolean => {
  if (!isUnipileConnectedStatus(account.status)) {
    return false;
  }
  const storedId = profile.linkedinUnipileAccountId?.trim();
  if (storedId != null && storedId !== '' && storedId === account.id) {
    return true;
  }
  const profileUrl = profile.linkedinUrl?.trim();
  if (profileUrl == null || profileUrl === '') {
    return false;
  }
  return linkedinSlugMatchesProfile(profileUrl, account);
};

export const filterWhatsappAccountsForWorkspaceMemberProfile = (
  accounts: UnipileWhatsappAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): UnipileWhatsappAccount[] => {
  if (profile == null || !shouldRestrictWhatsappByProfile(profile)) {
    return accounts;
  }
  return accounts.filter((acc) =>
    whatsappAccountMatchesWorkspaceMemberProfile(profile, acc),
  );
};

export const filterLinkedinAccountsForWorkspaceMemberProfile = (
  accounts: UnipileLinkedinAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): UnipileLinkedinAccount[] => {
  if (profile == null || !shouldRestrictLinkedinByProfile(profile)) {
    return accounts;
  }
  return accounts.filter((acc) =>
    linkedinAccountMatchesWorkspaceMemberProfile(profile, acc),
  );
};

export const hasMatchingConnectedWhatsappAccount = (
  accounts: UnipileWhatsappAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): boolean => {
  if (!shouldRestrictWhatsappByProfile(profile)) {
    return accounts.some((acc) => isUnipileConnectedStatus(acc.status));
  }
  if (profile == null) {
    return false;
  }
  return accounts.some((acc) =>
    whatsappAccountMatchesWorkspaceMemberProfile(profile, acc),
  );
};

export const shouldShowWhatsappUnipileConnectQr = (
  accounts: UnipileWhatsappAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): boolean => {
  if (!shouldRestrictWhatsappByProfile(profile)) {
    return true;
  }
  return !hasMatchingConnectedWhatsappAccount(accounts, profile);
};

export const hasMatchingConnectedLinkedinAccount = (
  accounts: UnipileLinkedinAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): boolean => {
  if (!shouldRestrictLinkedinByProfile(profile)) {
    return accounts.some((acc) => isUnipileConnectedStatus(acc.status));
  }
  if (profile == null) {
    return false;
  }
  return accounts.some((acc) =>
    linkedinAccountMatchesWorkspaceMemberProfile(profile, acc),
  );
};

/**
 * True for any status other than disconnected (e.g. connected, pending, connecting).
 * Used to avoid creating duplicate Unipile connections while an account is still active or reconnecting.
 */
export const shouldBlockNewUnipileConnectionForStatus = (
  status?: string | null,
): boolean => {
  const n = normalizeUnipileStatus(status);
  if (n === '' || n === 'disconnected') {
    return false;
  }
  return true;
};

export const linkedinAccountIdentityMatchesWorkspaceMemberProfile = (
  profile: WorkspaceMemberProfileUnipileFields,
  account: UnipileLinkedinAccount,
): boolean => {
  const storedId = profile.linkedinUnipileAccountId?.trim();
  if (storedId != null && storedId !== '' && storedId === account.id) {
    return true;
  }
  const profileUrl = profile.linkedinUrl?.trim();
  if (profileUrl == null || profileUrl === '') {
    return false;
  }
  return linkedinSlugMatchesProfile(profileUrl, account);
};

export const whatsappAccountIdentityMatchesWorkspaceMemberProfile = (
  profile: WorkspaceMemberProfileUnipileFields,
  account: UnipileWhatsappAccount,
): boolean => {
  const storedId = profile.whatsappUnipileAccountId?.trim();
  if (storedId != null && storedId !== '' && storedId === account.id) {
    return true;
  }
  const profilePhone = profile.phoneNumber?.trim();
  if (profilePhone == null || profilePhone === '') {
    return false;
  }
  const accountPhone =
    account.phone_number?.trim() ?? account.username?.trim() ?? '';
  return phonesMatch(profilePhone, accountPhone);
};

/**
 * First Unipile account row whose identity matches the workspace member (URL slug, stored id, etc.).
 * Includes disconnected rows; callers should check `status` before acting.
 */
export const findLinkedinUnipileAccountSameIdentityForProfile = (
  accounts: UnipileLinkedinAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): UnipileLinkedinAccount | undefined => {
  if (profile == null || !shouldRestrictLinkedinByProfile(profile)) {
    return undefined;
  }
  for (const acc of accounts) {
    if (linkedinAccountIdentityMatchesWorkspaceMemberProfile(profile, acc)) {
      return acc;
    }
  }
  return undefined;
};

/**
 * First WhatsApp row matching the member's phone / stored account id.
 */
export const findWhatsappUnipileAccountSameIdentityForProfile = (
  accounts: UnipileWhatsappAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): UnipileWhatsappAccount | undefined => {
  if (profile == null || !shouldRestrictWhatsappByProfile(profile)) {
    return undefined;
  }
  for (const acc of accounts) {
    if (whatsappAccountIdentityMatchesWorkspaceMemberProfile(profile, acc)) {
      return acc;
    }
  }
  return undefined;
};

export const findLinkedinUnipileAccountBlockingNewConnectionForProfile = (
  accounts: UnipileLinkedinAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): UnipileLinkedinAccount | undefined => {
  if (profile == null || !shouldRestrictLinkedinByProfile(profile)) {
    return undefined;
  }
  for (const acc of accounts) {
    if (!linkedinAccountIdentityMatchesWorkspaceMemberProfile(profile, acc)) {
      continue;
    }
    if (shouldBlockNewUnipileConnectionForStatus(acc.status)) {
      return acc;
    }
  }
  return undefined;
};

/**
 * @param accounts Rows from Unipile accounts API (not CRM profile). Profile is used only to pick the matching identity.
 */
export const findWhatsappUnipileAccountBlockingNewConnectionForProfile = (
  accounts: UnipileWhatsappAccount[],
  profile: WorkspaceMemberProfileUnipileFields | null,
): UnipileWhatsappAccount | undefined => {
  if (profile == null || !shouldRestrictWhatsappByProfile(profile)) {
    return undefined;
  }
  for (const acc of accounts) {
    if (!whatsappAccountIdentityMatchesWorkspaceMemberProfile(profile, acc)) {
      continue;
    }
    if (shouldBlockNewUnipileConnectionForStatus(acc.status)) {
      return acc;
    }
  }
  return undefined;
};
