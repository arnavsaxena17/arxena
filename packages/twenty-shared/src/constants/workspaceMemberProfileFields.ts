/**
 * Workspace member profile field names (mirror workspace-modifications fieldsData).
 */
export const WORKSPACE_MEMBER_PROFILE_FIELD_NAMES = {
  typeWorkspaceMember: 'typeWorkspaceMember',
  email: 'email',
  linkedinUrl: 'linkedinUrl',
  phoneNumber: 'phoneNumber',
  companyName: 'companyName',
  companyDescription: 'companyDescription',
  firstName: 'firstName',
  jobTitle: 'jobTitle',
  lastName: 'lastName',
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
} as const;

export type WorkspaceMemberProfileFieldName =
  (typeof WORKSPACE_MEMBER_PROFILE_FIELD_NAMES)[keyof typeof WORKSPACE_MEMBER_PROFILE_FIELD_NAMES];
