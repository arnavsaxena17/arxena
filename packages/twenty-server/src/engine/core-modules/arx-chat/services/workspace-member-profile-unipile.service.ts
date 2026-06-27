import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import {
  extractLinkedinSlugFromUrl,
  extractWorkspaceMemberProfileNode,
  findWorkspaceMemberLinkedinProfile,
  findWorkspaceMemberProfileLinkedinCookies,
  findWorkspaceMemberProfiles,
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

export const WORKSPACE_MEMBER_PROFILE_MISSING_FOR_AUTH_TOKEN_MESSAGE =
  'Auth token is invalid: no workspace member profile exists for this session';

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
    this.logger.log(`APP_SECRET in GET LINKEDIN COOKIE ENCRYPTION KEY: ${secret}`);
    if (!secret) {
      this.logger.warn('No APP_SECRET found, returning null');
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
    this.logger.log(`From DB LinkedIn cookie token: ${value}`);
    if (value == null || value.trim() === '') {
      return null;
    }

    const decrypted = this.decryptLinkedinCookieToken(value);
    this.logger.log(`Decrypted LinkedIn cookie token: ${decrypted}`);
    return decrypted;
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
    this.logger.log(`Finding profile node by workspace member id: ${workspaceMemberId}`);
    const response = await this.staticGraphQLService.executeGraphQL(
      findWorkspaceMemberProfiles,
      workspaceMemberProfileFilterByMemberId(workspaceMemberId),
      authToken,
    );
    this.logger.log(`Response in FIND PROFILE NODE BY WORKSPACE MEMBER ID: ${JSON.stringify(response, null, 2)}`);
    return extractWorkspaceMemberProfileNode(response);
  }

  private async findProfileCookieNodeByWorkspaceMemberId(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<WorkspaceMemberProfileGraphqlNode | null> {
    this.logger.log(`Finding profile cookie node by workspace member id: ${workspaceMemberId}`);
    const response = await this.staticGraphQLService.executeGraphQL(
      findWorkspaceMemberProfileLinkedinCookies,
      workspaceMemberProfileFilterByMemberId(workspaceMemberId),
      authToken,
    );
    this.logger.log(`Response in FIND PROFILE COOKIE NODE BY WORKSPACE MEMBER ID: ${JSON.stringify(response, null, 2)}`);
    return extractWorkspaceMemberProfileNode(response);
  }

  private async requireProfileIdForMember(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<string> {
    this.logger.log(`Requiring profile id for member: ${workspaceMemberId}`);
    const existing = await this.findProfileNodeByWorkspaceMemberId(
      workspaceMemberId,
      authToken,
    );
    this.logger.log(`Existing profile id in REQUIRE PROFILE ID FOR MEMBER: ${JSON.stringify(existing, null, 2)}`);
    if (existing?.id) {
      return existing.id;
    }

    this.logger.warn(
      `No workspace member profile for workspaceMemberId=${workspaceMemberId}; rejecting LinkedIn cookie update (invalid auth token)`,
    );

    throw new HttpException(
      {
        code: 'AUTH_TOKEN_INVALID',
        message: WORKSPACE_MEMBER_PROFILE_MISSING_FOR_AUTH_TOKEN_MESSAGE,
      },
      HttpStatus.UNAUTHORIZED,
    );
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
    const profileId = await this.requireProfileIdForMember(
      workspaceMemberId,
      authToken,
    );

    this.logger.log(`Profile id in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${profileId}`);

    const input: Record<string, string> = {};

    if (tokens.linkedinLiAtToken !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinLiAtToken] =
        this.toDbLinkedinCookieToken(tokens.linkedinLiAtToken);
      this.logger.log(`Linkedin li at token in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinLiAtToken]}`);
    }

    if (tokens.linkedinLiAToken !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinLiAToken] =
        this.toDbLinkedinCookieToken(tokens.linkedinLiAToken);
      this.logger.log(`Linkedin li a token in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinLiAToken]}`);
    }

    if (tokens.linkedinUserAgent !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinUserAgent] =
        tokens.linkedinUserAgent ?? '';
      this.logger.log(`Linkedin user agent in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinUserAgent]}`);
    }

    if (tokens.linkedinIp !== undefined) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinIp] =
        tokens.linkedinIp ?? '';
      this.logger.log(`Linkedin ip in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinIp]}`);
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
      this.logger.log(`Linkedin country in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCountry]}`);
    }

    if (options?.touchLastSyncedAt) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCookiesLastSyncedAt] =
        new Date().toISOString();
      this.logger.log(`Linkedin cookies last synced at in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCookiesLastSyncedAt]}`);
    }

    if (options?.touchLastValidatedAt) {
      input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCookiesValidatedAt] =
        new Date().toISOString();
      this.logger.log(`Linkedin cookies validated at in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${input[WORKSPACE_MEMBER_PROFILE_FIELD_NAMES.linkedinCookiesValidatedAt]}`);
    }

    if (Object.keys(input).length === 0) {
      this.logger.log(`No input in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS`);
      return;
    }

    this.logger.log(
      `[updateLinkedinCookieTokens] Updating workspaceMemberId=${workspaceMemberId} fields=${Object.keys(input).join(', ')}`,
    );
    this.logger.log(`Updating workspace member id fields in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${Object.keys(input).join(', ')}`);
    await this.staticGraphQLService.executeGraphQL(
      graphQLToUpdateWorkspaceMemberLinkedinCookieTokens,
      {
        idToUpdate: profileId,
        input,
      },
      authToken,
    );
    this.logger.log(`UPDATE complete for workspace member id in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS`);   
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
      this.logger.log(`Profile cookie node in GET WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${JSON.stringify(profile, null, 2)}`);

      const tokens = parseWorkspaceMemberLinkedinCookieTokensFromGraphql(profile, {
        decryptToken: (value) => this.fromDbLinkedinCookieToken(value),
        normalizeCountry: (value) =>
          normalizeLinkedinConnectionCountry(value) ?? null,
      });
      this.logger.log(`Tokens in GET WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${JSON.stringify(tokens, null, 2)}`);
      return tokens;
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
    this.logger.log(`Clearing workspace member linkedin cookie tokens for workspace member id: ${workspaceMemberId}`);
    this.logger.log(`Auth token in CLEAR WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${authToken}`);
    this.logger.log(`Updating workspace member linkedin cookie tokens in CLEAR WORKSPACE MEMBER LINKEDIN COOKIE TOKENS`);
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
      this.logger.log(`Getting workspace member linkedin profile for workspace member id: ${workspaceMemberId}`);
      this.logger.log(`Auth token in GET WORKSPACE MEMBER LINKEDIN PROFILE: ${authToken}`);
      this.logger.log(`Executing graphql to find workspace member linkedin profile in GET WORKSPACE MEMBER LINKEDIN PROFILE`);
      const response = await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberLinkedinProfile,
        workspaceMemberProfileFilterByMemberId(workspaceMemberId),
        authToken,
      );
      this.logger.log(`Response in GET WORKSPACE MEMBER LINKEDIN PROFILE: ${JSON.stringify(response, null, 2)}`);
      const profile = extractWorkspaceMemberProfileNode(response);
      this.logger.log(`Profile in GET WORKSPACE MEMBER LINKEDIN PROFILE: ${JSON.stringify(profile, null, 2)}`);
      if (!profile?.id) {
        return null;
      }
      this.logger.log(`Profile id in GET WORKSPACE MEMBER LINKEDIN PROFILE: ${profile.id}`);
      return parseWorkspaceMemberLinkedinProfile(profile.linkedinProfile);
    } catch (error) {
      this.logger.warn(
        `Failed to load LinkedIn profile for workspace member ${workspaceMemberId}:`,
        error,
      );
      this.logger.log(`Failed to load LinkedIn profile for workspace member ${workspaceMemberId} in GET WORKSPACE MEMBER LINKEDIN PROFILE`);
      this.logger.log(`Error in GET WORKSPACE MEMBER LINKEDIN PROFILE: ${JSON.stringify(error, null, 2)}`);
      return null;
    }
  }

  async saveWorkspaceMemberLinkedinProfile(
    workspaceMemberId: string,
    authToken: string,
    patch: WorkspaceMemberLinkedinProfileStorage,
  ): Promise<void> {
    this.logger.log(`Saving workspace member linkedin profile for workspace member id: ${workspaceMemberId}`);
    this.logger.log(`Auth token in SAVE WORKSPACE MEMBER LINKEDIN PROFILE: ${authToken}`);
    this.logger.log(`Patch in SAVE WORKSPACE MEMBER LINKEDIN PROFILE: ${JSON.stringify(patch, null, 2)}`);
    this.logger.log(`Executing graphql to save workspace member linkedin profile in SAVE WORKSPACE MEMBER LINKEDIN PROFILE`);
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );
      this.logger.log(`Profile in SAVE WORKSPACE MEMBER LINKEDIN PROFILE: ${JSON.stringify(profile, null, 2)}`);  
      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile for ${workspaceMemberId}, cannot save linkedinProfile`,
        );
        return;
      }
      this.logger.log(`Profile id in SAVE WORKSPACE MEMBER LINKEDIN PROFILE: ${profile.id}`);
      const existing = parseWorkspaceMemberLinkedinProfile(
        profile.linkedinProfile,
      );
      const merged = mergeWorkspaceMemberLinkedinProfile(existing, patch);
      this.logger.log(`Merged in SAVE WORKSPACE MEMBER LINKEDIN PROFILE: ${JSON.stringify(merged, null, 2)}`);
      await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateWorkspaceMemberLinkedinProfile,
        {
          idToUpdate: profile.id,
          linkedinProfile: merged,
        },
        authToken,
      );
      this.logger.log(`Saved linkedinProfile for workspace member ${workspaceMemberId} in SAVE WORKSPACE MEMBER LINKEDIN PROFILE`);
      this.logger.log(
        `Saved linkedinProfile for workspace member ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to save linkedinProfile for workspace member ${workspaceMemberId}:`,
        error,
      );
      this.logger.log(`Failed to save linkedinProfile for workspace member ${workspaceMemberId} in SAVE WORKSPACE MEMBER LINKEDIN PROFILE`);
      this.logger.log(`Error in SAVE WORKSPACE MEMBER LINKEDIN PROFILE: ${JSON.stringify(error, null, 2)}`);
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
      this.logger.log(`Profile in GET WORKSPACE MEMBER PROFILE UNIPILE FIELDS: ${JSON.stringify(profile, null, 2)}`);   
      this.logger.log(`Parsing workspace member profile unipile fields in GET WORKSPACE MEMBER PROFILE UNIPILE FIELDS`);
      return parseWorkspaceMemberProfileUnipileFields(profile);
    } catch (error) {
      this.logger.warn(
        `Failed to load Unipile profile fields for workspace member ${workspaceMemberId}:`,
        error,
      );
      this.logger.log(`Failed to load Unipile profile fields for workspace member ${workspaceMemberId} in GET WORKSPACE MEMBER PROFILE UNIPILE FIELDS`);
      this.logger.log(`Error in GET WORKSPACE MEMBER PROFILE UNIPILE FIELDS: ${JSON.stringify(error, null, 2)}`);
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
    this.logger.log(`Field name in GET WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${fieldName}`);
    try {
      if (!workspaceMemberId) {
        return null;
      }
      this.logger.log(`Workspace member id in GET WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${workspaceMemberId}`);  
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );
      this.logger.log(`Profile in GET WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(profile, null, 2)}`);
      const profileAccountId = profile?.[fieldName];
      this.logger.log(`Profile account id in GET WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${profileAccountId}`);

      if (profileAccountId && String(profileAccountId).trim()) {
        return String(profileAccountId).trim();
      }
      this.logger.log(`Profile account id not found in GET WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to get ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
      this.logger.log(`Failed to get ${fieldName} for workspace member ${workspaceMemberId} in GET WORKSPACE MEMBER UNIPILE ACCOUNT ID`); 
      this.logger.log(`Error in GET WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(error, null, 2)}`);
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
    this.logger.log(`Getting keep linkedin connected for workspace member ${workspaceMemberId}`);
    this.logger.log(`Auth token in GET KEEP LINKEDIN CONNECTED: ${authToken}`);
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );
      this.logger.log(`Profile in GET KEEP LINKEDIN CONNECTED: ${JSON.stringify(profile, null, 2)}`);
      return Boolean(profile?.keepLinkedinConnected);
    } catch (error) {
      this.logger.warn(
        `Failed to get keep linkedin connected for workspace member ${workspaceMemberId}:`,
        error,
      );
      this.logger.log(`Failed to get keep linkedin connected for workspace member ${workspaceMemberId} in GET KEEP LINKEDIN CONNECTED`);
      this.logger.log(`Error in GET KEEP LINKEDIN CONNECTED: ${JSON.stringify(error, null, 2)}`);
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
    this.logger.log(`Updating workspace member unipile account id for workspace member ${workspaceMemberId}`);
    this.logger.log(`Auth token in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${authToken}`);
    this.logger.log(`Type in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${type}`);
    this.logger.log(`Account id in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${accountId}`);
    const fieldName = workspaceMemberProfileUnipileAccountFieldName(type);
    this.logger.log(`Field name in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${fieldName}`);
    if (!accountId?.trim()) {
      this.logger.warn(
        `Refusing to write empty ${fieldName} for workspace member ${workspaceMemberId} — accountId was "${accountId}"`,
      );
      this.logger.log(`Refusing to write empty ${fieldName} for workspace member ${workspaceMemberId} — accountId was "${accountId}" in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
      return;
    }

    const trimmedAccountId = accountId.trim();
    this.logger.log(`Trimmed account id in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${trimmedAccountId}`);
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );
      this.logger.log(`Profile in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(profile, null, 2)}`);
      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile found for ${workspaceMemberId}, cannot update ${fieldName}`,
        );

        this.logger.log(`No workspace member profile found for ${workspaceMemberId}, cannot update ${fieldName} in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
        return;
      }

      const existingValue = profile[fieldName];
      this.logger.log(`Existing value in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(existingValue, null, 2)}`);
      if (existingValue?.trim() && existingValue.trim() === trimmedAccountId) {
        this.logger.log(
          `${fieldName} already set to "${trimmedAccountId}" for workspace member ${workspaceMemberId}, skipping write`,
        );
        this.logger.log(`${fieldName} already set to "${trimmedAccountId}" for workspace member ${workspaceMemberId}, skipping write in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
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
      this.logger.log(`Updated ${fieldName} to "${trimmedAccountId}" for workspace member ${workspaceMemberId} in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
      try {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);
        this.logger.log(`Workspace id in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${workspaceId}`);
        await this.workspaceQueryService.upsertUnipileMemberAccountMapping(
          workspaceMemberId,
          workspaceId,
          trimmedAccountId,
          type === 'linkedin' ? 'LINKEDIN' : 'WHATSAPP',
        );
        this.logger.log(`Unipile member account mapping upserted in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
      } catch (mappingError) {
        this.logger.warn(
          `Failed to sync metadata.unipile_accounts for ${workspaceMemberId}:`,
          mappingError,
        );
        this.logger.log(`Failed to sync metadata.unipile_accounts for ${workspaceMemberId} in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
        this.logger.log(`Error in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(mappingError, null, 2)}`);
      }

      this.logger.log(
        `Updated ${fieldName} to "${trimmedAccountId}" for workspace member ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
      this.logger.log(`Failed to update ${fieldName} for workspace member ${workspaceMemberId} in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID`);
      this.logger.log(`Error in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(error, null, 2)}`);
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
    this.logger.log(`Applying unipile account to workspace member profile for workspace member ${workspaceMemberId}`);
    this.logger.log(`Auth token in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${authToken}`);
    this.logger.log(`Type in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${type}`);
    this.logger.log(`Account id in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${accountId}`);
    this.logger.log(`Account payload in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${JSON.stringify(accountPayload, null, 2)}`);
    await this.updateWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      authToken,
      type,
      accountId,
    );
    this.logger.log(`Syncing contact fields from unipile account payload in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE`);
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
    this.logger.log(`Syncing contact fields from unipile account payload for workspace member ${workspaceMemberId}`);
    this.logger.log(`Auth token in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD: ${authToken}`);
    this.logger.log(`Type in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD: ${type}`);
    this.logger.log(`Account payload in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD: ${JSON.stringify(accountPayload, null, 2)}`);
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
      this.logger.log(`Profile in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD: ${JSON.stringify(profile, null, 2)}`);
      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile found for ${workspaceMemberId}, cannot sync contact fields`,
        );
        this.logger.log(`No workspace member profile found for ${workspaceMemberId}, cannot sync contact fields in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD`);
        return;
      }

      const input: Record<string, string> = {};
      this.logger.log(`Input in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD: ${JSON.stringify(input, null, 2)}`);
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
      this.logger.log(`Synced workspace member profile contact fields for ${workspaceMemberId} in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD`);
      this.logger.log(
        `Synced workspace member profile contact fields for ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to sync contact fields for workspace member ${workspaceMemberId}:`,
        error,
      );
      this.logger.log(`Failed to sync contact fields for workspace member ${workspaceMemberId} in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD`);
      this.logger.log(`Error in SYNC CONTACT FIELDS FROM UNIPILE ACCOUNT PAYLOAD: ${JSON.stringify(error, null, 2)}`);
    }
  }

  /**
   * Clear stored LinkedIn Unipile account id and cached linkedinProfile JSON.
   */
  async clearWorkspaceMemberLinkedinUnipileData(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<void> {
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );
      if (!profile?.id) {
        return;
      }

      const previousAccountId = profile.linkedinUnipileAccountId?.trim() ?? '';
      const hasLinkedinProfile =
        parseWorkspaceMemberLinkedinProfile(profile.linkedinProfile) != null;

      if (!previousAccountId && !hasLinkedinProfile) {
        return;
      }

      this.logger.log(
        `Clearing linkedinUnipileAccountId and linkedinProfile from workspace member profile workspaceMemberId=${workspaceMemberId}${previousAccountId ? ` previousAccountId=${previousAccountId}` : ''}`,
      );

      const updateResponse = await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profile.id,
          input: {
            linkedinUnipileAccountId: '',
            linkedinProfile: null,
          },
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
        'LINKEDIN',
      );
      this.logger.log(
        `Cleared linkedinUnipileAccountId, linkedinProfile, and Unipile member account mapping for workspaceMemberId=${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to clear LinkedIn Unipile data for workspace member ${workspaceMemberId}:`,
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
    this.logger.log(`Field name in CLEAR WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${fieldName}`);
    try {
      const profile = await this.findProfileNodeByWorkspaceMemberId(
        workspaceMemberId,
        authToken,
      );
      this.logger.log(`Profile in CLEAR WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(profile, null, 2)}`);
      if (!profile?.id) {
        return;
      }
      this.logger.log(`Previous account id in CLEAR WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(profile[fieldName], null, 2)}`);
      const previousAccountId = profile[fieldName];
      if (!previousAccountId?.trim()) {
        return;
      }
      this.logger.log(`Previous account id in CLEAR WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${previousAccountId.trim()}`);
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
      this.logger.log(`Update response in CLEAR WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${JSON.stringify(updateResponse, null, 2)}`);
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
      this.logger.log(`Unipile member account mapping deleted in CLEAR WORKSPACE MEMBER UNIPILE ACCOUNT ID`); 
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
