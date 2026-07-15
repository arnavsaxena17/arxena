import type { MessageQueueJobData } from 'src/engine/core-modules/message-queue/interfaces/message-queue-job.interface';

import type {
  UnipileNewRelationWebhook,
  UnipileWebhookPayload,
} from '../types/unipile-webhook.types';

export type UnipileWebhookJobKind = 'webhook' | 'relations';

export type UnipileWebhookJobData = MessageQueueJobData & {
  kind: UnipileWebhookJobKind;
  payload: UnipileWebhookPayload | UnipileNewRelationWebhook;
  receivedAt: string;
};

export const UNIPILE_WEBHOOK_PROCESSOR_NAME = 'UnipileWebhookProcessor';
