import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import {
  extractLinkedinSlugFromUrl,
  extractWorkspaceMemberProfileNode,
  findWorkspaceMemberLinkedinProfile,
  findWorkspaceMemberProfileLinkedinCookies,
  findWorkspaceMemberProfiles,
  graphQLToCreateOneWorkspaceMemberProfile,
  graphQLToUpdateOneWorkspaceMemberProfile,
  graphQLToUpdateWorkspaceMemberLinkedinCookieTokens,
  graphQLToUpdateWorkspaceMemberLinkedinProfile,
  mergeWorkspaceMemberLinkedinProfile,
  parseWorkspaceMemberLinkedinCookieTokensFromGraphql,
  parseWorkspaceMemberLinkedinProfile,
  parseWorkspaceMemberProfileUnipileFields,
  WORKSPACE_MEMBER_PROFILE_FIELD_NAMES,
  workspaceMemberProfileFilterByMemberId,
  workspaceMemberProfileUnipileAccountFieldName,
  type WorkspaceMemberLinkedinCookieTokens,
  type WorkspaceMemberLinkedinProfileStorage,
  type WorkspaceMemberProfileGraphqlNode,
  type WorkspaceMemberProfileUnipileFields,
} from 'twenty-shared';

import { normalizeLinkedinConnectionCountry } from 'src/engine/core-modules/arx-chat/utils/build-unipile-linkedin-cookie-connect-body.util';
import {
  extractLinkedinProfileUrlFromUnipileAccount,
  extractWhatsappPhoneFromUnipileAccount,
} from 'src/engine/core-modules/arx-chat/utils/unipile-account-member-profile-fields.util';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { lookupCountryByIp } from 'twenty-shared';

type UnipileAccountType = 'linkedin' | 'whatsapp';

@Injectable()
export class WorkspaceMemberProfileUnipileService {
  private readonly logger = new Logger(
    WorkspaceMemberProfileUnipileService.name,
  );
  private readonly encryptedTokenPrefix = 'enc:v1:';

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  private getLinkedinCookieEncryptionKey(): Uint8Array | null {
    const secret = process.env.APP_SECRET?.trim();
    if (!secret) {
      return null;
    }

    return Uint8Array.from(createHash('sha256').update(secret).digest());
  }

  private encryptLinkedinCookieToken(value: string | null): string | null {
    if (value == null) {
      return null;
    }

    const key = this.getLinkedinCookieEncryptionKey();
    if (!key) {
      return value;
    }

    const iv = Uint8Array.from(randomBytes(12));
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      Uint8Array.from(cipher.update(value, 'utf8')),
      Uint8Array.from(cipher.final()),
    ]);
    const authTag = cipher.getAuthTag();

    return `${this.encryptedTokenPrefix}${Buffer.from(iv).toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private toDbLinkedinCookieToken(value: string | null): string {
    if (value == null || value.trim() === '') {
      return '';
    }

    return this.encryptLinkedinCookieToken(value) ?? value;
  }

  private fromDbLinkedinCookieToken(value: string | null): string | null {
    if (value == null || value.trim() === '') {
      return null;
    }

    return this.decryptLinkedinCookieToken(value);
  }

  private decryptLinkedinCookieToken(value: string | null): string | null {
    if (
      value == null ||
      !value.startsWith(this.encryptedTokenPrefix)
    ) {
      return value;
    }

    const key = this.getLinkedinCookieEncryptionKey();
    if (!key) {
      this.logger.warn(
        'Encountered encrypted LinkedIn cookie token without APP_SECRET; returning null',
      );
      return null;
    }

    const payload = value.slice(this.encryptedTokenPrefix.length);
    const [ivRaw, authTagRaw, encryptedRaw] = payload.split(':');

    if (!ivRaw || !authTagRaw || !encryptedRaw) {
      return null;
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Uint8Array.from(Buffer.from(ivRaw, 'base64')),
      );
      decipher.setAuthTag(Uint8Array.from(Buffer.from(authTagRaw, 'base64')));

      return Buffer.concat([
        Uint8Array.from(
          decipher.update(Uint8Array.from(Buffer.from(encryptedRaw, 'base64'))),
        ),
        Uint8Array.from(decipher.final()),
      ]).toString('utf8');
    } catch (error) {
      this.logger.warn('Failed to decrypt LinkedIn cookie token', error);
      return null;
    }
  }

  private async findProfileNodeByWorkspaceMemberId(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<WorkspaceMemberProfileGraphqlNode | null> {
    const response = await this.staticGraphQLService.executeGraphQL(
      findWorkspaceMemberProfiles,
      workspaceMemberProfileFilterByMemberId(workspaceMemberId),
      authToken,
    );

    return extractWorkspaceMemberProfileNode(response);
  }

  private async findProfileCookieNodeByWorkspaceMemberId(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<WorkspaceMemberProfileGraphqlNode | null> {
    const response = await this.staticGraphQLService.executeGraphQL(
      findWorkspaceMemberProfileLinkedinCookies,
      workspaceMemberProfileFilterByMemberId(workspaceMemberId),
      authToken,
    );

    return extractWorkspaceMemberProfileNode(response);
  }

  private async ensureProfileIdForMember(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<string | null> {
    const existing = await this.findProfileNodeByWorkspaceMemberId(
      workspaceMemberId,
      authToken,
    );

    if (existing?.id) {
      return existing.id;
    }

    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphQLToCreateOneWorkspaceMemberProfile,
        {
          input: {
            workspaceMemberId,
            [WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.typeWorkspaceMember]:
              'recruiterType',
          },
        },
        authToken,
      );

      return (
        response?.data?.data?.createWorkspaceMemberProfile?.id ?? null
      );
    } catch (error) {
      this.logger.warn(
        `Failed to create workspace member profile for ${workspaceMemberId}:`,
        error,
      );

      return null;
    }
  }

  async updateWorkspaceMemberLinkedinCookieTokens(
    authToken: string,
    workspaceMemberId: string,
    tokens: Partial<WorkspaceMemberLinkedinCookieTokens>,
    options?: {
      touchLastSyncedAt?: boolean;
      touchLastValidatedAt?: boolean;
    },
  ): Promise<void> {
    const profileId = await this.ensureProfileIdForMember(
      workspaceMemberId,
      authToken,
    );

    if (!profileId) {
      this.logger.warn(
        `No workspace member profile for ${workspaceMemberId}, cannot update LinkedIn cookie tokens`,
      );
      return;
    }

    const input: Record<string, string> = {};

    if (tokens.linkedinLiAtToken !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinLiAtToken] =
        this.toDbLinkedinCookieToken(tokens.linkedinLiAtToken);
    }

    if (tokens.linkedinLiAToken !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinLiAToken] =
        this.toDbLinkedinCookieToken(tokens.linkedinLiAToken);
    }

    if (tokens.linkedinUserAgent !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinUserAgent] =
        tokens.linkedinUserAgent ?? '';
    }

    if (tokens.linkedinIp !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinIp] =
        tokens.linkedinIp ?? '';
    }

    let linkedinCountryToPersist = tokens.linkedinCountry;
    if (tokens.linkedinIp !== undefined && tokens.linkedinCountry === undefined) {
      linkedinCountryToPersist = tokens.linkedinIp
        ? ((await lookupCountryByIp(tokens.linkedinIp)) ?? null)
        : null;
    }

    if (linkedinCountryToPersist !== undefined) {
      const normalizedCountry = linkedinCountryToPersist
        ? (normalizeLinkedinConnectionCountry(linkedinCountryToPersist) ?? null)
        : null;
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCountry] =
        normalizedCountry ?? '';
    }

    if (options?.touchLastSyncedAt) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCookiesLastSyncedAt] =
        new Date().toISOString();
    }

    if (options?.touchLastValidatedAt) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCookiesValidatedAt] =
        new Date().toISOString();
    }

    if (Object.keys(input).length === 0) {
      return;
    }

    this.logger.log(
      `[updateLinkedinCookieTokens] Updating workspaceMemberId=${workspaceMemberId} fields=${Object.keys(input).join(', ')}`,
    );

    await this.staticGraphQLService.executeGraphQL(
      graphQLToUpdateWorkspaceMemberLinkedinCookieTokens,
      {
        idToUpdate: profileId,
        input,
      },
      authToken,
    );

    this.logger.log(
      `[updateLinkedinCookieTokens] UPDATE complete for workspaceMemberId=${workspaceMemberId}`,
    );
  }

  async getWorkspaceMemberLinkedinCookieTokens(
    authToken: string,
    workspaceMemberId: string,
  ): Promise<WorkspaceMemberLinkedinCookieTokens> {
    try {
      const profile = await this.findProfileCookieNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      return parseWorkspaceMemberLinkedinCookieTokensFromGraphql(profile, {
        decryptToken: (value) => this.fromDbLinkedinCookieToken(value),
        normalizeCountry: (value) =>
          normalizeLinkedinConnectionCountry(value) ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to load LinkedIn cookie tokens for workspace member ${workspaceMemberId}:`,
        error,
      );

      return parseWorkspaceMemberLinkedinCookieTokensFromGraphql(null);
    }
  }

  async clearWorkspaceMemberLinkedinCookieTokens(
    authToken: string,
    workspaceMemberId: string,
  ): Promise<void> {
    await this.updateWorkspaceMemberLinkedinCookieTokens(
      authToken,
      workspaceMemberId,
      {
        linkedinLiAtToken: null,
        linkedinLiAToken: null,
        linkedinUserAgent: null,
        linkedinIp: null,
        linkedinCountry: null,
      },
      { touchLastSyncedAt: true },
    );
  }

  /**
   * Get Unipile account ID for a workspace member from workspaceMemberProfile only.
   * Workspace-wide whatsapp_unipile_account_id / linkedin_unipile_account_id keys are deprecated
   * (multiple members may each have their own Unipile account).
   */
  async getWorkspaceMemberLinkedinProfile(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<WorkspaceMemberLinkedinProfileStorage | null> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberLinkedinProfile,
        workspaceMemberProfileFilterByMemberId(workspaceMemberId),
        authToken,
      );

      const profile = extractWorkspaceMemberProfileNode(response);

      if (!profile?.id) {
        return null;
      }

      return parseWorkspaceMemberLinkedinProfile(profile.linkedinProfile);
    } catch (error) {
      this.logger.warn(
        `Failed to load LinkedIn profile for workspace member ${workspaceMemberId}:`,
        error,
      );
      return null;
    }
  }

  async saveWorkspaceMemberLinkedinProfile(
    workspaceMemberId: string,
    authToken: string,
    patch: WorkspaceMemberLinkedinProfileStorage,
  ): Promise<void> {
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile for ${workspaceMemberId}, cannot save linkedinProfile`,
        );
        return;
      }

      const existing = parseWorkspaceMemberLinkedinProfile(
        profile.linkedinProfile,
      );
      const merged = mergeWorkspaceMemberLinkedinProfile(existing, patch);

      await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateWorkspaceMemberLinkedinProfile,
        {
          idToUpdate: profile.id,
          linkedinProfile: merged,
        },
        authToken,
      );

      this.logger.log(
        `Saved linkedinProfile for workspace member ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to save linkedinProfile for workspace member ${workspaceMemberId}:`,
        error,
      );
    }
  }

  async getWorkspaceMemberProfileUnipileFields(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<WorkspaceMemberProfileUnipileFields | null> {
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      return parseWorkspaceMemberProfileUnipileFields(profile);
    } catch (error) {
      this.logger.warn(
        `Failed to load Unipile profile fields for workspace member ${workspaceMemberId}:`,
        error,
      );
      return null;
    }
  }

  async getWorkspaceMemberUnipileAccountId(
    workspaceMemberId: string | null,
    _workspaceId: string,
    authToken: string,
    type: UnipileAccountType,
  ): Promise<string | null> {
    const fieldName = workspaceMemberProfileUnipileAccountFieldName(type);

    try {
      if (!workspaceMemberId) {
        return null;
      }

      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );
      const profileAccountId = profile?.[fieldName];

      if (profileAccountId && String(profileAccountId).trim()) {
        return String(profileAccountId).trim();
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to get ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );

      return null;
    }
  }

  /**
   * Check if workspace member has keepLinkedinConnected flag set.
   */
  async getKeepLinkedinConnected(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<boolean> {
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      return Boolean(profile?.keepLinkedinConnected);
    } catch {
      return false;
    }
  }

  /**
   * Update workspace member profile with Unipile account ID.
   * First finds the profile by workspaceMemberId, then updates it.
   */
  async updateWorkspaceMemberUnipileAccountId(
    workspaceMemberId: string,
    authToken: string,
    type: UnipileAccountType,
    accountId: string,
  ): Promise<void> {
    const fieldName = workspaceMemberProfileUnipileAccountFieldName(type);

    if (!accountId?.trim()) {
      this.logger.warn(
        `Refusing to write empty ${fieldName} for workspace member ${workspaceMemberId} — accountId was "${accountId}"`,
      );
      return;
    }

    const trimmedAccountId = accountId.trim();

    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile found for ${workspaceMemberId}, cannot update ${fieldName}`,
        );

        return;
      }

      const existingValue = profile[fieldName];
      if (existingValue?.trim() && existingValue.trim() === trimmedAccountId) {
        this.logger.log(
          `${fieldName} already set to "${trimmedAccountId}" for workspace member ${workspaceMemberId}, skipping write`,
        );
        return;
      }

      await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profile.id,
          input: { [fieldName]: trimmedAccountId },
        },
        authToken,
      );

      try {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);

        await this.workspaceQueryService.upsertUnipileMemberAccountMapping(
          workspaceMemberId,
          workspaceId,
          trimmedAccountId,
          type === 'linkedin' ? 'LINKEDIN' : 'WHATSAPP',
        );
      } catch (mappingError) {
        this.logger.warn(
          `Failed to sync metadata.unipile_accounts for ${workspaceMemberId}:`,
          mappingError,
        );
      }

      this.logger.log(
        `Updated ${fieldName} to "${trimmedAccountId}" for workspace member ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Persist Unipile account id on the workspace member profile, then sync linkedinUrl / phoneNumber
   * from the same account payload (GET /api/v1/accounts/:id or list item).
   */
  async applyUnipileAccountToWorkspaceMemberProfile(
    workspaceMemberId: string,
    authToken: string,
    type: UnipileAccountType,
    accountId: string,
    accountPayload: unknown,
  ): Promise<void> {
    await this.updateWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      authToken,
      type,
      accountId,
    );
    await this.syncContactFieldsFromUnipileAccountPayload(
      workspaceMemberId,
      authToken,
      type,
      accountPayload,
    );
  }

  /**
   * Persists linkedin.com/in/... from the browser extension (Voyager /me or profile tab URL)
   * so Unipile duplicate checks use the member slug, not generic /feed/ page_url.
   */
  async updateWorkspaceMemberLinkedinUrlFromExtensionIfValid(
    workspaceMemberId: string,
    authToken: string,
    rawUrl: string | undefined,
  ): Promise<void> {
    const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!trimmed) {
      return;
    }
    const slug = extractLinkedinSlugFromUrl(trimmed);
    if (!slug) {
      this.logger.warn(
        `Extension linkedin_profile_url ignored (could not parse slug): ${trimmed.slice(0, 120)}`,
      );
      return;
    }
    const normalized = `https://www.linkedin.com/in/${slug}`;

    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile for ${workspaceMemberId}, cannot set linkedinUrl from extension`,
        );
        return;
      }

      const existing = profile.linkedinUrl?.trim();
      if (existing === normalized) {
        return;
      }

      await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profile.id,
          input: {
            [WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinUrl]: normalized,
          },
        },
        authToken,
      );

      this.logger.log(
        `Updated linkedinUrl from extension for workspace member ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist extension linkedinUrl for ${workspaceMemberId}:`,
        error,
      );
    }
  }

  async syncContactFieldsFromUnipileAccountPayload(
    workspaceMemberId: string,
    authToken: string,
    type: UnipileAccountType,
    accountPayload: unknown,
  ): Promise<void> {
    const linkedinUrl =
      type === 'linkedin'
        ? extractLinkedinProfileUrlFromUnipileAccount(accountPayload)
        : null;
    const phoneNumber =
      type === 'whatsapp'
        ? extractWhatsappPhoneFromUnipileAccount(accountPayload)
        : null;

    if (!linkedinUrl && !phoneNumber) {
      return;
    }

    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile found for ${workspaceMemberId}, cannot sync contact fields`,
        );

        return;
      }

      const input: Record<string, string> = {};

      if (linkedinUrl) {
        input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinUrl] = linkedinUrl;
      }
      if (phoneNumber) {
        input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.phoneNumber] = phoneNumber;
      }

      await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profile.id,
          input,
        },
        authToken,
      );

      this.logger.log(
        `Synced workspace member profile contact fields for ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to sync contact fields for workspace member ${workspaceMemberId}:`,
        error,
      );
    }
  }

  /**
   * Clear Unipile account ID from workspace member profile (e.g. on disconnect).
   */
  async clearWorkspaceMemberUnipileAccountId(
    workspaceMemberId: string,
    authToken: string,
    type: UnipileAccountType,
  ): Promise<void> {
    const fieldName = workspaceMemberProfileUnipileAccountFieldName(type);

    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );

      if (!profile?.id) {
        return;
      }

      const previousAccountId = profile[fieldName];
      if (!previousAccountId?.trim()) {
        return;
      }

      this.logger.log(
        `Clearing ${fieldName} from workspace member profile workspaceMemberId=${workspaceMemberId} previousAccountId=${previousAccountId.trim()}`,
      );

      const updateResponse = await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profile.id,
          input: { [fieldName]: '' },
        },
        authToken,
      );

      const graphqlErrors = updateResponse?.data?.errors as
        | Array<{ message?: string }>
        | undefined;
      if (graphqlErrors?.length) {
        throw new Error(
          graphqlErrors
            .map((error) => error.message ?? 'Unknown GraphQL error')
            .join('; '),
        );
      }

      await this.workspaceQueryService.deleteUnipileMemberAccountMapping(
        workspaceMemberId,
        type === 'linkedin' ? 'LINKEDIN' : 'WHATSAPP',
      );

      this.logger.log(
        `Cleared ${fieldName} and Unipile member account mapping for workspaceMemberId=${workspaceMemberId}${previousAccountId ? ` accountId=${previousAccountId}` : ''}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to clear ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
    }
  }
}
