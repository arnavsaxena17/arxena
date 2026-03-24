import { Injectable, Logger } from '@nestjs/common';

import { SupportChatConfigService } from 'src/modules/support-chat/services/support-chat-config.service';

@Injectable()
export class ChatwootClientService {
  private readonly logger = new Logger(ChatwootClientService.name);

  constructor(
    private readonly supportChatConfigService: SupportChatConfigService,
  ) {}

  async sendMessage(args: {
    conversationId: string;
    content: string;
    messageType?: 'outgoing' | 'incoming';
    private?: boolean;
  }) {
    const { conversationId, content, messageType = 'outgoing', private: isPrivate = false } = args;

    if (!this.supportChatConfigService.isChatwootEnabled()) {
      return { skipped: true };
    }

    const { baseUrl, accountId, apiAccessToken } =
      this.supportChatConfigService.getChatwootApiConfig();

    const response = await fetch(
      `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_access_token: apiAccessToken,
        },
        body: JSON.stringify({
          content,
          message_type: messageType,
          private: isPrivate,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Failed to send Chatwoot message (${response.status}): ${errorText}`,
      );
      throw new Error('Failed to send Chatwoot message');
    }

    return response.json();
  }
}
