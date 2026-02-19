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
import { LinkedinUnipileMessagingService } from '../services/linkedin-unipile/linkedin-unipile-messaging.service';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
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
  ) {
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(`Unipile Access Token configured: ${!!this.unipileAccessToken}`);
  }

  private async makeUnipileRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    options?: { returnStatus: true },
  ): Promise<any> {
    const url = `${this.unipileApiUrl}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    try {
      this.logger.log(`Making Unipile request to: ${url}`);
      this.logger.log(`Using API key: ${this.unipileAccessToken?.substring(0, 10) || ''}...`);
      
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        this.logger.error(`Unipile API error: ${response.status} ${response.statusText}`);
        this.logger.error(`Unipile API error: Object:`, JSON.stringify(data, null, 2));
        const message =
          data.detail || data.message || `Unipile API error: ${response.statusText}`;
        throw new HttpException(message, response.status);
      }

      if (options?.returnStatus) {
        return { status: response.status, data };
      }
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Failed to make Unipile request:', error);
      throw new HttpException('Failed to communicate with Unipile API', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** Fetch a single account by id; returns null on 404 (e.g. account disconnected) without logging ERROR. */
  private async fetchAccountByIdIfExists(accountId: string): Promise<any | null> {
    console.log('fetchAccountByIdIfExists', accountId);
    const url = `${this.unipileApiUrl}/api/v1/accounts/${accountId}`;
    const headers = {
      'Accept': 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
    };
    try {
      const response = await fetch(url, { method: 'GET', headers });
      const data = await response.json().catch(() => ({}));
      if (response.status === 404) {
        this.logger.warn(`Workspace linked account ${accountId} not found in Unipile (404); it may have been disconnected`);
        return null;
      }
      if (!response.ok) {
        this.logger.error(`Unipile API error: ${response.status} ${response.statusText}`, data);
        return null;
      }
      return data;
    } catch (err) {
      this.logger.warn(`Could not fetch account ${accountId}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  @Post('connect/credentials')
  async connectWithCredentials(
    @Body() credentials: LinkedinCredentialsDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      this.logger.log(`Connecting LinkedIn account for workspace: ${workspace.id}`);
      
      const result = await this.makeUnipileRequest(
        '/api/v1/accounts',
        'POST',
        {
          provider: 'LINKEDIN',
          username: credentials.username,
          password: credentials.password,
        },
        { returnStatus: true },
      );

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

      return {
        success: true,
        data: {
          account_id: data.id || data.account_id,
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
  ) {
    try {
      this.logger.log(`Connecting LinkedIn account with cookie for workspace: ${workspace.id}`);
      
      const result = await this.makeUnipileRequest(
        '/api/v1/accounts',
        'POST',
        {
          provider: 'LINKEDIN',
          access_token: cookieAuth.access_token,
          ...(cookieAuth.user_agent && { user_agent: cookieAuth.user_agent }),
        },
        { returnStatus: true },
      );

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

      return {
        success: true,
        data: {
          account_id: data.id || data.account_id,
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

      const response = await this.makeUnipileRequest('/api/v1/hosted/accounts/link', 'POST', requestBody);

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
  ) {
    try {
      const body = {
        provider: 'LINKEDIN' as const,
        account_id: checkpointData.account_id,
        code: checkpointData.code,
      };
      const result = await this.makeUnipileRequest(
        '/api/v1/accounts/checkpoint',
        'POST',
        body,
        { returnStatus: true },
      );

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

      return {
        success: true,
        data: {
          account_id: data.account_id ?? data.id,
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
    try {
      const workspaceKeys = await this.workspaceQueryService.getWorkspaceKeys(workspace.id);
      const linkedinUrl = workspaceKeys.linkedin_url;
      const linkedinUnipileAccountId = workspaceKeys.linkedin_unipile_account_id;

      if (!linkedinUrl && !linkedinUnipileAccountId) {
        this.logger.warn(`No linkedin_url or linkedin_unipile_account_id for workspace ${workspace.id}, skipping Unipile accounts call`);
        return {
          success: true,
          accounts: [],
          message: 'linkedin_url not configured for workspace',
        };
      }

      const response = await this.makeUnipileRequest('/api/v1/accounts?provider=linkedin');
      this.logger.log('Getting getAllAccounts response');

      this.logger.log(`Filtering LinkedIn accounts for workspace ${workspace.id} with linkedin_url: ${linkedinUrl ?? 'none'}, linkedin_unipile_account_id: ${linkedinUnipileAccountId ?? 'none'}`);
      
      // Transform and filter the response to match our expected format
      const allAccounts = (response.items || []).map((item: any) => ({
        id: item.id,
        username: item.name || 'Unknown',
        name: item.name || 'Unknown',
        type: item.type,
        status: this.mapAccountStatus(item),
        created_at: item.created_at,
        provider: 'LINKEDIN',
        connection_params: item.connection_params,
        sources: item.sources || [],
        groups: item.groups || [],
      }));
      
      // Include account if: (1) it matches workspace linkedin_url by publicIdentifier, or (2) it is the workspace's linkedin_unipile_account_id
      const accounts = allAccounts.filter((account: any) => {
        if (linkedinUnipileAccountId && account.id === linkedinUnipileAccountId) {
          this.logger.log(`Account ${account.id} matches workspace linkedin_unipile_account_id`);
          return true;
        }

        const accountPublicIdentifier = account.connection_params?.im?.publicIdentifier;
        if (!accountPublicIdentifier) {
          this.logger.warn(`Account ${account.id} has no publicIdentifier in connection_params`);
          return false;
        }
        
        if (!linkedinUrl) return false;

        const matches =
          accountPublicIdentifier === linkedinUrl ||
          linkedinUrl.includes(accountPublicIdentifier) ||
          accountPublicIdentifier.includes(linkedinUrl);
        
        if (matches) {
          this.logger.log(`Account ${account.id} (${accountPublicIdentifier}) matches linkedin_url: ${linkedinUrl}`);
        } else {
          this.logger.log(`Account ${account.id} (${accountPublicIdentifier}) does not match linkedin_url: ${linkedinUrl}`);
        }
        
        return matches;
      });

      // If workspace has linkedin_unipile_account_id but it's not in the list (e.g. newly connected or not in this page), fetch it by id
      if (linkedinUnipileAccountId && !accounts.some((a: any) => a.id === linkedinUnipileAccountId)) {
        const single = await this.fetchAccountByIdIfExists(linkedinUnipileAccountId);
        if (single) {
          const mapped = {
            id: single.id,
            username: single.name || 'Unknown',
            name: single.name || 'Unknown',
            type: single.type,
            status: this.mapAccountStatus(single),
            created_at: single.created_at,
            provider: 'LINKEDIN',
            connection_params: single.connection_params,
            sources: single.sources || [],
            groups: single.groups || [],
          };
          accounts.push(mapped);
          this.logger.log(`Included workspace linked account ${linkedinUnipileAccountId} from single-account fetch`);
        }
      }
      
      this.logger.log(`Filtered ${accounts.length} LinkedIn accounts from ${allAccounts.length} total accounts`);
      
      return {
        success: true,
        accounts,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn accounts:', error);
      throw error;
    }
  }

  private mapAccountStatus(account: any): 'connected' | 'disconnected' | 'pending' | 'checkpoint_required' {
    // Map Unipile account status to our status format
    const rawStatus =
      account?.connection_params?.status ??
      account?.status ??
      account?.connection_params?.im?.status ??
      account?.sources?.[0]?.status;

    if (typeof rawStatus === 'string') {
      const status = rawStatus.toLowerCase();

      if (['active', 'ok', 'connected', 'ready', 'synced'].includes(status)) {
        return 'connected';
      }

      if (['credentials', 'failed', 'error', 'disconnected', 'revoked'].includes(status)) {
        return 'disconnected';
      }

      if (status === 'checkpoint_required') {
        return 'checkpoint_required';
      }

      if (status === 'pending' || status === 'syncing') {
        return 'pending';
      }

      // Fallback for unknown statuses
      return 'disconnected';
    }
    
    // Default to connected if we have the account
    return account?.id ? 'connected' : 'disconnected';
  }

  @Post('accounts/:accountId')
  async getAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const response = await this.makeUnipileRequest(`/api/v1/accounts/${accountId}`);
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
      const response = await this.makeUnipileRequest(`/api/v1/accounts/${accountId}/resync`, 'POST');
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
      await this.makeUnipileRequest(`/api/v1/accounts/${accountId}`, 'DELETE');
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
      const response = await this.makeUnipileRequest(`/api/v1/users/me?account_id=${accountId}`);
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

      const response = await this.makeUnipileRequest(`/api/v1/users/profile?${queryParams}`);
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

      const response = await this.makeUnipileRequest('/api/v1/webhooks', 'POST', requestBody);

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
      const response = await this.makeUnipileRequest('/api/v1/webhooks');
      
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
      await this.makeUnipileRequest(`/api/v1/webhooks/${webhookId}`, 'DELETE');
      
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