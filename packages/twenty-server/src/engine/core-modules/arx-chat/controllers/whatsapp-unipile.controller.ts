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
  UseGuards,
} from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { UnipileClient } from 'unipile-node-sdk';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import { WorkspaceMemberProfileUnipileService } from '../services/workspace-member-profile-unipile.service';
import type {
  UnipileAccountStatusWebhook,
} from '../types/unipile-webhook.types';

@Controller('whatsapp-unipile')
@UseGuards(JwtAuthGuard)
export class WhatsappUnipileController {
  private readonly logger = new Logger(WhatsappUnipileController.name);

  // Unipile configuration - These come from environment variables with fallbacks
  private readonly unipileApiUrl = process.env.UNIPILE_API_URL;
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN;
  private readonly unipileClient: UnipileClient;

  constructor(
    private readonly webhookService: UnipileWebhookService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
  ) {
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(`Unipile Access Token configured: ${!!this.unipileAccessToken}`);
    
    // Initialize Unipile SDK client
    this.unipileClient = new UnipileClient(
      this.unipileApiUrl || '',
      this.unipileAccessToken || '',
    );
  }

  private async makeUnipileRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Use warning level for 404s (expected when accounts don't exist)
        if (response.status === HttpStatus.NOT_FOUND) {
          this.logger.warn(`Unipile API 404: ${response.statusText}`, errorData);
        } else {
          this.logger.error(`Unipile API error: ${response.status} ${response.statusText}`, errorData);
        }
        
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

  @Post('accounts/update-member')
  async updateMemberWhatsappAccount(
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
    await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      authToken,
      'whatsapp',
      body.accountId,
    );
    return { success: true };
  }

  /**
   * Request QR code for WhatsApp connection
   * Uses Unipile SDK's connectWhatsapp() method
   */
  @Post('qr-code')
  async requestQrCode(@AuthWorkspace() workspace: Workspace) {
    try {
      this.logger.log(`Requesting WhatsApp QR code for workspace: ${workspace.id}`);
      
      // Use Unipile SDK's connectWhatsapp() method
      const response = await this.unipileClient.account.connectWhatsapp();
      const { qrCodeString, code } = response;

      return {
        success: true,
        qrCodeString,
        code,
        account_id: (response as any).account_id || (response as any).id,
      };
    } catch (error) {
      this.logger.error('Failed to request WhatsApp QR code:', error);
      throw error;
    }
  }

  /**
   * Check account status (for polling)
   */
  @Get('accounts/:accountId/status')
  async checkAccountStatus(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      this.logger.log(`Checking account status for account ${accountId}`);
      const response = await this.makeUnipileRequest(`/api/v1/accounts/${accountId}`);
      // this.logger.log(`Account status response: ${JSON.stringify(response)}`);
      const status = this.mapAccountStatus(response);
      
      return {
        success: true,
        status,
        account_id: response.id,
      };
    } catch (error) {
      // Handle 404 (account not found) gracefully - return disconnected status
      if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) {
        this.logger.warn(`Account ${accountId} not found in Unipile, returning disconnected status`);
        return {
          success: true,
          status: 'disconnected' as const,
          account_id: accountId,
        };
      }
      
      this.logger.error(`Failed to check account status for in whatsapp-unipile controller ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get all WhatsApp accounts
   */
  @Post('accounts')
  async getAllAccounts(@AuthWorkspace() workspace: Workspace) {
    try {
      const workspaceKeys = await this.workspaceQueryService.getWorkspaceKeys(workspace.id);
      const whatsappPhoneNumber = workspaceKeys.whatsapp_web_phone_number;

      if (!whatsappPhoneNumber) {
        this.logger.warn(`No whatsapp_web_phone_number found for workspace ${workspace.id}, skipping Unipile accounts call`);
        return {
          success: true,
          accounts: [],
          message: 'whatsapp_web_phone_number not configured for workspace',
        };
      }

      const response = await this.makeUnipileRequest('/api/v1/accounts?provider=whatsapp');

      this.logger.log(`Filtering WhatsApp accounts for workspace ${workspace.id} with whatsapp_web_phone_number: ${whatsappPhoneNumber}`);
      
      // Transform and filter the response to match our expected format
      const allAccounts = (response.items || []).map((item: any) => ({
        id: item.id,
        username: item.name || item.phone_number || 'Unknown',
        name: item.name || 'Unknown',
        phone_number: item.phone_number,
        type: item.type,
        status: this.mapAccountStatus(item),
        created_at: item.created_at,
        provider: 'WHATSAPP',
        connection_params: item.connection_params,
        sources: item.sources || [],
        groups: item.groups || [],
      }));
      
      // Filter accounts: only return accounts that match the workspace's whatsapp_web_phone_number
      const accounts = allAccounts.filter((account: any) => {
        const accountPhoneNumber = account.connection_params?.im?.phone_number || account.phone_number;
        if (!accountPhoneNumber) {
          this.logger.warn(`Account ${account.id} has no phone_number in connection_params`);
          return false;
        }
        
        // Normalize phone numbers for comparison (remove any formatting)
        const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
        const normalizedAccountPhone = normalizePhone(accountPhoneNumber);
        const normalizedWorkspacePhone = normalizePhone(whatsappPhoneNumber);
        
        const matches = normalizedAccountPhone === normalizedWorkspacePhone;
        
        if (matches) {
          this.logger.log(`Account ${account.id} (${accountPhoneNumber}) matches whatsapp_web_phone_number: ${whatsappPhoneNumber}`);
        } else {
          this.logger.log(`Account ${account.id} (${accountPhoneNumber}) does not match whatsapp_web_phone_number: ${whatsappPhoneNumber}`);
        }
        
        return matches;
      });
      
      this.logger.log(`Filtered ${accounts.length} WhatsApp accounts from ${allAccounts.length} total accounts`);
      
      return {
        success: true,
        accounts,
      };
    } catch (error) {
      this.logger.error('Failed to get WhatsApp accounts:', error);
      throw error;
    }
  }

  private mapAccountStatus(account: any): 'connected' | 'disconnected' | 'pending' | 'connecting' {
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
        return 'pending';
      }

      if (status === 'connecting' || status === 'pending' || status === 'syncing') {
        return 'connecting';
      }
    }
    
    return account?.id ? 'connected' : 'disconnected';
  }

  @Post('accounts/:accountId')
  async getAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      this.logger.log(`Getting WhatsApp account ${accountId}`);
      const response = await this.makeUnipileRequest(`/api/v1/accounts/${accountId}`);
      return {
        success: true,
        account: response,
      };
    } catch (error) {
      // Handle 404 (account not found) gracefully
      if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) {
        this.logger.warn(`Account ${accountId} not found in Unipile`);
        return {
          success: false,
          account: null,
          error: 'Account not found',
        };
      }
      
      this.logger.error(`Failed to get WhatsApp account ${accountId}:`, error);
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
      this.logger.error(`Failed to resync WhatsApp account ${accountId}:`, error);
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
        message: 'WhatsApp account disconnected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to disconnect WhatsApp account ${accountId}:`, error);
      throw error;
    }
  }

  @Post('health')
  async getHealth() {
    return {
      service: 'WhatsApp Unipile Controller',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      unipile_configured: !!this.unipileAccessToken,
      unipile_url: this.unipileApiUrl,
    };
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
      this.logger.log('Received legacy WhatsApp account connected webhook:', payload);

      // Convert to new format and delegate to webhook service
      const convertedPayload: UnipileAccountStatusWebhook = {
        AccountStatus: {
          account_id: payload.account_id,
          account_type: 'WHATSAPP',
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

}

