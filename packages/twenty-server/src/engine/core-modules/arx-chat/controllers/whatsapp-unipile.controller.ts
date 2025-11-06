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
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import type {
    UnipileAccountStatusWebhook,
    UnipileWebhookPayload,
} from '../types/unipile-webhook.types';

@Controller('whatsapp-unipile')
@UseGuards(JwtAuthGuard)
export class WhatsappUnipileController {
  private readonly logger = new Logger(WhatsappUnipileController.name);

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
        this.logger.error(`Unipile API error: ${response.status} ${response.statusText}`, errorData);
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

  /**
   * Request QR code for WhatsApp connection
   */
  @Post('qr-code')
  async requestQrCode(@AuthWorkspace() workspace: Workspace) {
    try {
      this.logger.log(`Requesting WhatsApp QR code for workspace: ${workspace.id}`);
      
      // Generate notify_url for webhook callbacks
      const notifyUrl = `${process.env.SERVER_URL}/whatsapp-unipile/webhook/account-connected`;
      
      const response = await this.makeUnipileRequest('/api/v1/accounts/whatsapp', 'POST', {
        notify_url: notifyUrl,
        name: workspace.id,
      });

      return {
        success: true,
        qrCodeString: response.qr_code || response.qrCodeString,
        code: response.code,
        account_id: response.account_id || response.id,
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
      const response = await this.makeUnipileRequest(`/api/v1/accounts/${accountId}`);
      
      const status = this.mapAccountStatus(response);
      
      return {
        success: true,
        status,
        account_id: response.id,
      };
    } catch (error) {
      this.logger.error(`Failed to check account status for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get all WhatsApp accounts
   */
  @Post('accounts')
  async getAllAccounts(@AuthWorkspace() workspace: Workspace) {
    try {
      const response = await this.makeUnipileRequest('/api/v1/accounts?provider=whatsapp');
      this.logger.log('getAllAccounts response', response);
      
      // Transform the response to match our expected format
      const accounts = (response.items || []).map((item: any) => ({
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
    if (account.connection_params && account.connection_params.status) {
      const status = account.connection_params.status.toLowerCase();
      if (status === 'active' || status === 'ok' || status === 'connected') {
        return 'connected';
      }
      if (status === 'credentials' || status === 'failed') {
        return 'disconnected';
      }
      if (status === 'checkpoint_required') {
        return 'pending';
      }
      if (status === 'connecting' || status === 'pending') {
        return 'connecting';
      }
      return 'disconnected';
    }
    
    return account.id ? 'connected' : 'disconnected';
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

  /**
   * Main webhook endpoint for all Unipile webhook types
   * This endpoint handles: account status, new messages, etc.
   * Note: This endpoint is not protected by JwtAuthGuard as it's called by Unipile servers
   */
  @Post('webhook')
  async handleUnipileWebhook(
    @Body() payload: UnipileWebhookPayload,
    @Req() request: any,
    @Res() response: any,
  ) {
    try {
      this.logger.log('Received Unipile WhatsApp webhook');

      // Validate webhook authentication if Unipile-Auth header is present
      const unipileAuth = request.headers['unipile-auth'];
      if (unipileAuth && !this.webhookService.validateWebhookAuth(unipileAuth)) {
        return response.status(401).json({
          success: false,
          message: 'Unauthorized webhook request',
        });
      }

      // Process webhook using the dedicated service
      await this.webhookService.processWebhook(payload);

      // Return 200 status within 30 seconds as required by Unipile
      return response.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to process Unipile webhook:', error);
      return response.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

