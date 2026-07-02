import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import {
    CapturedTestWebhookEvent,
    TestWebhookPayload,
} from 'src/engine/core-modules/test-webhook/types/test-webhook-payload.type';
import { verifyTwentyWebhookSignature } from 'src/engine/core-modules/test-webhook/utils/verify-twenty-webhook-signature.util';

const MAX_CAPTURED_EVENTS = 200;

@Injectable()
export class TestWebhookService {
  private readonly logger = new Logger(TestWebhookService.name);
  private readonly capturedEvents: CapturedTestWebhookEvent[] = [];

  constructor(private readonly environmentService: EnvironmentService) {}

  captureWebhookEvent({
    payload,
    signature,
    timestamp,
    nonce,
  }: {
    payload: TestWebhookPayload;
    signature?: string;
    timestamp?: string;
    nonce?: string;
  }): CapturedTestWebhookEvent {
    const signatureValid = this.verifySignature({
      payload,
      signature,
      timestamp,
    });

    const capturedEvent: CapturedTestWebhookEvent = {
      receivedAt: new Date().toISOString(),
      headers: {
        signature,
        timestamp,
        nonce,
      },
      signatureValid,
      payload,
    };

    this.capturedEvents.push(capturedEvent);

    if (this.capturedEvents.length > MAX_CAPTURED_EVENTS) {
      this.capturedEvents.splice(
        0,
        this.capturedEvents.length - MAX_CAPTURED_EVENTS,
      );
    }

    this.logger.log(
      `Captured test webhook eventName=${payload.eventName} webhookId=${payload.webhookId} signatureValid=${signatureValid}`,
    );

    return capturedEvent;
  }

  listCapturedEvents({
    eventName,
    objectName,
  }: {
    eventName?: string;
    objectName?: string;
  }): CapturedTestWebhookEvent[] {
    return this.capturedEvents.filter((entry) => {
      const matchesEventName =
        !eventName || entry.payload.eventName === eventName;
      const matchesObjectName =
        !objectName ||
        entry.payload.objectMetadata.nameSingular === objectName;

      return matchesEventName && matchesObjectName;
    });
  }

  clearCapturedEvents(): void {
    this.capturedEvents.length = 0;
  }

  canViewCapturedEvents(viewKey: string | undefined): boolean {
    const configuredViewKey =
      this.environmentService.get('TEST_WEBHOOK_VIEW_SECRET');

    if (!configuredViewKey) {
      return process.env.NODE_ENV !== 'production';
    }

    return viewKey === configuredViewKey;
  }

  private verifySignature({
    payload,
    signature,
    timestamp,
  }: {
    payload: TestWebhookPayload;
    signature?: string;
    timestamp?: string;
  }): boolean | null {
    if (!signature || !timestamp) {
      return null;
    }

    const secret = this.environmentService.get('TEST_WEBHOOK_SECRET');

    if (!secret) {
      return null;
    }

    return verifyTwentyWebhookSignature({
      payload,
      secret,
      timestamp,
      signature,
    });
  }
}
