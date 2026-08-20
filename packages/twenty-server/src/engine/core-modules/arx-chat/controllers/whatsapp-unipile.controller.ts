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
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import {
    findWhatsappUnipileAccountBlockingNewConnectionForProfile,
    type UnipileWhatsappAccount,
} from 'twenty-shared';
import { UnipileV2Client } from 'src/engine/core-modules/unipile-client/unipile-v2.client';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import { WhatsappUnipileRequestService } from '../services/whatsapp-unipile-request.service';
import { WhatsappUnipileSyncService } from '../services/whatsapp-unipile/whatsapp-unipile-sync.service';
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
  private readonly unipileV2Client: UnipileV2Client;

  constructor(
    private readonly webhookService: UnipileWebhookService,
    private readonly unipileRequestService: WhatsappUnipileRequestService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly whatsappUnipileSyncService: WhatsappUnipileSyncService,
    unipileV2Client: UnipileV2Client,
  ) {
    this.unipileV2Client = unipileV2Client;
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(`Unipile Access Token configured: ${!!this.unipileAccessToken}`);
  }

  @Post('accounts/update-member')
  async updateMemberWhatsappAccount(
    @Body() body: { accountId: string },
    @AuthWorkspace() workspace : WorkspaceEntity,
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
        `/v2/accounts/${newId}`,
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
    @AuthWorkspace() workspace : WorkspaceEntity,
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
                `/v2/accounts/${blocking.id}`,
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

      const response = (await this.unipileV2Client.startAuthIntent({
        provider: 'whatsapp',
        credentials: { qrcode: true },
      })) as {
        qrcode?: string;
        qrCodeString?: string;
        intent_id?: string;
        account_id?: string;
        id?: string;
        object?: string;
      };

      return {
        success: true,
        qrCodeString: response.qrcode || response.qrCodeString || '',
        code: '',
        intent_id: response.intent_id,
        account_id: response.intent_id || response.account_id || response.id,
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
    @AuthWorkspace() workspace : WorkspaceEntity,
    @Req() request: { workspaceMemberId?: string; headers?: { authorization?: string } },
  ) {
   try {
      this.logger.log(`Checking account status for account ${accountId}`);
      let response: Record<string, unknown> & {
        id?: string;
        object?: string;
        intent_id?: string;
        connection_params?: { status?: string; im?: { status?: string } };
        status?: string;
        sources?: { status?: string }[];
      };
      try {
        response = (await this.unipileRequestService.makeUnipileRequest(
          `/v2/accounts/${accountId}`,
        )) as typeof response;
      } catch (error) {
        const checkpoint = (await this.unipileV2Client.solveCheckpoint({
          intent_id: accountId,
          code: '',
        })) as typeof response;
        if (checkpoint?.object === 'Account' || checkpoint?.id) {
          response = checkpoint;
        } else {
          return {
            success: true,
            status: 'connecting',
            account: checkpoint,
          };
        }
      }
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
  async getAllAccounts(@AuthWorkspace() workspace : WorkspaceEntity) {
    return this.unipileRequestService.getAllAccounts(workspace);
  }

  @Post('accounts/:accountId')
  async getAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace : WorkspaceEntity,
  ) {
    try {
      this.logger.log(`Getting WhatsApp account ${accountId}`);
      const response = await this.unipileRequestService.makeUnipileRequest(
        `/v2/accounts/${accountId}`,
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

  /**
   * Check whether a phone number is registered on WhatsApp.
   * Uses Unipile GET /v2/:account_id/users/{identifier}
   * (https://developer.unipile.com/reference/userscontroller_getprofilebyidentifier)
   *
   * Body: { phoneNumber: string; accountId?: string }
   * phoneNumber: E.164 digits (e.g. 33612345678). Symbols are stripped.
   * accountId: optional; defaults to the caller's linked WhatsApp Unipile account.
   */
  @Post('check-number')
  async checkIfNumberOnWhatsApp(
    @Body() body: { phoneNumber?: string; accountId?: string },
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Req() request: {
      workspaceMemberId?: string;
      headers?: { authorization?: string };
    },
  ) {
    const phoneNumber = body?.phoneNumber?.trim() ?? '';

    if (!phoneNumber) {
      throw new HttpException(
        'phoneNumber is required (E.164 digits, e.g. 33612345678)',
        HttpStatus.BAD_REQUEST,
      );
    }

    let accountId = body?.accountId?.trim() ?? '';

    if (!accountId) {
      const workspaceMemberId = request.workspaceMemberId;
      const authToken =
        request.headers?.authorization?.replace(/^Bearer\s+/i, '') ?? '';

      if (!workspaceMemberId || !authToken) {
        throw new HttpException(
          'accountId is required when no linked WhatsApp Unipile account can be resolved',
          HttpStatus.BAD_REQUEST,
        );
      }

      const resolvedAccountId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          workspace.id,
          authToken,
          'whatsapp',
        );

      if (!resolvedAccountId) {
        throw new HttpException(
          'No WhatsApp Unipile account linked to this workspace member; pass accountId or connect WhatsApp first',
          HttpStatus.BAD_REQUEST,
        );
      }

      accountId = resolvedAccountId;
    }

    try {
      this.logger.log(
        `Checking WhatsApp presence for ${phoneNumber} via account ${accountId}`,
      );

      const result =
        await this.unipileRequestService.checkIfPhoneNumberOnWhatsApp({
          phoneNumber,
          accountId,
        });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to check WhatsApp number:', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to check WhatsApp number',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync-messages')
  async syncMessages(
    @Body()
    body: { phoneNumber: string; candidateId: string; limit?: number },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const authHeader = request.headers?.authorization;
    const apiToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!apiToken) {
      throw new HttpException('Authorization required', HttpStatus.UNAUTHORIZED);
    }

    const { phoneNumber, candidateId, limit = 250 } = body;

    if (!phoneNumber?.trim()) {
      throw new HttpException('phoneNumber is required', HttpStatus.BAD_REQUEST);
    }

    if (!candidateId?.trim()) {
      throw new HttpException('candidateId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(
        `Syncing WhatsApp Unipile messages for candidate ${candidateId}, phone ${phoneNumber}`,
      );

      const data = await this.whatsappUnipileSyncService.syncMessagesForCandidate({
        phoneNumber: phoneNumber.trim(),
        candidateId: candidateId.trim(),
        apiToken,
        limit,
      });

      return {
        status: 'ok',
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to sync WhatsApp Unipile messages:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to sync messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('accounts/:accountId/resync')
  async resyncAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace : WorkspaceEntity,
  ) {
    try {
      return {
        success: true,
        status: 'skipped',
        message:
          'Unipile v2 does not support account resync; WhatsApp uses platform initial sync after link.',
      };
    } catch (error) {
      this.logger.error(`Failed to resync WhatsApp account ${accountId}:`, error);
      throw error;
    }
  }

  @Delete('accounts/:accountId')
  async disconnectAccount(
    @Param('accountId') accountId: string,
    @AuthWorkspace() workspace : WorkspaceEntity,
  ) {
    try {
      await this.unipileRequestService.makeUnipileRequest(
        `/v2/accounts/${accountId}`,
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

