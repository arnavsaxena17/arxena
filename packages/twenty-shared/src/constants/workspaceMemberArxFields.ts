/**
 * Arxena fields on workspaceMember (formerly workspaceMemberProfile).
 */
export const WORKSPACE_MEMBER_ARX_FIELD_NAMES = {
  typeWorkspaceMember: 'typeWorkspaceMember',
  linkedinUrl: 'linkedinUrl',
  phoneNumber: 'phoneNumber',
  linkedinUnipileAccountId: 'linkedinUnipileAccountId',
  linkedinLiAtToken: 'linkedinLiAtToken',
  linkedinCookiesLastSyncedAt: 'linkedinCookiesLastSyncedAt',
  chromeExtensionId: 'chromeExtensionId',
  linkedinLiAToken: 'linkedinLiAToken',
  linkedinUserAgent: 'linkedinUserAgent',
  linkedinIp: 'linkedinIp',
  linkedinCountry: 'linkedinCountry',
  linkedinCookiesValidatedAt: 'linkedinCookiesValidatedAt',
  whatsappUnipileAccountId: 'whatsappUnipileAccountId',
  keepLinkedinConnected: 'keepLinkedinConnected',
  linkedinProfile: 'linkedinProfile',
  outreachSenderProfile: 'outreachSenderProfile',
  lastLinkedinConnectAt: 'lastLinkedinConnectAt',
  lastLinkedinMessageAt: 'lastLinkedinMessageAt',
} as const;

export type WorkspaceMemberArxFieldName =
  (typeof WORKSPACE_MEMBER_ARX_FIELD_NAMES)[keyof typeof WORKSPACE_MEMBER_ARX_FIELD_NAMES];
