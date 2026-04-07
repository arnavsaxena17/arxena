import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { UnipileWebhookService } from '../services/unipile-webhook.service';
import type {
  UnipileNewRelationWebhook,
  UnipileWebhookPayload,
} from '../types/unipile-webhook.types';

@Controller('unipile-webhook')
export class UnipileWebhookController {
  private readonly logger = new Logger(UnipileWebhookController.name);
  private static readonly capturedWebhookEvents: Array<{
    receivedAt: string;
    payload: UnipileWebhookPayload;
  }> = [];

  constructor(private readonly webhookService: UnipileWebhookService) {}

  private ensureTestCaptureEnabled(response: any) {
    if (process.env.NODE_ENV === 'production') {
      response.status(404).json({
        success: false,
        message: 'Not found',
      });
      return false;
    }

    return true;
  }

  private captureWebhookPayload(payload: UnipileWebhookPayload) {
    UnipileWebhookController.capturedWebhookEvents.push({
      receivedAt: new Date().toISOString(),
      payload,
    });

    if (UnipileWebhookController.capturedWebhookEvents.length > 200) {
      UnipileWebhookController.capturedWebhookEvents.splice(
        0,
        UnipileWebhookController.capturedWebhookEvents.length - 200,
      );
    }
  }

  @Get('test-events')
  async getCapturedWebhookEvents(
    @Query('event') event: string | undefined,
    @Query('messageIncludes') messageIncludes: string | undefined,
    @Res() response: any,
  ) {
    if (!this.ensureTestCaptureEnabled(response)) {
      return;
    }

    const filteredEvents = UnipileWebhookController.capturedWebhookEvents.filter(
      (entry) => {
        const matchesEvent =
          !event ||
          ('event' in entry.payload && entry.payload.event === event);
        const payloadMessage =
          'message' in entry.payload ? entry.payload.message ?? '' : '';
        const matchesMessage =
          !messageIncludes ||
          String(payloadMessage).includes(messageIncludes);

        return matchesEvent && matchesMessage;
      },
    );

    return response.status(200).json({
      success: true,
      count: filteredEvents.length,
      events: filteredEvents,
    });
  }

  @Delete('test-events')
  async clearCapturedWebhookEvents(@Res() response: any) {
    if (!this.ensureTestCaptureEnabled(response)) {
      return;
    }

    UnipileWebhookController.capturedWebhookEvents.length = 0;

    return response.status(200).json({
      success: true,
      count: 0,
    });
  }

  @Post('relations')
  async handleRelationsWebhook(
    @Body() payload: UnipileNewRelationWebhook,
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
      await this.webhookService.processNewRelationWebhook(payload);
      return response.status(200).json({
        success: true,
        message: 'Relations webhook processed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to process relations webhook:', error);
      return response.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

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
      this.captureWebhookPayload(payload);
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
