import { Injectable, Logger } from '@nestjs/common';

import { createHmac, timingSafeEqual } from 'crypto';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { SupportChatAiService } from 'src/modules/support-chat/services/support-chat-ai.service';
import { ChatwootClientService } from 'src/modules/support-chat/services/chatwoot-client.service';
import { SupportChatConfigService } from 'src/modules/support-chat/services/support-chat-config.service';
import { SupportChatSyncService } from 'src/modules/support-chat/services/support-chat-sync.service';
import {
  ChatwootWebhookPayload,
  NormalizedSupportChatEvent,
} from 'src/modules/support-chat/types/chatwoot.types';

const DELIVERY_TTL_SECONDS = 60 * 60 * 6;
const HANDOFF_TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class SupportChatOrchestratorService {
  private readonly logger = new Logger(SupportChatOrchestratorService.name);

  constructor(
    private readonly redisClientService: RedisClientService,
    private readonly supportChatConfigService: SupportChatConfigService,
    private readonly supportChatAiService: SupportChatAiService,
    private readonly supportChatSyncService: SupportChatSyncService,
    private readonly chatwootClientService: ChatwootClientService,
  ) {}

  getBootstrapPayload() {
    return {
      ok: true,
      support: this.supportChatConfigService.getPublicWidgetConfig(),
    };
  }

  async markConversationForHandoff(conversationId: string, reason: string) {
    if (!conversationId) {
      return { ok: false, reason: 'missing-conversation-id' };
    }

    const redis = this.redisClientService.getClient();

    await redis.set(
      this.getHandoffKey(conversationId),
      JSON.stringify({ reason, at: new Date().toISOString() }),
      'EX',
      HANDOFF_TTL_SECONDS,
    );

    return { ok: true, conversationId, reason };
  }

  async handleWebhookPayload(args: {
    signature?: string;
    timestamp?: string;
    deliveryId?: string;
    rawBody: Buffer | Uint8Array;
  }) {
    const { signature, timestamp, deliveryId, rawBody } = args;

    this.verifySignature(signature, timestamp, rawBody);

    const rawText = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : Buffer.from(rawBody).toString('utf8');
    const payload = JSON.parse(rawText) as ChatwootWebhookPayload;
    const normalized = this.normalizePayload(payload, deliveryId);

    if (!normalized) {
      return { ok: true, ignored: true, reason: 'unsupported-payload' };
    }

    const redis = this.redisClientService.getClient();
    const dedupeKey = this.getDeliveryKey(normalized.deliveryId);
    const alreadyProcessed = await redis.set(dedupeKey, '1', 'EX', DELIVERY_TTL_SECONDS, 'NX');

    if (alreadyProcessed !== 'OK') {
      return { ok: true, ignored: true, reason: 'duplicate-delivery' };
    }

    if (
      normalized.messageType !== 'incoming' ||
      normalized.isPrivate ||
      !normalized.content.trim()
    ) {
      return { ok: true, ignored: true, reason: 'non-customer-message' };
    }

    const aiDecision = this.supportChatConfigService.isAiEnabled()
      ? await this.supportChatAiService.decide(normalized)
      : {
          decision: 'ignore' as const,
          summary: 'AI auto-reply is disabled for support chat.',
          reason: 'ai-disabled',
          confidence: 'high' as const,
        };

    await this.supportChatSyncService.syncConversation(normalized, aiDecision);

    if (await this.isConversationInHandoff(normalized.conversationId)) {
      return { ok: true, ignored: true, reason: 'conversation-in-handoff' };
    }

    if (normalized.labels.some((label) => label.toLowerCase().includes('human'))) {
      await this.markConversationForHandoff(
        normalized.conversationId,
        'human-label-present',
      );
      return { ok: true, action: 'handoff' };
    }

    if (aiDecision.decision === 'reply' && aiDecision.reply?.trim()) {
      await this.chatwootClientService.sendMessage({
        conversationId: normalized.conversationId,
        content: aiDecision.reply,
      });
      return { ok: true, action: 'reply' };
    }

    if (aiDecision.decision === 'handoff') {
      await this.markConversationForHandoff(
        normalized.conversationId,
        aiDecision.reason,
      );
      return { ok: true, action: 'handoff' };
    }

    return { ok: true, action: 'ignore' };
  }

  private async isConversationInHandoff(conversationId: string) {
    const redis = this.redisClientService.getClient();
    const value = await redis.get(this.getHandoffKey(conversationId));

    return Boolean(value);
  }

  private verifySignature(
    signature: string | undefined,
    timestamp: string | undefined,
    rawBody: Buffer | Uint8Array,
  ) {
    if (!this.supportChatConfigService.isChatwootEnabled()) {
      throw new Error('Support chat is not configured for Chatwoot');
    }

    if (!signature || !timestamp) {
      throw new Error('Missing Chatwoot webhook signature headers');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const webhookTimestamp = Number(timestamp);

    if (
      Number.isNaN(webhookTimestamp) ||
      Math.abs(nowSeconds - webhookTimestamp) > 60 * 5
    ) {
      throw new Error('Stale Chatwoot webhook timestamp');
    }

    const secret = this.supportChatConfigService.getChatwootWebhookSecret();
    const rawText = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : Buffer.from(rawBody).toString('utf8');
    const payload = `${timestamp}.${rawText}`;
    const expected = `sha256=${createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new Error('Invalid Chatwoot webhook signature');
    }
  }

  private normalizePayload(
    payload: ChatwootWebhookPayload,
    deliveryId?: string,
  ): NormalizedSupportChatEvent | null {
    const conversation = payload.conversation ?? payload.current_conversation;
    const conversationId = String(conversation?.id ?? '');

    if (!payload.event || !conversationId) {
      return null;
    }

    const transcriptSources = [
      ...(conversation?.messages ?? []),
      payload.content
        ? [
            {
              content: payload.content,
              message_type: payload.message_type,
            },
          ]
        : [],
    ];

    return {
      event: payload.event,
      deliveryId:
        deliveryId ??
        `${payload.event}:${conversationId}:${String(payload.id ?? payload.created_at ?? Date.now())}`,
      conversationId,
      displayId: conversation?.display_id
        ? String(conversation.display_id)
        : undefined,
      content: payload.content ?? '',
      messageType: this.normalizeMessageType(payload.message_type),
      isPrivate: payload.private === true,
      conversationStatus: conversation?.status ?? undefined,
      createdAt: this.normalizeTimestamp(payload.created_at),
      labels: conversation?.labels ?? [],
      contact: {
        id: payload.contact?.id ? String(payload.contact.id) : undefined,
        name:
          payload.contact?.name ??
          conversation?.meta?.sender?.name ??
          undefined,
        email:
          payload.contact?.email ??
          conversation?.meta?.sender?.email ??
          undefined,
        phoneNumber: payload.contact?.phone_number ?? undefined,
        identifier: payload.contact?.identifier ?? undefined,
      },
      sender: {
        id: payload.sender?.id ? String(payload.sender.id) : undefined,
        name: payload.sender?.name ?? payload.user?.name ?? undefined,
        email: payload.sender?.email ?? payload.user?.email ?? undefined,
        type: payload.sender?.type ?? payload.user?.type ?? undefined,
      },
      accountId: payload.account?.id ? String(payload.account.id) : undefined,
      inboxId: conversation?.inbox_id ? String(conversation.inbox_id) : undefined,
      referer:
        conversation?.additional_attributes?.referer ??
        payload.event_info?.referer ??
        undefined,
      sourceId:
        payload.source_id ??
        conversation?.contact_inbox?.source_id ??
        undefined,
      transcript: transcriptSources
        .map((message) => {
          const typedMessage = message as {
            content?: string;
            message_type?: string | number | null;
          };
          const role =
            this.normalizeMessageType(typedMessage.message_type) === 'incoming'
              ? 'visitor'
              : 'agent';

          return typedMessage.content
            ? `${role}: ${typedMessage.content}`
            : null;
        })
        .filter((line): line is string => line !== null)
        .slice(-10),
      rawPayload: payload,
    };
  }

  private normalizeMessageType(
    messageType: string | number | null | undefined,
  ): 'incoming' | 'outgoing' | 'template' | 'unknown' {
    if (messageType === 'incoming' || messageType === 0) {
      return 'incoming';
    }

    if (messageType === 'outgoing' || messageType === 1) {
      return 'outgoing';
    }

    if (messageType === 'template' || messageType === 2) {
      return 'template';
    }

    return 'unknown';
  }

  private normalizeTimestamp(createdAt: string | number | undefined) {
    if (typeof createdAt === 'number') {
      return new Date(createdAt * 1000).toISOString();
    }

    if (typeof createdAt === 'string') {
      const date = new Date(createdAt);

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    return undefined;
  }

  private getDeliveryKey(deliveryId: string) {
    return `support-chat:delivery:${deliveryId}`;
  }

  private getHandoffKey(conversationId: string) {
    return `support-chat:handoff:${conversationId}`;
  }
}
