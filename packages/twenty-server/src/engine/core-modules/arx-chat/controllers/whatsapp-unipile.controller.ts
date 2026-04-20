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
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import {
    findWhatsappUnipileAccountBlockingNewConnectionForProfile,
    type UnipileWhatsappAccount,
} from 'twenty-shared';
import { UnipileClient } from 'unipile-node-sdk';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import { WhatsappUnipileRequestService } from '../services/whatsapp-unipile-request.service';
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
    private readonly unipileRequestService: WhatsappUnipileRequestService,
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

  @Post('accounts/update-member')
  async updateMemberWhatsappAccount(
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
    let previousWhatsappUnipileId: string | null = null;
    try {
      previousWhatsappUnipileId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          workspace.id,
          authToken,
          'whatsapp',
        );
    } catch {
      previousWhatsappUnipileId = null;
    }
    const newId = body.accountId.trim();
    try {
      const account = await this.unipileRequestService.makeUnipileRequest(
        `/api/v1/accounts/${newId}`,
      );
      await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
        workspaceMemberId,
        authToken,
        'whatsapp',
        newId,
        account,
      );
      if (previousWhatsappUnipileId && previousWhatsappUnipileId !== newId) {
        await this.unipileRequestService.disconnectAccountBestEffort(
          previousWhatsappUnipileId,
          'superseded WhatsApp Unipile account after manual member update',
        );
      }
    } catch (err) {
      this.logger.warn(
        `Could not sync WhatsApp phone to workspace member profile: ${err instanceof Error ? err.message : err}`,
      );
    }
    return { success: true };
  }

  /**
   * Request QR code for WhatsApp connection
   * Uses Unipile SDK's connectWhatsapp() method
   */
  @Post('qr-code')
  async requestQrCode(
    @AuthWorkspace() workspace: Workspace,
    @Req() request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    try {
      this.logger.log(`Requesting WhatsApp QR code for workspace: ${workspace.id}`);

      const workspaceMemberId = request.workspaceMemberId;
      const authToken =
        request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

      if (workspaceMemberId && authToken) {
        const profile =
          await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
            workspaceMemberId,
            authToken,
          );
        // Unipile accounts API is source of truth; profile fields are only used to pick the matching row.
        const { accounts } =
          await this.unipileRequestService.getAllAccounts(workspace);
        const blocking =
          findWhatsappUnipileAccountBlockingNewConnectionForProfile(
            accounts as unknown as UnipileWhatsappAccount[],
            profile,
          );
        if (blocking?.id) {
          try {
            const accountPayload =
              await this.unipileRequestService.makeUnipileRequest(
                `/api/v1/accounts/${blocking.id}`,
              );
            await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
              workspaceMemberId,
              authToken,
              'whatsapp',
              blocking.id,
              accountPayload,
            );
          } catch (syncErr) {
            this.logger.warn(
              `Could not sync existing WhatsApp Unipile account to profile: ${syncErr instanceof Error ? syncErr.message : syncErr}`,
            );
          }
          return {
            success: true,
            alreadyConnected: true,
            qrCodeString: '',
            code: '',
            account_id: blocking.id,
          };
        }
      }

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
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
   try {
      this.logger.log(`Checking account status for account ${accountId}`);
      const response = (await this.unipileRequestService.makeUnipileRequest(
        `/api/v1/accounts/${accountId}`,
      )) as Record<string, unknown> & {
        id?: string;
        connection_params?: { status?: string; im?: { status?: string } };
        status?: string;
        sources?: { status?: string }[];
      };
      // this.logger.log(`Account status response: ${JSON.stringify(response)}`);
      const status = this.unipileRequestService.mapAccountStatus(response);

      if (status === 'connected') {
        const workspaceMemberId = request.workspaceMemberId;
        const authToken =
          request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

        if (workspaceMemberId && authToken && response?.id) {
          const existingId =
            await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
              workspaceMemberId,
              workspace.id,
              authToken,
              'whatsapp',
            );

          if (existingId !== response.id) {
            try {
              await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
                workspaceMemberId,
                authToken,
                'whatsapp',
                response.id,
                response,
              );
              if (existingId && existingId !== response.id) {
                await this.unipileRequestService.disconnectAccountBestEffort(
                  existingId,
                  'superseded WhatsApp Unipile account after new QR connect (same member)',
                );
              }
            } catch (syncErr) {
              this.logger.warn(
                `Could not sync WhatsApp account to workspace member profile after connect: ${syncErr instanceof Error ? syncErr.message : syncErr}`,
              );
            }
          }
        }
      }

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
    return this.unipileRequestService.getAllAccounts(workspace);
  }

  @Post('accounts/:accountId')
  async getAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      this.logger.log(`Getting WhatsApp account ${accountId}`);
      const response = await this.unipileRequestService.makeUnipileRequest(
        `/api/v1/accounts/${accountId}`,
      );
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
      const response = (await this.unipileRequestService.makeUnipileRequest(
        `/api/v1/accounts/${accountId}/resync`,
        'POST',
      )) as { status?: unknown };
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
      await this.unipileRequestService.makeUnipileRequest(
        `/api/v1/accounts/${accountId}`,
        'DELETE',
      );
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

