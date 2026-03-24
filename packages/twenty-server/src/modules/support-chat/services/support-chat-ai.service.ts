import { Injectable, Logger } from '@nestjs/common';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';
import {
  NormalizedSupportChatEvent,
  SupportAiDecision,
} from 'src/modules/support-chat/types/chatwoot.types';

@Injectable()
export class SupportChatAiService {
  private readonly logger = new Logger(SupportChatAiService.name);

  constructor(
    private readonly llmChatModelService: LLMChatModelService,
  ) {}

  async decide(event: NormalizedSupportChatEvent): Promise<SupportAiDecision> {
    const content = event.content.toLowerCase();

    if (!content.trim()) {
      return {
        decision: 'ignore',
        summary: 'Ignored an empty or unsupported support event.',
        reason: 'empty-message',
        confidence: 'high',
      };
    }

    if (
      ['human', 'agent', 'representative', 'call me', 'talk to support'].some(
        (phrase) => content.includes(phrase),
      )
    ) {
      return {
        decision: 'handoff',
        summary: 'The visitor explicitly requested a human agent.',
        reason: 'visitor-requested-human',
        confidence: 'high',
      };
    }

    try {
      const model = this.llmChatModelService.getJSONChatModel();
      const response = await model.invoke([
        new SystemMessage(
          [
            'You are Arxena support triage.',
            'Return valid JSON only.',
            'Schema: {"decision":"reply|handoff|ignore","reply":"string","summary":"string","reason":"string","confidence":"low|medium|high"}',
            'Choose handoff when the request needs a human, billing/account-specific action, or you are uncertain.',
            'Choose ignore for non-customer or empty events.',
            'Reply briefly, helpfully, and in Arxena voice when safe.',
          ].join(' '),
        ),
        new HumanMessage(
          JSON.stringify({
            event: event.event,
            content: event.content,
            labels: event.labels,
            conversationStatus: event.conversationStatus,
            referer: event.referer,
            transcript: event.transcript.slice(-8),
            contact: event.contact,
          }),
        ),
      ]);

      const rawContent =
        typeof response.content === 'string'
          ? response.content
          : Array.isArray(response.content)
            ? response.content
                .map((item) =>
                  typeof item === 'string' ? item : JSON.stringify(item),
                )
                .join('')
            : JSON.stringify(response.content);

      const parsed = JSON.parse(rawContent) as SupportAiDecision;

      return {
        decision: parsed.decision ?? 'handoff',
        reply: parsed.reply,
        summary: parsed.summary ?? 'AI processed the support request.',
        reason: parsed.reason ?? 'llm-decision',
        confidence: parsed.confidence ?? 'medium',
      };
    } catch (error) {
      this.logger.error(
        `Falling back to handoff after AI failure: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return {
        decision: 'handoff',
        summary: 'The AI assistant could not confidently answer the request.',
        reason: 'ai-failure',
        confidence: 'low',
      };
    }
  }
}
