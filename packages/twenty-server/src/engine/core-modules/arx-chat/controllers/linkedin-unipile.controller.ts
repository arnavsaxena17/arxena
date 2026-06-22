import {
  Body,
  Controller,
  Delete,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import {
  findLinkedinUnipileAccountSameIdentityForProfile,
  isUnipileConnectedStatus,
  linkedinBrowserUrlMatchesMemberProfile,
  normalizeUnipileStatus,
  shouldBlockNewUnipileConnectionForStatus,
  type LinkedInSearchType,
  type UnipileLinkedinAccount,
} from 'twenty-shared';

import { lookupCountryByIp } from 'twenty-shared';
import { LinkedinUnipileMemberAccountResolverService } from '../services/linkedin-unipile-member-account-resolver.service';
import { LinkedinUnipileRequestService } from '../services/linkedin-unipile-request.service';
import { LinkedinUnipileMessagingService } from '../services/linkedin-unipile/linkedin-unipile-messaging.service';
import { MemberLinkedinUnipileConnectionService } from '../services/member-linkedin-unipile-connection.service';
import { UnipileAccountPoolService } from '../services/unipile-account-pool.service';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import { WorkspaceMemberProfileUnipileService } from '../services/workspace-member-profile-unipile.service';
import type {
  CreateWebhookDto,
  UnipileAccountStatusWebhook,
} from '../types/unipile-webhook.types';
import {
  buildUnipileLinkedinCookieConnectBody,
  normalizeLinkedinConnectionCountry,
  normalizeLinkedinConnectionIp,
} from '../utils/build-unipile-linkedin-cookie-connect-body.util';
import { resolveLinkedinSyncClientIp } from '../utils/resolve-linkedin-sync-client-ip.util';

// DTOs for LinkedIn Unipile integration
interface LinkedinCredentialsDto {
  username: string;
  password: string;
}

interface LinkedinCookieAuthDto {
  access_token: string;
  user_agent?: string;
  premium_token?: string;
  ip?: string;
  country?: string;
}

interface LinkedinExtensionCookieSyncDto {
  li_at?: string;
  li_a?: string;
  user_agent?: string;
  page_url?: string;
  /** Public IPv4 resolved by the Chrome extension (fallback when server sees localhost). */
  client_ip?: string;
  /** ISO 3166-1 alpha-2 country from the extension ipinfo lookup. */
  client_country?: string;
  /** Canonical profile URL from the extension (Voyager /me or /in/... tab), not feed/messaging. */
  linkedin_profile_url?: string;
}

/** Optional body for server-side reconnect using only DB-stored LinkedIn session fields. */
interface LinkedinReconnectFromStoredProfileDto {
  user_agent?: string;
  /** Optional fresh public IP when stored linkedinIp is missing (e.g. from client ipinfo). */
  client_ip?: string;
  /** Optional ISO 3166-1 alpha-2 country when stored linkedinCountry is missing. */
  client_country?: string;
}

interface LinkedinCheckpointDto {
  account_id: string;
  provider: 'LINKEDIN';
  code: string;
}

interface HostedAuthDto {
  type?: 'create' | 'reconnect';
  providers?: string[] | '*';
  expiresOn?: string;
  api_url?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  notify_url?: string;
  name?: string; // Internal user ID for matching
  reconnect_account?: string; // For reconnection flow
}

interface LinkedinProfileDto {
  account_id: string;
  identifier: string;
  linkedin_sections?: string[];
  notify?: boolean;
}

interface LinkedinUserPostsDto {
  account_id: string;
  identifier: string; // LinkedIn provider_id (e.g. ACoAAASFnFQBOtdZfH_3bd-W2StePCg1aZFPp2g)
  limit?: number;
  cursor?: string;
  is_company?: boolean;
}

interface LinkedinUserCommentsDto {
  account_id: string;
  identifier: string;
  limit?: number;
  cursor?: string;
}

/**
 * Combined profile overview DTO.
 * NOTE: Unipile does NOT expose a standalone "activity" endpoint for LinkedIn.
 * The only activity-adjacent data available is:
 *   - Posts authored by the user (GET /api/v1/users/{identifier}/posts)
 *   - "recruiting_activity" profile section — requires LinkedIn Recruiter subscription
 * This endpoint fetches profile + posts in parallel and surfaces recruiting_activity
 * inside the profile if include_recruiting_activity is true and the account has Recruiter.
 */
interface LinkedinProfileOverviewDto {
  account_id: string;
  identifier: string; // public slug (e.g. "arpande") OR provider_id
  posts_limit?: number;          // how many recent posts to fetch (default 10)
  include_recruiting_activity?: boolean; // fetch recruiting_activity section (Recruiter only)
  linkedin_sections?: string[];  // additional profile sections to fetch
  notify?: boolean;
}

interface LinkedinMessageDto {
  account_id: string;
  attendees_ids: string[];
  text: string;
  attachments?: any[];
  voice_message?: any;
  video_message?: any;
  subject?: string;
  options?: {
    linkedin?: {
      api?: 'classic' | 'recruiter' | 'sales_navigator';
      inmail?: boolean;
    };
  };
}

interface LinkedinInvitationDto {
  account_id: string;
  provider_id: string;
  message: string;
}

interface LinkedinAttachmentDto {
  account_id: string;
  attendees_ids: string[];
  text: string;
  file: any;
  filename: string;
  mimetype: string;
}

type LinkedinUnipileStatusHttpResult = {
  status: number;
  data: Record<string, unknown> & {
    object?: string;
    account_id?: string;
    id?: string;
    checkpoint?: { type?: string };
    status?: string;
    profile_data?: unknown;
  };
};

@Controller('linkedin-unipile')
@UseGuards(JwtAuthGuard)
export class LinkedinUnipileController {
  private readonly logger = new Logger(LinkedinUnipileController.name);

  // Unipile configuration - These come from environment variables with fallbacks
  private readonly unipileApiUrl = process.env.UNIPILE_API_URL;
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN;

  constructor(
    private readonly webhookService: UnipileWebhookService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly environmentService: EnvironmentService,
    private readonly unipileAccountPoolService: UnipileAccountPoolService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly memberLinkedinUnipileConnectionService: MemberLinkedinUnipileConnectionService,
    private readonly linkedinUnipileMemberAccountResolverService: LinkedinUnipileMemberAccountResolverService,
  ) {
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(`Unipile Access Token configured: ${!!this.unipileAccessToken}`);
  }

  /**
   * Before POST /accounts for LinkedIn: uses Unipile's full accounts list + workspace member profile
   * (URL slug, stored Unipile id) to detect the same identity. If already connected, skip a new connection.
   * If a non-disconnected in-flight session exists, return 409.
   */
  private async resolveLinkedinConnectPreflight(
    workspaceMemberId: string | undefined,
    authToken: string,
  ): Promise<
    | { proceed: true }
    | {
        proceed: false;
        alreadyConnected: true;
        account: UnipileLinkedinAccount;
      }
  > {
    if (!workspaceMemberId || !authToken) {
      return { proceed: true };
    }
    const profile =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
        workspaceMemberId,
        authToken,
      );
    const { accounts } =
      await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();
    const match = findLinkedinUnipileAccountSameIdentityForProfile(
      accounts as UnipileLinkedinAccount[],
      profile,
    );
    if (!match) {
      return { proceed: true };
    }
    if (isUnipileConnectedStatus(match.status)) {
      try {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'linkedin',
          match.id,
          match,
        );
      } catch (err) {
        this.logger.warn(
          `Could not sync existing LinkedIn Unipile account to workspace member profile: ${err instanceof Error ? err.message : err}`,
        );
      }
      return { proceed: false, alreadyConnected: true, account: match };
    }
    if (shouldBlockNewUnipileConnectionForStatus(match.status)) {
      throw new HttpException(
        {
          message:
            'A LinkedIn connection is already in progress for this profile. Wait for it to finish or disconnect it before retrying.',
          existing_account_id: match.id,
        },
        HttpStatus.CONFLICT,
      );
    }
    return { proceed: true };
  }

  private async finalizeMemberLinkedinUnipileSync(
    workspaceMemberId: string,
    authToken: string,
    preferredAccountId: string | null | undefined,
  ): Promise<string | null> {
    const profile =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
        workspaceMemberId,
        authToken,
      );
    if (!profile) {
      return preferredAccountId?.trim() ? preferredAccountId.trim() : null;
    }

    const keepId =
      await this.memberLinkedinUnipileConnectionService.pruneDuplicateLinkedinAccountsForProfile(
        profile,
        preferredAccountId,
      );
    if (!keepId) {
      return preferredAccountId?.trim() ? preferredAccountId.trim() : null;
    }

    if (keepId !== profile.linkedinUnipileAccountId?.trim()) {
      const accountPayload =
        await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(keepId);
      if (accountPayload) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'linkedin',
          keepId,
          accountPayload,
        );
      } else {
        await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          authToken,
          'linkedin',
          keepId,
        );
      }
    }

    return keepId;
  }

  private isLinkedinUnipileOnDemandEnabled(): boolean {
    return this.environmentService.get('LINKEDIN_UNIPILE_ON_DEMAND');
  }

  private isValidateThenDisconnectEnabled(): boolean {
    return this.environmentService.get(
      'LINKEDIN_UNIPILE_VALIDATE_THEN_DISCONNECT',
    );
  }

  private normalizeOptionalExtensionString(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : undefined;
  }

  private resolveClientIpForLinkedinSync(
    request: Request & { workspaceMemberId?: string },
    extensionClientIp?: string,
  ): string | undefined {
    const serverIp = OrgChartClientIpService.extractClientIpFromRequest(request);

    return resolveLinkedinSyncClientIp({
      serverIp,
      extensionIp: extensionClientIp,
    });
  }

  private async resolveLinkedinSessionContextForConnect(args: {
    requestUserAgent?: string;
    requestIp?: string;
    storedUserAgent?: string | null;
    storedIp?: string | null;
    storedCountry?: string | null;
    fallbackIp?: string;
    fallbackCountry?: string;
  }): Promise<{
    userAgent?: string;
    ip?: string;
    country?: string;
  }> {
    const userAgent =
      this.normalizeOptionalExtensionString(args.requestUserAgent) ??
      this.normalizeOptionalExtensionString(args.storedUserAgent ?? undefined);

    const ip =
      normalizeLinkedinConnectionIp(
        this.normalizeOptionalExtensionString(args.requestIp) ??
          args.storedIp ??
          args.fallbackIp ??
          undefined,
      ) ?? undefined;

    if (!ip) {
      return { userAgent, ip: undefined, country: undefined };
    }

    const storedCountry =
      normalizeLinkedinConnectionCountry(args.storedCountry ?? undefined) ??
      undefined;
    const fallbackCountry =
      normalizeLinkedinConnectionCountry(args.fallbackCountry ?? undefined) ??
      undefined;
    const country =
      storedCountry ??
      fallbackCountry ??
      ((await lookupCountryByIp(ip)) ?? undefined);

    return { userAgent, ip, country };
  }

  private async buildLinkedinCapabilitiesForAccount(
    accountId: string | null | undefined,
    connected: boolean,
  ): Promise<{
    inferredSearchType?: LinkedInSearchType;
    salesNavigatorAvailable?: boolean;
    recruiterAvailable?: boolean;
  }> {
    const trimmed = typeof accountId === 'string' ? accountId.trim() : '';
    if (!trimmed || !connected) {
      return {};
    }

    const capabilities =
      await this.linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount(
        trimmed,
      );
    if (!capabilities) {
      return {};
    }

    return {
      inferredSearchType: capabilities.inferredSearchType,
      salesNavigatorAvailable: capabilities.salesNavigatorAvailable,
      recruiterAvailable: capabilities.recruiterAvailable,
    };
  }

  private async buildLinkedinSyncResponseFields(
    accountId: string | null | undefined,
    status: string,
    connected: boolean,
  ): Promise<{
    accountId: string | null | undefined;
    status: string;
    connected: boolean;
    inferredSearchType?: LinkedInSearchType;
    salesNavigatorAvailable?: boolean;
    recruiterAvailable?: boolean;
  }> {
    const capabilities = await this.buildLinkedinCapabilitiesForAccount(
      accountId,
      connected,
    );

    return {
      accountId,
      status,
      connected,
      ...capabilities,
    };
  }

  private async persistLinkedinCookiesForMember(
    workspace: Workspace,
    workspaceMemberId: string,
    authToken: string,
    params: {
      linkedin_profile_url?: string;
      li_at?: string;
      li_a?: string;
      user_agent?: string;
      clientIp?: string;
      clientCountry?: string;
      allowMissingBrowserLinkedinUrl?: boolean;
    },
  ): Promise<{
    cookiesChanged: boolean;
    storedCookies: Awaited<
      ReturnType<
        typeof this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens
      >
    >;
    profileLinkedinUrl: string | null;
  }> {
    const profile =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
        workspaceMemberId,
        authToken,
      );

    const browserMemberUrlMatch = linkedinBrowserUrlMatchesMemberProfile(
      profile?.linkedinUrl,
      params.linkedin_profile_url,
    );

    if (browserMemberUrlMatch === 'mismatch') {
      throw new HttpException(
        {
          code: 'LINKEDIN_IDENTITY_MISMATCH',
          message:
            'The LinkedIn account in this browser does not match your Arxena member profile.',
          expectedLinkedinUrl: profile?.linkedinUrl ?? null,
          browserLinkedinUrl: params.linkedin_profile_url ?? null,
        },
        HttpStatus.CONFLICT,
      );
    }

    if (
      browserMemberUrlMatch === 'no_browser_url' &&
      profile?.linkedinUrl?.trim() &&
      !params.allowMissingBrowserLinkedinUrl
    ) {
      throw new HttpException(
        {
          code: 'LINKEDIN_IDENTITY_UNKNOWN',
          message:
            'Could not verify the signed-in LinkedIn profile. Open LinkedIn in this browser and retry.',
          expectedLinkedinUrl: profile.linkedinUrl,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      params.linkedin_profile_url?.trim() &&
      (browserMemberUrlMatch === 'no_member_url' ||
        browserMemberUrlMatch === 'match')
    ) {
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinUrlFromExtensionIfValid(
        workspaceMemberId,
        authToken,
        params.linkedin_profile_url,
      );
    }

    const normalizeExtensionToken = (value?: string) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim();

      return trimmed ? trimmed : undefined;
    };

    const liAtToken = normalizeExtensionToken(params.li_at);
    const liAToken = normalizeExtensionToken(params.li_a);
    const requestUserAgent = normalizeExtensionToken(params.user_agent);
    const requestIp = normalizeLinkedinConnectionIp(params.clientIp);
    const requestCountry = normalizeLinkedinConnectionCountry(params.clientCountry);
    const storedCookiesBefore =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        authToken,
        workspaceMemberId,
      );

    const cookiesChanged =
      (liAtToken !== undefined &&
        liAtToken !== storedCookiesBefore.linkedinLiAtToken) ||
      (liAToken !== undefined &&
        liAToken !== storedCookiesBefore.linkedinLiAToken);

    const sessionContextChanged =
      (requestUserAgent !== undefined &&
        requestUserAgent !== storedCookiesBefore.linkedinUserAgent) ||
      (requestIp !== undefined && requestIp !== storedCookiesBefore.linkedinIp) ||
      (requestCountry !== undefined &&
        requestCountry !== storedCookiesBefore.linkedinCountry);

    const profileUpdates: Partial<{
      linkedinLiAtToken: string | null;
      linkedinLiAToken: string | null;
      linkedinUserAgent: string | null;
      linkedinIp: string | null;
      linkedinCountry: string | null;
    }> = {};

    if (liAtToken !== undefined) {
      profileUpdates.linkedinLiAtToken = liAtToken;
    }
    if (liAToken !== undefined) {
      profileUpdates.linkedinLiAToken = liAToken;
    }
    if (requestUserAgent !== undefined) {
      profileUpdates.linkedinUserAgent = requestUserAgent;
    }
    if (requestIp !== undefined) {
      profileUpdates.linkedinIp = requestIp;
    }
    if (requestCountry !== undefined) {
      profileUpdates.linkedinCountry = requestCountry ?? null;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens(
        authToken,
        workspaceMemberId,
        profileUpdates,
        { touchLastSyncedAt: true },
      );
    }

    const storedCookies =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        authToken,
        workspaceMemberId,
      );

    return {
      cookiesChanged: cookiesChanged || sessionContextChanged,
      storedCookies,
      profileLinkedinUrl: profile?.linkedinUrl?.trim()
        ? profile.linkedinUrl.trim()
        : null,
    };
  }

  /**
   * After a successful LinkedIn Unipile connection (non-checkpoint), persist account id,
   * linkedinUrl, and related fields on the current workspace member profile when JWT + member id are present.
   */
  private async syncWorkspaceMemberProfileAfterLinkedinConnectionIfEligible(
    accountId: string | null | undefined,
    request: { workspaceMemberId?: string; headers?: { authorization?: string } },
    workspaceId: string,
  ): Promise<void> {
    const trimmed = typeof accountId === 'string' ? accountId.trim() : '';

    if (!trimmed) {
      return;
    }
    const workspaceMemberId = request.workspaceMemberId;
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

    if (!workspaceMemberId || !authToken) {
      return;
    }

    let previousId: string | null = null;
    try {
      previousId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          workspaceId,
          authToken,
          'linkedin',
        );
    } catch {
      previousId = null;
    }

    try {
      const accountPayload = await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(trimmed);

      if (accountPayload) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'linkedin',
          trimmed,
          accountPayload,
        );
      } else {
        await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          authToken,
          'linkedin',
          trimmed,
        );
      }
      if (previousId && previousId !== trimmed) {
        this.logger.log(
          `Disconnecting superseded LinkedIn Unipile account after new connection: previousAccountId=${previousId} newAccountId=${trimmed} workspaceMemberId=${workspaceMemberId}`,
        );
        await this.linkedinUnipileRequestService.disconnectAccountBestEffort(
          previousId,
          'superseded LinkedIn Unipile account after new connection',
        );
      }
    } catch (err) {
      this.logger.warn(
        `Could not sync LinkedIn Unipile account to workspace member profile: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  @Post('connect/credentials')
  async connectWithCredentials(
    @Body() credentials: LinkedinCredentialsDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
    try {
      this.logger.log(`Connecting LinkedIn account for workspace: ${workspace.id}`);

      const authToken =
        request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
      const preflight = await this.resolveLinkedinConnectPreflight(
        request.workspaceMemberId,
        authToken,
      );
      if (!preflight.proceed) {
        const acc = preflight.account;
        return {
          success: true,
          alreadyConnected: true,
          message:
            'This LinkedIn profile is already connected to Unipile; not starting a new connection.',
          data: {
            account_id: acc.id,
            provider: 'LINKEDIN' as const,
            status: acc.status ?? 'connected',
            profile: acc.profile_data,
          },
        };
      }

      const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/accounts',
        'POST',
        {
          provider: 'LINKEDIN',
          username: credentials.username,
          password: credentials.password,
        },
        { returnStatus: true },
      )) as LinkedinUnipileStatusHttpResult;

      const { status, data } = result;

      this.logger.log(`Unipile connect/credentials response: status=${status}, object=${data?.object ?? 'none'}, account_id=${data?.account_id ?? 'none'}`);
      this.logger.log(`Unipile connect/credentials response: data=${JSON.stringify(data, null, 2)}`);

      // 202 = checkpoint per Unipile docs; also treat body as checkpoint if object is 'Checkpoint' (in case API returns 201)
      const isCheckpoint =
        (status === 202 && data?.account_id) ||
        (data?.object === 'Checkpoint' && data?.account_id);

      if (isCheckpoint) {
        this.logger.log(`LinkedIn checkpoint required (status=${status}): ${data?.checkpoint?.type ?? 'unknown'}`);
        return {
          success: true,
          data: {
            status: 'checkpoint_required',
            account_id: data.account_id,
            checkpoint_type: data?.checkpoint?.type ?? '2FA',
          },
        };
      }

      const connectedAccountId = data.id || data.account_id;

      await this.syncWorkspaceMemberProfileAfterLinkedinConnectionIfEligible(
        connectedAccountId,
        request,
        workspace.id,
      );

      return {
        success: true,
        data: {
          account_id: connectedAccountId,
          provider: 'LINKEDIN',
          status: data.status || 'connected',
          profile: data.profile_data,
        },
      };
    } catch (error) {
      this.logger.error('Failed to connect LinkedIn with credentials:', error);
      throw error;
    }
  }


  

  @Post('connect/cookie')
  async connectWithCookie(
    @Body() cookieAuth: LinkedinCookieAuthDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: Request & {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    try {
      this.logger.log(`Connecting LinkedIn account with cookie for workspace: ${workspace.id}`);

      const authTokenCookie =
        request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
      const workspaceMemberId = request.workspaceMemberId;
      const preflightCookie = await this.resolveLinkedinConnectPreflight(
        workspaceMemberId,
        authTokenCookie,
      );
      if (!preflightCookie.proceed) {
        const acc = preflightCookie.account;
        return {
          success: true,
          alreadyConnected: true,
          message:
            'This LinkedIn profile is already connected to Unipile; not starting a new connection.',
          data: {
            account_id: acc.id,
            provider: 'LINKEDIN' as const,
            status: acc.status ?? 'connected',
            profile: acc.profile_data,
          },
        };
      }

      let storedLinkedinIp: string | null | undefined;
      let storedLinkedinCountry: string | null | undefined;
      if (workspaceMemberId && authTokenCookie) {
        const storedCookies =
          await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
            authTokenCookie,
            workspaceMemberId,
          );
        storedLinkedinIp = storedCookies.linkedinIp;
        storedLinkedinCountry = storedCookies.linkedinCountry;
      }

      const normalizedIp =
        normalizeLinkedinConnectionIp(cookieAuth.ip) ??
        normalizeLinkedinConnectionIp(storedLinkedinIp ?? undefined) ??
        this.resolveClientIpForLinkedinSync(request);
      let connectCountry = normalizeLinkedinConnectionCountry(cookieAuth.country);
      if (!connectCountry) {
        connectCountry =
          normalizeLinkedinConnectionCountry(storedLinkedinCountry ?? undefined);
      }
      if (normalizedIp && !connectCountry) {
        connectCountry =
          (await lookupCountryByIp(normalizedIp)) ?? undefined;
      }

      const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/accounts',
        'POST',
        buildUnipileLinkedinCookieConnectBody({
          accessToken: cookieAuth.access_token,
          premiumToken: cookieAuth.premium_token,
          userAgent: cookieAuth.user_agent,
          ip: normalizedIp,
          country: connectCountry,
        }),
        { returnStatus: true },
      )) as LinkedinUnipileStatusHttpResult;

      const { status, data } = result;

      this.logger.log(`Unipile connect/cookie response: status=${status}, object=${data?.object ?? 'none'}, account_id=${data?.account_id ?? 'none'}`);

      const isCheckpoint =
        (status === 202 && data?.account_id) ||
        (data?.object === 'Checkpoint' && data?.account_id);

      if (isCheckpoint) {
        this.logger.log(`LinkedIn checkpoint required (status=${status}): ${data?.checkpoint?.type ?? 'unknown'}`);
        return {
          success: true,
          data: {
            status: 'checkpoint_required',
            account_id: data.account_id,
            checkpoint_type: data?.checkpoint?.type ?? '2FA',
          },
        };
      }

      const connectedAccountIdCookie = data.id || data.account_id;

      await this.syncWorkspaceMemberProfileAfterLinkedinConnectionIfEligible(
        connectedAccountIdCookie,
        request,
        workspace.id,
      );

      return {
        success: true,
        data: {
          account_id: connectedAccountIdCookie,
          provider: 'LINKEDIN',
          status: data.status || 'connected',
          profile: data.profile_data,
        },
      };
    } catch (error) {
      this.logger.error('Failed to connect LinkedIn with cookie:', error);
      throw error;
    }
  }

  /**
   * Shared LinkedIn Unipile sync for the authenticated workspace member: preflight, identity match,
   * optional POST /accounts reconnect using request cookies and/or DB `linkedinLiAtToken` / `linkedinLiAToken`.
   * When `persistRequestCookieTokens` is false, request `li_at` / `li_a` are ignored (server-side reconnect from DB only).
   */
  private async linkedinUnipileMemberSyncCore(
    workspace: Workspace,
    workspaceMemberId: string,
    authToken: string,
    request: Request & { workspaceMemberId?: string },
    params: {
      linkedin_profile_url?: string;
      li_at?: string;
      li_a?: string;
      user_agent?: string;
      clientIp?: string;
      clientCountry?: string;
      page_url?: string;
      persistRequestCookieTokens: boolean;
    },
  ) {
    const normalizeExtensionToken = (value?: string) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim();

      return trimmed ? trimmed : undefined;
    };

    const liAtToken = params.persistRequestCookieTokens
      ? normalizeExtensionToken(params.li_at)
      : undefined;
    const liAToken = params.persistRequestCookieTokens
      ? normalizeExtensionToken(params.li_a)
      : undefined;
    const requestUserAgent = params.persistRequestCookieTokens
      ? normalizeExtensionToken(params.user_agent)
      : undefined;
    const requestIp = params.persistRequestCookieTokens
      ? normalizeLinkedinConnectionIp(params.clientIp)
      : undefined;
    const requestCountry = params.persistRequestCookieTokens
      ? normalizeLinkedinConnectionCountry(params.clientCountry)
      : undefined;
    let cookiesChanged = false;
    let storedCookies =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        authToken,
        workspaceMemberId,
      );

    this.logger.log(
      `[syncCookies] workspaceMemberId=${workspaceMemberId} persistRequestCookieTokens=${params.persistRequestCookieTokens} ` +
      `li_at received=${params.li_at !== undefined} li_at length=${params.li_at?.length ?? 0} ` +
      `li_a received=${params.li_a !== undefined} li_a length=${params.li_a?.length ?? 0} ` +
      `user_agent=${requestUserAgent?.slice(0, 60) ?? 'none'} ip=${requestIp ?? 'none'} ` +
      `country=${requestCountry ?? 'none'} ` +
      `liAtToken defined=${liAtToken !== undefined} liAToken defined=${liAToken !== undefined}`,
    );

    if (
      params.persistRequestCookieTokens &&
      (liAtToken !== undefined ||
        liAToken !== undefined ||
        requestUserAgent !== undefined ||
        requestIp !== undefined ||
        requestCountry !== undefined)
    ) {
      const persistResult = await this.persistLinkedinCookiesForMember(
        workspace,
        workspaceMemberId,
        authToken,
        {
          linkedin_profile_url: params.linkedin_profile_url,
          li_at: params.li_at,
          li_a: params.li_a,
          user_agent: params.user_agent,
          clientIp: params.clientIp,
          clientCountry: params.clientCountry,
          allowMissingBrowserLinkedinUrl: !params.linkedin_profile_url?.trim(),
        },
      );
      cookiesChanged = persistResult.cookiesChanged;
      storedCookies = persistResult.storedCookies;
    } else if (!params.persistRequestCookieTokens) {
      this.logger.warn(
        `[syncCookies] Skipping DB cookie persist for workspaceMemberId=${workspaceMemberId}: ` +
        `persistRequestCookieTokens=${params.persistRequestCookieTokens}`,
      );
    }

    const sessionContext = await this.resolveLinkedinSessionContextForConnect({
      requestUserAgent: params.user_agent,
      requestIp: params.persistRequestCookieTokens ? params.clientIp : undefined,
      storedUserAgent: storedCookies.linkedinUserAgent,
      storedIp: storedCookies.linkedinIp,
      storedCountry: storedCookies.linkedinCountry,
      fallbackIp: !storedCookies.linkedinIp
        ? this.resolveClientIpForLinkedinSync(request, params.clientIp)
        : undefined,
      fallbackCountry: !storedCookies.linkedinCountry
        ? normalizeLinkedinConnectionCountry(params.clientCountry)
        : undefined,
    });

    // Preflight by LinkedIn identity (slug / stored unipile id) BEFORE POST /accounts.
    // This avoids creating duplicate Unipile accounts when the member's stored accountId is missing/stale.
    try {
      const preflight = await this.resolveLinkedinConnectPreflight(
        workspaceMemberId,
        authToken,
      );
      if (!preflight.proceed) {
        const acc = preflight.account;
        const finalizedId = await this.finalizeMemberLinkedinUnipileSync(
          workspaceMemberId,
          authToken,
          acc.id,
        );
        const accountId = finalizedId ?? acc.id;
        const storedCookiesAfterPreflight =
          await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
            authToken,
            workspaceMemberId,
          );
        const preflightConnected =
          isUnipileConnectedStatus(acc.status) ||
          normalizeUnipileStatus(acc.status) === 'pending';
        const linkedin = await this.buildLinkedinSyncResponseFields(
          accountId,
          acc.status ?? 'connected',
          preflightConnected,
        );
        return {
          success: true,
          cookies: {
            hasLiAt: Boolean(storedCookiesAfterPreflight.linkedinLiAtToken),
            hasLiA: Boolean(storedCookiesAfterPreflight.linkedinLiAToken),
            cookiesChanged,
            lastSyncedAt: storedCookiesAfterPreflight.linkedinCookiesLastSyncedAt,
            lastValidatedAt:
              storedCookiesAfterPreflight.linkedinCookiesValidatedAt,
          },
          linkedin,
          reconnect: {
            attempted: false,
            succeeded: false,
            message:
              'This LinkedIn profile is already connected to Unipile; not starting a new connection.',
          },
          context: {
            pageUrl: params.page_url ?? null,
            linkedinProfileUrlFromExtension: params.linkedin_profile_url ?? null,
          },
        };
      }
    } catch (err) {
      // Preserve existing behavior (continue best-effort) unless the preflight explicitly blocks with an HTTP error.
      if (err instanceof HttpException) {
        throw err;
      }
    }

    const effectiveLiAtToken = liAtToken ?? storedCookies.linkedinLiAtToken;
    const effectiveLiAToken = liAToken ?? storedCookies.linkedinLiAToken;
    const reconnectSourceToken = effectiveLiAtToken ?? effectiveLiAToken;

    const resolution =
      await this.linkedinUnipileMemberAccountResolverService.resolveMemberLinkedinUnipileAccount(
        {
          workspaceId: workspace.id,
          workspaceMemberId,
          authToken,
          reconnectSourceToken,
          premiumToken: effectiveLiAToken,
          userAgent: sessionContext.userAgent,
          ip: sessionContext.ip,
          country: sessionContext.country,
          cleanupContext: 'LinkedIn Unipile member sync',
          reconnectLogContext: 'extension LinkedIn sync',
        },
      );

    let accountId = resolution.accountId;
    let accountStatus = resolution.accountStatus;
    let isConnected = resolution.isConnected;
    const reconnectAttempted = resolution.reconnectAttempted;
    const reconnectSucceeded = resolution.reconnectSucceeded;
    const reconnectMessage = resolution.reconnectMessage;

    if (
      accountId &&
      (accountStatus === 'connected' || accountStatus === 'pending')
    ) {
      isConnected = true;
    }

    const finalizedAccountId = await this.finalizeMemberLinkedinUnipileSync(
      workspaceMemberId,
      authToken,
      accountId,
    );
    if (finalizedAccountId) {
      accountId = finalizedAccountId;
      if (accountStatus === 'not_connected') {
        accountStatus = 'connected';
        isConnected = true;
      }
    }

    const linkedin = await this.buildLinkedinSyncResponseFields(
      accountId,
      accountStatus,
      isConnected,
    );

    return {
      success: true,
      cookies: {
        hasLiAt: Boolean(storedCookies.linkedinLiAtToken),
        hasLiA: Boolean(storedCookies.linkedinLiAToken),
        cookiesChanged,
        lastSyncedAt: storedCookies.linkedinCookiesLastSyncedAt,
        lastValidatedAt: storedCookies.linkedinCookiesValidatedAt,
      },
      linkedin,
      reconnect: {
        attempted: reconnectAttempted,
        succeeded: reconnectSucceeded,
        message: reconnectMessage,
      },
      context: {
        pageUrl: params.page_url ?? null,
        linkedinProfileUrlFromExtension: params.linkedin_profile_url ?? null,
      },
    };
  }

  @Post('extension/sync-cookies')
  async syncExtensionCookies(
    @Body() body: LinkedinExtensionCookieSyncDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: Request & {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    const workspaceMemberId = request.workspaceMemberId;
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const clientIp = this.resolveClientIpForLinkedinSync(request, body.client_ip);
    const clientCountry = normalizeLinkedinConnectionCountry(body.client_country);

    if (!workspaceMemberId) {
      throw new HttpException(
        'workspaceMemberId required (user auth only)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!authToken) {
      throw new HttpException(
        'Authorization header required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log(
      `[extension/sync-cookies] Request received: workspaceMemberId=${workspaceMemberId} ` +
      `li_at present=${Boolean(body.li_at)} li_at length=${body.li_at?.length ?? 0} ` +
      `li_a present=${Boolean(body.li_a)} li_a length=${body.li_a?.length ?? 0} ` +
      `user_agent=${body.user_agent?.slice(0, 60) ?? 'none'} clientIp=${clientIp ?? 'none'} ` +
      `extensionClientIp=${body.client_ip ?? 'none'} clientCountry=${clientCountry ?? 'none'} ` +
      `page_url=${body.page_url ?? 'none'} ` +
      `linkedin_profile_url=${body.linkedin_profile_url ?? 'none'}`,
    );

    if (this.isLinkedinUnipileOnDemandEnabled()) {
      return this.persistExtensionCookies(body, workspace, request);
    }

    return this.linkedinUnipileMemberSyncCore(
      workspace,
      workspaceMemberId,
      authToken,
      request,
      {
        linkedin_profile_url: body.linkedin_profile_url,
        li_at: body.li_at,
        li_a: body.li_a,
        user_agent: body.user_agent,
        clientIp,
        clientCountry,
        page_url: body.page_url,
        persistRequestCookieTokens: true,
      },
    );
  }

  @Post('extension/persist-cookies')
  async persistExtensionCookies(
    @Body() body: LinkedinExtensionCookieSyncDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: Request & {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    const workspaceMemberId = request.workspaceMemberId;
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const clientIp = this.resolveClientIpForLinkedinSync(request, body.client_ip);
    const clientCountry = normalizeLinkedinConnectionCountry(body.client_country);

    if (!workspaceMemberId) {
      throw new HttpException(
        'workspaceMemberId required (user auth only)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!authToken) {
      throw new HttpException(
        'Authorization header required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const persisted = await this.persistLinkedinCookiesForMember(
      workspace,
      workspaceMemberId,
      authToken,
      {
        ...body,
        clientIp,
        clientCountry,
        allowMissingBrowserLinkedinUrl:
          this.isLinkedinUnipileOnDemandEnabled() || !body.linkedin_profile_url?.trim(),
      },
    );

    return {
      success: true,
      cookies: {
        hasLiAt: Boolean(persisted.storedCookies.linkedinLiAtToken),
        hasLiA: Boolean(persisted.storedCookies.linkedinLiAToken),
        cookiesChanged: persisted.cookiesChanged,
        lastSyncedAt: persisted.storedCookies.linkedinCookiesLastSyncedAt,
        lastValidatedAt: persisted.storedCookies.linkedinCookiesValidatedAt,
      },
      linkedin: {
        connected: false,
        status: this.isLinkedinUnipileOnDemandEnabled()
          ? 'on_demand'
          : 'not_connected',
        profileUrl: body.linkedin_profile_url ?? persisted.profileLinkedinUrl,
      },
      reconnect: {
        attempted: false,
        succeeded: false,
        message: null,
      },
      context: {
        pageUrl: body.page_url ?? null,
        linkedinProfileUrlFromExtension: body.linkedin_profile_url ?? null,
      },
    };
  }

  /**
   * Server-side LinkedIn Unipile reconnect using only cookies persisted on the workspace member profile
   * (`linkedinLiAtToken` / `linkedinLiAToken`). Same response shape as `extension/sync-cookies`.
   * Request body is optional; you may pass `user_agent` for the Unipile POST /accounts call.
   */
  @Post('reconnect-from-stored-profile')
  async reconnectLinkedinFromStoredProfile(
    @Body() body: LinkedinReconnectFromStoredProfileDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: Request & {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    const workspaceMemberId = request.workspaceMemberId;
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

    if (!workspaceMemberId) {
      throw new HttpException(
        'workspaceMemberId required (user auth only)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!authToken) {
      throw new HttpException(
        'Authorization header required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = body ?? {};

    return this.linkedinUnipileMemberSyncCore(
      workspace,
      workspaceMemberId,
      authToken,
      request,
      {
        user_agent: payload.user_agent,
        clientIp: payload.client_ip,
        clientCountry: payload.client_country,
        persistRequestCookieTokens: false,
      },
    );
  }

  @Post('extension/validate-session')
  async validateLinkedinSession(
    @Body() body: LinkedinReconnectFromStoredProfileDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: Request & {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    if (
      !this.isLinkedinUnipileOnDemandEnabled() ||
      !this.isValidateThenDisconnectEnabled()
    ) {
      throw new HttpException(
        'LinkedIn validate-then-disconnect is disabled',
        HttpStatus.NOT_FOUND,
      );
    }

    const workspaceMemberId = request.workspaceMemberId;
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

    if (!workspaceMemberId) {
      throw new HttpException(
        'workspaceMemberId required (user auth only)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!authToken) {
      throw new HttpException(
        'Authorization header required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const result = await this.linkedinUnipileMemberSyncCore(
      workspace,
      workspaceMemberId,
      authToken,
      request,
      {
        user_agent: body?.user_agent,
        clientIp: body?.client_ip,
        clientCountry: body?.client_country,
        persistRequestCookieTokens: false,
      },
    );

    const connected =
      Boolean(result?.linkedin?.connected) ||
      result?.linkedin?.status === 'connected' ||
      result?.linkedin?.status === 'pending';
    const keepConnected =
      await this.workspaceMemberProfileUnipileService.getKeepLinkedinConnected(
        workspaceMemberId,
        authToken,
      );

    let disconnectedAfterValidation = false;

    if (
      connected &&
      result?.linkedin?.accountId &&
      !keepConnected
    ) {
      this.logger.log(
        `Disconnecting LinkedIn Unipile account after cookie validation (on-demand, keepConnected=false): accountId=${result.linkedin.accountId} workspaceMemberId=${workspaceMemberId}`,
      );
      await this.memberLinkedinUnipileConnectionService.disconnectMemberLinkedinUnipileAccount(
        {
          accountId: result.linkedin.accountId,
          context: 'validated LinkedIn cookies in on-demand mode',
          workspaceMemberId,
          workspaceId: workspace.id,
          authToken,
          forceClearProfile: true,
        },
      );
      disconnectedAfterValidation = true;
    }

    if (connected) {
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens(
        authToken,
        workspaceMemberId,
        {},
        { touchLastValidatedAt: true },
      );
    }

    const storedCookies =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        authToken,
        workspaceMemberId,
      );

    return {
      ...result,
      cookies: {
        ...(result?.cookies ?? {}),
        hasLiAt: Boolean(storedCookies.linkedinLiAtToken),
        hasLiA: Boolean(storedCookies.linkedinLiAToken),
        lastSyncedAt: storedCookies.linkedinCookiesLastSyncedAt,
        lastValidatedAt: storedCookies.linkedinCookiesValidatedAt,
      },
      validate: {
        attempted: true,
        connected,
        keepConnected,
        disconnectedAfterValidation,
      },
      linkedin: {
        ...(result?.linkedin ?? {}),
        connected: connected && !disconnectedAfterValidation,
        status: disconnectedAfterValidation
          ? 'validated_disconnected'
          : result?.linkedin?.status,
      },
    };
  }

  @Post('accounts/update-member')
  async updateMemberLinkedinAccount(
    @Body() body: { accountId: string },
    @AuthWorkspace() workspace: Workspace,
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
    const workspaceMemberId = request.workspaceMemberId;
    if (!workspaceMemberId) {
      throw new HttpException(
        'workspaceMemberId required (user auth only)',
        HttpStatus.BAD_REQUEST,
      );
    }
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    if (!authToken || !body?.accountId) {
      throw new HttpException(
        'Authorization header and accountId required',
        HttpStatus.BAD_REQUEST,
      );
    }
    let previousLinkedinUnipileId: string | null = null;
    try {
      previousLinkedinUnipileId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          workspace.id,
          authToken,
          'linkedin',
        );
    } catch {
      previousLinkedinUnipileId = null;
    }
    const newId = body.accountId.trim();
    try {
      const account = await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(newId);

      if (account) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'linkedin',
          newId,
          account,
        );
      } else {
        await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          authToken,
          'linkedin',
          newId,
        );
      }
      if (previousLinkedinUnipileId && previousLinkedinUnipileId !== newId) {
        this.logger.log(
          `Disconnecting superseded LinkedIn Unipile account after manual member update: previousAccountId=${previousLinkedinUnipileId} newAccountId=${newId} workspaceMemberId=${workspaceMemberId}`,
        );
        await this.linkedinUnipileRequestService.disconnectAccountBestEffort(
          previousLinkedinUnipileId,
          'superseded LinkedIn Unipile account after manual member update',
        );
      }
    } catch (err) {
      this.logger.warn(
        `Could not sync LinkedIn URL to workspace member profile: ${err instanceof Error ? err.message : err}`,
      );
    }
    return { success: true };
  }

  @Post('org-chart/ensure-account')
  async ensureAccountForOrgChart(
    @Body() body: { success_redirect_url?: string; failure_redirect_url?: string },
    @AuthWorkspace() workspace: Workspace,
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
    const workspaceMemberId = request.workspaceMemberId;
    if (!workspaceMemberId) {
      throw new HttpException(
        'workspaceMemberId required (user auth only)',
        HttpStatus.BAD_REQUEST,
      );
    }
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    if (!authToken) {
      throw new HttpException('Authorization header required', HttpStatus.UNAUTHORIZED);
    }

    if (this.environmentService.get('LINKEDIN_UNIPILE_ON_DEMAND')) {
      const storedCookies =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
          authToken,
          workspaceMemberId,
        );
      if (!storedCookies.linkedinLiAtToken) {
        throw new HttpException(
          'LinkedIn session cookies are not stored on your profile. Sync cookies from the extension first.',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        onDemandReady: true,
        linkedinUnipileOnDemand: true,
      };
    }

    const result = await this.unipileAccountPoolService.getOrCreateUnipileAccount(
      workspaceMemberId,
      workspace.id,
      authToken,
      'LINKEDIN',
      {
        successRedirectUrl: body.success_redirect_url,
        failureRedirectUrl: body.failure_redirect_url,
      },
    );

    if ('accountId' in result) {
      return { accountId: result.accountId };
    }
    if ('redirectUrl' in result) {
      return { redirectUrl: result.redirectUrl };
    }
    return {
      status: 'pool_full',
      slotsUsed: result.slotsUsed,
      maxSlots: result.maxSlots,
    };
  }

  @Post('hosted-auth')
  async createHostedAuthLink(
    @Body() config: HostedAuthDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      // Generate notify_url for webhook callbacks
      const notifyUrl = config.notify_url || `${process.env.SERVER_URL}/linkedin-unipile/webhook/account-connected`;
      console.log('notifyUrl', notifyUrl);
      // Use workspace member ID as the name for user matching
      const userName = config.name || workspace.id;
      console.log('userName', userName);
      const requestBody = {
        type: config.type || 'create',
        providers: config.providers || ['LINKEDIN'],
        api_url: this.unipileApiUrl,
        expiresOn: config.expiresOn || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        success_redirect_url: config.success_redirect_url,
        failure_redirect_url: config.failure_redirect_url,
        notify_url: notifyUrl,
        name: userName,
        ...(config.reconnect_account && { reconnect_account: config.reconnect_account }),
      };

      const response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/hosted/accounts/link',
        'POST',
        requestBody,
      )) as { url?: string };

      return {
        success: true,
        hosted_link: response.url,
        expires_on: requestBody.expiresOn,
        name: userName,
      };
    } catch (error) {
      this.logger.error('Failed to create hosted auth link:', error);
      throw error;
    }
  }

  @Post('checkpoint')
  async solveCheckpoint(
    @Body() checkpointData: LinkedinCheckpointDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
    try {
      const body = {
        provider: 'LINKEDIN' as const,
        account_id: checkpointData.account_id,
        code: checkpointData.code,
      };
      const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/accounts/checkpoint',
        'POST',
        body,
        { returnStatus: true },
      )) as LinkedinUnipileStatusHttpResult;

      const { status, data } = result;

      if (status === 202 && (data.object === 'Checkpoint' || data.account_id)) {
        this.logger.log(`LinkedIn checkpoint required after solve: ${data.checkpoint?.type ?? 'unknown'}`);
        return {
          success: true,
          data: {
            status: 'checkpoint_required',
            account_id: data.account_id,
            checkpoint_type: data.checkpoint?.type ?? '2FA',
          },
        };
      }

      const solvedAccountId = data.account_id ?? data.id;

      await this.syncWorkspaceMemberProfileAfterLinkedinConnectionIfEligible(
        solvedAccountId,
        request,
        workspace.id,
      );

      return {
        success: true,
        data: {
          account_id: solvedAccountId,
          provider: 'LINKEDIN',
          status: data.status || 'connected',
          profile: data.profile_data,
        },
      };
    } catch (error) {
      this.logger.error('Failed to solve checkpoint:', error);
      throw error;
    }
  }

  @Post('accounts')
  async getAllAccounts(@AuthWorkspace() workspace: Workspace) {
    return this.linkedinUnipileRequestService.getAllAccounts(workspace);
  }

  @Post('accounts/:accountId')
  async getAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const response = await this.linkedinUnipileRequestService.makeUnipileRequest(`/api/v1/accounts/${accountId}`);
      return {
        success: true,
        account: response,
      };
    } catch (error) {
      this.logger.error(`Failed to get LinkedIn account ${accountId}:`, error);
      throw error;
    }
  }

  @Post('accounts/:accountId/resync')
  async resyncAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        `/api/v1/accounts/${accountId}/resync`,
        'POST',
      )) as { status?: unknown };
      return {
        success: true,
        status: response.status,
      };
    } catch (error) {
      this.logger.error(`Failed to resync LinkedIn account ${accountId}:`, error);
      throw error;
    }
  }

  @Delete('accounts/:accountId')
  async disconnectAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
    try {
      const workspaceMemberId = request.workspaceMemberId;
      const authToken =
        request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

      await this.memberLinkedinUnipileConnectionService.disconnectMemberLinkedinUnipileAccount(
        {
          accountId,
          context: 'LinkedIn Unipile disconnect API',
          workspaceMemberId,
          workspaceId: workspace.id,
          authToken,
        },
      );

      this.logger.log(
        `LinkedIn Unipile account disconnected successfully: accountId=${accountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn account disconnected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to disconnect LinkedIn account ${accountId}:`, error);
      throw error;
    }
  }

  @Post('profile/me/:accountId')
  async getOwnProfile(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
    const workspaceMemberId = request.workspaceMemberId?.trim() ?? '';
    const authToken =
      request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

    try {
      const profile =
        await this.linkedinUnipileRequestService.fetchLinkedinOwnerProfile(
          accountId,
          workspaceMemberId && authToken
            ? {
                accountId,
                workspaceMemberId,
                workspaceId: workspace.id,
                authToken,
                context: 'LinkedIn profile/me',
              }
            : undefined,
        );
      return {
        success: true,
        profile,
      };
    } catch (error) {
      this.logger.error(`Failed to get own LinkedIn profile for account ${accountId}:`, error);
      throw error;
    }
  }

  @Post('profile')
  async getProfile(
    @Body() profileRequest: LinkedinProfileDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const queryParams = new URLSearchParams({
        account_id: profileRequest.account_id,
      });

      if (profileRequest.linkedin_sections) {
        queryParams.append('linkedin_sections', profileRequest.linkedin_sections.join(','));
      }

      if (profileRequest.notify !== undefined) {
        queryParams.append('notify', profileRequest.notify.toString());
      }

      const response = await this.linkedinUnipileRequestService.makeUnipileRequest(`/api/v1/users/${encodeURIComponent(profileRequest.identifier)}?${queryParams}`);
      return {
        success: true,
        profile: response,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn profile:', error);
      throw error;
    }
  }

  @Post('profile/posts')
  async getUserPosts(
    @Body() postsRequest: LinkedinUserPostsDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const queryParams = new URLSearchParams({
        account_id: postsRequest.account_id,
      });

      if (postsRequest.limit !== undefined) {
        queryParams.append('limit', postsRequest.limit.toString());
      }

      if (postsRequest.cursor) {
        queryParams.append('cursor', postsRequest.cursor);
      }

      if (postsRequest.is_company !== undefined) {
        queryParams.append('is_company', postsRequest.is_company.toString());
      }

      const response = await this.linkedinUnipileRequestService.makeUnipileRequest(
        `/api/v1/users/${encodeURIComponent(postsRequest.identifier)}/posts?${queryParams}`,
      );

      return {
        success: true,
        posts: response,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn user posts:', error);
      throw error;
    }
  }

  @Post('profile/comments')
  async getUserComments(
    @Body() commentsRequest: LinkedinUserCommentsDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const comments =
        await this.linkedinUnipileRequestService.fetchLinkedinUserComments(
          commentsRequest.account_id,
          commentsRequest.identifier,
          {
            limit: commentsRequest.limit,
            cursor: commentsRequest.cursor,
          },
        );

      return {
        success: true,
        comments,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn user comments:', error);
      throw error;
    }
  }

  /**
   * Combined endpoint: profile + posts + activity (recruiting_activity section) in one call.
   *
   * Activity note: Unipile does not provide a standalone LinkedIn activity endpoint.
   * Activity data surfaces via two mechanisms only:
   *   1. Posts: GET /api/v1/users/{identifier}/posts  (always available)
   *   2. recruiting_activity profile section           (LinkedIn Recruiter accounts only)
   * Both are fetched in parallel. If recruiting_activity is unavailable (non-Recruiter),
   * the `activity` field in the response will be null with an explanatory message.
   */
  @Post('profile/overview')
  async getProfileOverview(
    @Body() req: LinkedinProfileOverviewDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // --- Build profile query params ---
    const profileSections = [...(req.linkedin_sections ?? [])];
    if (req.include_recruiting_activity && !profileSections.includes('recruiting_activity')) {
      profileSections.push('recruiting_activity');
    }

    const profileParams = new URLSearchParams({ account_id: req.account_id });
    if (profileSections.length > 0) {
      profileParams.append('linkedin_sections', profileSections.join(','));
    }
    if (req.notify !== undefined) {
      profileParams.append('notify', req.notify.toString());
    }

    // --- Build posts query params ---
    const postsParams = new URLSearchParams({ account_id: req.account_id });
    postsParams.append('limit', String(req.posts_limit ?? 10));

    // --- Fetch profile then posts with a human-like random delay between them ---
    // Firing both simultaneously risks LinkedIn anti-bot triggers; a random pause mimics human browsing.
    const randomDelayMs = (min: number, max: number) =>
      new Promise<void>((resolve) =>
        setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min),
      );

    let profileResult: PromiseSettledResult<unknown>;
    let postsResult: PromiseSettledResult<unknown>;

    try {
      const profileData = await this.linkedinUnipileRequestService.makeUnipileRequest(
        `/api/v1/users/${encodeURIComponent(req.identifier)}?${profileParams}`,
      );
      profileResult = { status: 'fulfilled', value: profileData };
    } catch (err) {
      profileResult = { status: 'rejected', reason: err };
    }

    // Wait 2–5 seconds between requests (human-like browsing pace)
    await randomDelayMs(2000, 5000);

    try {
      const postsData = await this.linkedinUnipileRequestService.makeUnipileRequest(
        `/api/v1/users/${encodeURIComponent(req.identifier)}/posts?${postsParams}`,
      );
      postsResult = { status: 'fulfilled', value: postsData };
    } catch (err) {
      postsResult = { status: 'rejected', reason: err };
    }

    const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
    const profileError = profileResult.status === 'rejected'
      ? (profileResult.reason as Error)?.message ?? 'Failed to fetch profile'
      : null;

    const postsData = postsResult.status === 'fulfilled' ? postsResult.value : null;
    const postsError = postsResult.status === 'rejected'
      ? (postsResult.reason as Error)?.message ?? 'Failed to fetch posts'
      : null;

    // --- Extract recruiting_activity from profile if requested ---
    let activity: unknown = null;
    let activityNote: string =
      'Unipile does not expose a standalone LinkedIn activity endpoint. ' +
      'Posts are the primary activity signal. Pass include_recruiting_activity=true ' +
      'with a LinkedIn Recruiter account to also retrieve recruiter activity.';

    if (req.include_recruiting_activity && profile) {
      const profileData = profile as Record<string, unknown>;
      activity = profileData['recruiting_activity'] ?? null;
      activityNote = activity
        ? 'recruiting_activity fetched from profile sections (LinkedIn Recruiter).'
        : 'recruiting_activity section was empty — account may not have LinkedIn Recruiter access.';
    }

    return {
      success: true,
      identifier: req.identifier,
      profile: profile ?? null,
      profile_error: profileError,
      posts: postsData ?? null,
      posts_error: postsError,
      activity,
      activity_note: activityNote,
    };
  }

  @Post('message/send')
  async sendMessage(
    @Body() messageData: LinkedinMessageDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const messagingService = new LinkedinUnipileMessagingService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.unipileApiUrl,
        this.unipileAccessToken,
      );

      const response = await messagingService.sendMessage(
        messageData.account_id,
        messageData.attendees_ids,
        messageData.text,
        messageData.attachments,
        messageData.voice_message,
        messageData.video_message,
        messageData.subject,
      );

      return {
        success: true,
        message: response,
      };
    } catch (error) {
      this.logger.error('Failed to send LinkedIn message:', error);
      throw error;
    }
  }

  @Post('message/invite')
  async sendInvitation(
    @Body() invitationData: LinkedinInvitationDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const messagingService = new LinkedinUnipileMessagingService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.unipileApiUrl,
        this.unipileAccessToken,
      );

      const response = await messagingService.sendInvitation(
        invitationData.account_id,
        invitationData.provider_id,
        invitationData.message,
      );

      return {
        success: true,
        invitation: response,
      };
    } catch (error) {
      this.logger.error('Failed to send LinkedIn invitation:', error);
      throw error;
    }
  }

  @Post('health')
  async getHealth() {
    return {
      service: 'LinkedIn Unipile Controller',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      unipile_configured: !!this.unipileAccessToken,
      unipile_url: this.unipileApiUrl,
    };
  }

  /**
   * Create a webhook in Unipile to receive real-time notifications
   */
  @Post('webhook/create')
  async createWebhook(
    @Body() config: CreateWebhookDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      // Use the webhook service to generate the configuration
      const requestBody = this.webhookService.createWebhookConfig(config);

      const response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/webhooks',
        'POST',
        requestBody,
      )) as {
        id?: string;
        created_at?: string;
        status?: string;
      };

      this.logger.log(`Created ${config.source} webhook: ${response.id}`);

      return {
        success: true,
        webhook: {
          id: response.id,
          url: requestBody.request_url,
          source: config.source,
          created_at: response.created_at,
          status: response.status,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create webhook:', error);
      throw error;
    }
  }

  /**
   * List all configured webhooks
   */
  @Post('webhooks')
  async getWebhooks(@AuthWorkspace() workspace: Workspace) {
    try {
      const response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/webhooks',
      )) as { items?: unknown };

      return {
        success: true,
        webhooks: response.items || response,
      };
    } catch (error) {
      this.logger.error('Failed to get webhooks:', error);
      throw error;
    }
  }

  /**
   * Delete a webhook
   */
  @Delete('webhook/:webhookId')
  async deleteWebhook(
    @Param('webhookId') webhookId: string,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      await this.linkedinUnipileRequestService.makeUnipileRequest(`/api/v1/webhooks/${webhookId}`, 'DELETE');
      
      return {
        success: true,
        message: 'Webhook deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete webhook ${webhookId}:`, error);
      throw error;
    }
  }

  /**
   * Legacy webhook endpoint for account connections
   * @deprecated Use the main /webhook endpoint instead
   */
  @Post('webhook/account-connected')
  async handleLegacyAccountConnectedWebhook(
    @Body() payload: {
      status: 'CREATION_SUCCESS' | 'RECONNECTED';
      account_id: string;
      name: string; // This is the workspace/user ID we sent
    },
    @Req() request: any,
    @Res() response: any,
  ) {
    try {
      this.logger.log('Received legacy account connected webhook:', payload);

      // Convert to new format and delegate to webhook service
      const convertedPayload: UnipileAccountStatusWebhook = {
        AccountStatus: {
          account_id: payload.account_id,
          account_type: 'LINKEDIN',
          message: payload.status,
          name: payload.name,
        },
      };

      await this.webhookService.processWebhook(convertedPayload);

      return response.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      this.logger.error('Failed to process legacy account connected webhook:', error);
      return response.status(500).json({
        success: false,
        message: 'Failed to process webhook',
      });
    }
  }

  @Post('reconnect/:accountId')
  async createReconnectionLink(
    @Param('accountId') accountId: string,
    @Body() config: HostedAuthDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      // Create a reconnection link for an existing account
      const reconnectConfig: HostedAuthDto = {
        ...config,
        type: 'reconnect',
        reconnect_account: accountId,
        providers: ['LINKEDIN'],
        name: workspace.id,
      };

      return this.createHostedAuthLink(reconnectConfig, workspace);
    } catch (error) {
      this.logger.error(`Failed to create reconnection link for account ${accountId}:`, error);
      throw error;
    }
  }


}






// curl --request POST \
// --url https://api18.unipile.com:14823/api/v1/webhooks \
// --header 'X-API-KEY: jzS7Uh0w.rfsm3/s0r5zinYIGCmQ0bOSo2PS4UWtXBKMCY5xG4Lw=' \
// --header 'accept: application/json' \
// --header 'content-type: application/json' \
// --data '{
// "request_url": "https://51dh0t1p-3000.inc1.devtunnels.ms/linkedin-unipile/webhook",
// "source": "messaging",
// "headers": [
// {
//  "key": "Content-Type",
//  "value": "application/json"
// },
// {
//  "key": "Unipile-Auth",
//  "value": "ACoAAAcDMMQBODyLwZrRcgYhrkCafURGqva0U4E"
// }
// ]
// }'
