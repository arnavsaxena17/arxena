import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    Post,
    Req,
    Res,
    UseGuards
} from '@nestjs/common';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

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
  options?: {
    linkedin?: {
      api?: 'classic' | 'recruiter' | 'sales_navigator';
      inmail?: boolean;
    };
  };
}

@Controller('linkedin-unipile')
@UseGuards(JwtAuthGuard)
export class LinkedinUnipileController {
  private readonly logger = new Logger(LinkedinUnipileController.name);

  // Unipile configuration - These should come from environment variables
  private readonly unipileApiUrl = process.env.UNIPILE_API_URL || 'https://api18.unipile.com:14823';
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN || 'jzS7Uh0w.rfsm3/s0r5zinYIGCmQ0bOSo2PS4UWtXBKMCY5xG4Lw=';

  constructor() {
    if (!this.unipileAccessToken) {
      this.logger.warn('UNIPILE_ACCESS_TOKEN not found in environment variables');
    }
  }

  private async makeUnipileRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
  ): Promise<any> {
    if (!this.unipileAccessToken) {
      throw new HttpException('Unipile access token not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const url = `${this.unipileApiUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.unipileAccessToken}`,
      'X-API-KEY': this.unipileAccessToken,
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
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new HttpException(
          errorData.message || `Unipile API error: ${response.statusText}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Failed to make Unipile request:', error);
      throw new HttpException('Failed to communicate with Unipile API', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Post('connect/credentials')
  async connectWithCredentials(
    @Body() credentials: LinkedinCredentialsDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      this.logger.log(`Connecting LinkedIn account for workspace: ${workspace.id}`);
      
      const response = await this.makeUnipileRequest('/api/v1/accounts/linkedin', 'POST', {
        username: credentials.username,
        password: credentials.password,
      });

      // Store account information in workspace context if needed
      // This could involve saving to a ConnectedAccount entity

      return {
        success: true,
        data: {
          account_id: response.id || response.account_id,
          provider: 'LINKEDIN',
          status: response.status || 'connected',
          profile: response.profile_data,
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
      
      const response = await this.makeUnipileRequest('/api/v1/accounts/linkedin/cookie', 'POST', {
        access_token: cookieAuth.access_token,
        user_agent: cookieAuth.user_agent,
      });

      return {
        success: true,
        data: {
          account_id: response.id || response.account_id,
          provider: 'LINKEDIN',
          status: response.status || 'connected',
          profile: response.profile_data,
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
      const response = await this.makeUnipileRequest('/api/v1/accounts/checkpoint', 'POST', checkpointData);

      return {
        success: true,
        data: {
          account_id: response.account_id,
          provider: 'LINKEDIN',
          status: response.status || 'connected',
          profile: response.profile_data,
        },
      };
    } catch (error) {
      this.logger.error('Failed to solve checkpoint:', error);
      throw error;
    }
  }

  @Get('accounts')
  async getAllAccounts(@AuthWorkspace() workspace: Workspace) {
    try {
      const response = await this.makeUnipileRequest('/api/v1/accounts?provider=linkedin');
      console.log('getAllAccounts response', response);
      
      // Transform the response to match our expected format
      const accounts = (response.items || []).map((item: any) => ({
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
    if (account.connection_params && account.connection_params.status) {
      const status = account.connection_params.status.toLowerCase();
      if (status === 'active' || status === 'ok' || status === 'connected') {
        return 'connected';
      }
      if (status === 'credentials' || status === 'failed') {
        return 'disconnected';
      }
      if (status === 'checkpoint_required') {
        return 'checkpoint_required';
      }
      if (status === 'pending') {
        return 'pending';
      }
      // Fallback for unknown statuses
      return 'disconnected';
    }
    
    // Default to connected if we have the account
    return account.id ? 'connected' : 'disconnected';
  }

  @Get('accounts/:accountId')
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

  @Get('profile/me/:accountId')
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
      const response = await this.makeUnipileRequest('/api/v1/messaging/start-new-chat', 'POST', messageData);
      return {
        success: true,
        chat: response,
      };
    } catch (error) {
      this.logger.error('Failed to send LinkedIn message:', error);
      throw error;
    }
  }

  @Get('health')
  async getHealth() {
    return {
      service: 'LinkedIn Unipile Controller',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      unipile_configured: !!this.unipileAccessToken,
      unipile_url: this.unipileApiUrl,
    };
  }

  @Post('webhook/account-connected')
  async handleAccountConnectedWebhook(
    @Body() payload: {
      status: 'CREATION_SUCCESS' | 'RECONNECTED';
      account_id: string;
      name: string; // This is the workspace/user ID we sent
    },
    @Req() request: any,
    @Res() response: any,
  ) {
    try {
      this.logger.log('Received account connected webhook:', payload);

      // TODO: Store the connected account information
      // This would typically involve:
      // 1. Finding the workspace by the 'name' field (workspace.id)
      // 2. Creating a ConnectedAccount entity
      // 3. Linking the account_id to the workspace

      const { status, account_id, name: workspaceId } = payload;

      // For now, just log the successful connection
      this.logger.log(`LinkedIn account ${account_id} ${status} for workspace ${workspaceId}`);

      // You could emit an event here for real-time updates
      // this.eventEmitter.emit('linkedin.account.connected', { workspaceId, accountId: account_id, status });

      return response.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      this.logger.error('Failed to process account connected webhook:', error);
      return response.status(500).json({
        success: false,
        message: 'Failed to process webhook',
      });
    }
  }

  @Post('webhook/account-status')
  async handleAccountStatusWebhook(
    @Body() payload: {
      account_id: string;
      status: string;
      provider: string;
    },
    @Req() request: any,
    @Res() response: any,
  ) {
    try {
      this.logger.log('Received account status webhook:', payload);

      const { account_id, status, provider } = payload;

      // Handle different status changes
      if (status === 'CREDENTIALS') {
        // Account needs reconnection
        this.logger.warn(`LinkedIn account ${account_id} requires reconnection`);
        // TODO: Trigger reconnection flow (email notification, etc.)
      }

      return response.status(200).json({
        success: true,
        message: 'Status webhook processed successfully',
      });
    } catch (error) {
      this.logger.error('Failed to process account status webhook:', error);
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
