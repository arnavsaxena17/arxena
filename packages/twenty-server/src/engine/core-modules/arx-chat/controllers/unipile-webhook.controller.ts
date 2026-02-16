import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import type {
  UnipileWebhookPayload
} from '../types/unipile-webhook.types';

@Controller('unipile-webhook')
export class UnipileWebhookController {
  private readonly logger = new Logger(UnipileWebhookController.name);

  constructor(private readonly webhookService: UnipileWebhookService) {}

  /**
   * Unified webhook endpoint for all Unipile webhook types
   * This endpoint handles: account status, new messages, emails, tracking, and relations
   * Supports both LinkedIn and WhatsApp webhooks
   * Note: This endpoint is not protected by JwtAuthGuard as it's called by Unipile servers
   */
  @Post('webhook')
  async handleUnipileWebhook(
    @Body() payload: UnipileWebhookPayload,
    @Req() request: any,
    @Res() response: any,
  ) {
    try {

      const unipileAuth = request.headers['unipile-auth'];
      if (unipileAuth && !this.webhookService.validateWebhookAuth(unipileAuth)) {
        return response.status(401).json({
          success: false,
          message: 'Unauthorized webhook request',
        });
      }
      await this.webhookService.processWebhook(payload);
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

