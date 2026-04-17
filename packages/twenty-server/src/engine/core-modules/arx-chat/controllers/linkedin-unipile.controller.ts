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
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import {
    findLinkedinUnipileAccountBlockingNewConnectionForProfile,
    type UnipileLinkedinAccount,
} from 'twenty-shared';

import { LinkedinUnipileRequestService } from '../services/linkedin-unipile-request.service';
import { LinkedinUnipileMessagingService } from '../services/linkedin-unipile/linkedin-unipile-messaging.service';
import { UnipileAccountPoolService } from '../services/unipile-account-pool.service';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import { WorkspaceMemberProfileUnipileService } from '../services/workspace-member-profile-unipile.service';
import type {
    CreateWebhookDto,
    UnipileAccountStatusWebhook,
} from '../types/unipile-webhook.types';

// DTOs for LinkedIn Unipile integration
interface LinkedinCredentialsDto {
  username: string;
  password: string;
}

interface LinkedinCookieAuthDto {
  access_token: string;
  user_agent: string;
}

interface LinkedinExtensionCookieSyncDto {
  li_at?: string;
  li_a?: string;
  user_agent?: string;
  page_url?: string;
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
    private readonly unipileAccountPoolService: UnipileAccountPoolService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
  ) {
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(`Unipile Access Token configured: ${!!this.unipileAccessToken}`);
  }

  /**
   * Avoid creating a duplicate LinkedIn Unipile account when the same member identity
   * (stored id or profile URL hints) already has an active or in-progress connection in Unipile.
   * Uses the Unipile accounts API list as source of truth, not workspace keys (which can be stale).
   */
  private async assertNoBlockingLinkedinConnectionForMember(
    workspaceMemberId: string | undefined,
    authToken: string,
  ): Promise<void> {
    if (!workspaceMemberId || !authToken) {
      return;
    }
    const profile =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
        workspaceMemberId,
        authToken,
      );
    const { accounts } =
      await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();
    const blocking = findLinkedinUnipileAccountBlockingNewConnectionForProfile(
      accounts as UnipileLinkedinAccount[],
      profile,
    );
    if (blocking?.id) {
      throw new HttpException(
        {
          message:
            'This LinkedIn profile is already connected to Unipile. Disconnect the existing account or wait for it to finish connecting before adding another.',
          existing_account_id: blocking.id,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * After a successful LinkedIn Unipile connection (non-checkpoint), persist account id,
   * linkedinUrl, and related fields on the current workspace member profile when JWT + member id are present.
   */
  private async syncWorkspaceMemberProfileAfterLinkedinConnectionIfEligible(
    accountId: string | null | undefined,
    request: { workspaceMemberId?: string; headers?: { authorization?: string } },
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
      await this.assertNoBlockingLinkedinConnectionForMember(
        request.workspaceMemberId,
        authToken,
      );

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
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
    try {
      this.logger.log(`Connecting LinkedIn account with cookie for workspace: ${workspace.id}`);

      const authTokenCookie =
        request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';
      await this.assertNoBlockingLinkedinConnectionForMember(
        request.workspaceMemberId,
        authTokenCookie,
      );

      const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/accounts',
        'POST',
        {
          provider: 'LINKEDIN',
          access_token: cookieAuth.access_token,
          ...(cookieAuth.user_agent && { user_agent: cookieAuth.user_agent }),
        },
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

  @Post('extension/sync-cookies')
  async syncExtensionCookies(
    @Body() body: LinkedinExtensionCookieSyncDto,
    @AuthWorkspace() workspace: Workspace,
    @Req() request: {
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

    const normalizeToken = (value?: string) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim();

      return trimmed ? trimmed : undefined;
    };

    const liAtToken = normalizeToken(body.li_at);
    const liAToken = normalizeToken(body.li_a);
    const userAgent = normalizeToken(body.user_agent);

    if (liAtToken !== undefined || liAToken !== undefined) {
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens(
        workspace.id,
        workspaceMemberId,
        {
          ...(liAtToken !== undefined && { linkedinLiAtToken: liAtToken }),
          ...(liAToken !== undefined && { linkedinLiAToken: liAToken }),
        },
      );
    }

    const storedCookies =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        workspace.id,
        workspaceMemberId,
      );

    const effectiveLiAtToken = liAtToken ?? storedCookies.linkedinLiAtToken;
    const effectiveLiAToken = liAToken ?? storedCookies.linkedinLiAToken;

    let accountId =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
        workspaceMemberId,
        workspace.id,
        authToken,
        'linkedin',
      );

    let accountStatus:
      | 'connected'
      | 'disconnected'
      | 'pending'
      | 'checkpoint_required'
      | 'not_connected' = 'not_connected';
    let isConnected = false;

    if (accountId) {
      const account = await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(accountId);

      if (account) {
        accountStatus = this.linkedinUnipileRequestService.mapAccountStatus(account);
        isConnected =
          accountStatus === 'connected' || accountStatus === 'pending';
      } else {
        accountStatus = 'disconnected';
      }
    }

    const reconnectSourceToken = effectiveLiAtToken ?? effectiveLiAToken;
    const shouldAttemptReconnect =
      Boolean(reconnectSourceToken) &&
      (!accountId || accountStatus === 'disconnected');

    let reconnectAttempted = false;
    let reconnectSucceeded = false;
    let reconnectMessage: string | null = null;

    if (shouldAttemptReconnect) {
      reconnectAttempted = true;

      try {
        const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
          '/api/v1/accounts',
          'POST',
          {
            provider: 'LINKEDIN',
            access_token: reconnectSourceToken,
            ...(userAgent && { user_agent: userAgent }),
          },
          { returnStatus: true },
        )) as LinkedinUnipileStatusHttpResult;

        const { status, data } = result;
        const nextAccountId = data?.id || data?.account_id || null;
        const isCheckpoint =
          (status === 202 && data?.account_id) ||
          (data?.object === 'Checkpoint' && data?.account_id);

        if (nextAccountId) {
          const accountPayload = await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(nextAccountId);

          if (accountPayload) {
            await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
              workspaceMemberId,
              authToken,
              'linkedin',
              nextAccountId,
              accountPayload,
            );
          } else {
            await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
              workspaceMemberId,
              authToken,
              'linkedin',
              nextAccountId,
            );
          }
          accountId = nextAccountId;
        }

        if (isCheckpoint) {
          accountStatus = 'checkpoint_required';
          isConnected = false;
          reconnectMessage = 'LinkedIn checkpoint required';
          reconnectSucceeded = true;
        } else if (nextAccountId) {
          accountStatus = 'connected';
          isConnected = true;
          reconnectSucceeded = true;
        }
      } catch (error) {
        reconnectMessage =
          error instanceof Error ? error.message : 'Failed to reconnect';
        this.logger.warn(
          `LinkedIn extension reconnect failed for member ${workspaceMemberId}: ${reconnectMessage}`,
        );
      }
    }

    return {
      success: true,
      cookies: {
        hasLiAt: Boolean(storedCookies.linkedinLiAtToken),
        hasLiA: Boolean(storedCookies.linkedinLiAToken),
      },
      linkedin: {
        accountId,
        status: accountStatus,
        connected: isConnected,
      },
      reconnect: {
        attempted: reconnectAttempted,
        succeeded: reconnectSucceeded,
        message: reconnectMessage,
      },
      context: {
        pageUrl: body.page_url ?? null,
      },
    };
  }

  @Post('accounts/update-member')
  async updateMemberLinkedinAccount(
    @Body() body: { accountId: string },
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
    try {
      const account = await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(body.accountId);

      if (account) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'linkedin',
          body.accountId,
          account,
        );
      } else {
        await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          authToken,
          'linkedin',
          body.accountId,
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
  ) {
    try {
      await this.linkedinUnipileRequestService.makeUnipileRequest(`/api/v1/accounts/${accountId}`, 'DELETE');
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
  ) {
    try {
      const response = await this.linkedinUnipileRequestService.makeUnipileRequest(`/api/v1/users/me?account_id=${accountId}`);
      return {
        success: true,
        profile: response,
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
        identifier: profileRequest.identifier,
      });

      if (profileRequest.linkedin_sections) {
        queryParams.append('linkedin_sections', profileRequest.linkedin_sections.join(','));
      }

      if (profileRequest.notify !== undefined) {
        queryParams.append('notify', profileRequest.notify.toString());
      }

      const response = await this.linkedinUnipileRequestService.makeUnipileRequest(`/api/v1/users/profile?${queryParams}`);
      return {
        success: true,
        profile: response,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn profile:', error);
      throw error;
    }
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
