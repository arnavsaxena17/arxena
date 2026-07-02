import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';

import { TestWebhookService } from 'src/engine/core-modules/test-webhook/test-webhook.service';
import { TestWebhookPayload } from 'src/engine/core-modules/test-webhook/types/test-webhook-payload.type';

@Controller('test-webhook')
export class TestWebhookController {
  private readonly logger = new Logger(TestWebhookController.name);

  constructor(private readonly testWebhookService: TestWebhookService) {}

  private ensureViewAccess(viewKey: string | undefined): void {
    if (!this.testWebhookService.canViewCapturedEvents(viewKey)) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
  }

  @Post('webhook')
  receiveWebhook(
    @Body() payload: TestWebhookPayload,
    @Headers('x-twenty-webhook-signature') signature?: string,
    @Headers('x-twenty-webhook-timestamp') timestamp?: string,
    @Headers('x-twenty-webhook-nonce') nonce?: string,
  ): { success: true; receivedAt: string; signatureValid: boolean | null } {
    const capturedEvent = this.testWebhookService.captureWebhookEvent({
      payload,
      signature,
      timestamp,
      nonce,
    });
    this.logger.log(`Received test webhook for ${payload.eventName} on ${payload.objectMetadata.nameSingular}`);
    this.logger.log(`Signature: ${signature}`);
    this.logger.log(`Timestamp: ${timestamp}`);
    this.logger.log(`Nonce: ${nonce}`);
    this.logger.log(`Payload: ${JSON.stringify(payload)}`);

    return {
      success: true,
      receivedAt: capturedEvent.receivedAt,
      signatureValid: capturedEvent.signatureValid,
    };
  }

  @Get('events')
  listCapturedEvents(
    @Headers('x-test-webhook-view-key') viewKey: string | undefined,
    @Query('eventName') eventName?: string,
    @Query('objectName') objectName?: string,
  ): {
    success: true;
    count: number;
    events: ReturnType<TestWebhookService['listCapturedEvents']>;
  } {
    this.ensureViewAccess(viewKey);

    const events = this.testWebhookService.listCapturedEvents({
      eventName,
      objectName,
    });

    return {
      success: true,
      count: events.length,
      events,
    };
  }

  @Delete('events')
  clearCapturedEvents(
    @Headers('x-test-webhook-view-key') viewKey: string | undefined,
  ): { success: true; count: number } {
    this.ensureViewAccess(viewKey);
    this.testWebhookService.clearCapturedEvents();

    return {
      success: true,
      count: 0,
    };
  }
}
