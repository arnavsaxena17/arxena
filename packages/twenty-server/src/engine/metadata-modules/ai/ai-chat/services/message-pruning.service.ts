import { Injectable, Logger } from '@nestjs/common';

import { type ModelMessage, pruneMessages } from 'ai';

import { buildRestoredSkillsSection } from 'src/engine/metadata-modules/ai/ai-chat/utils/restore-pruned-skills.util';

const COMPACTION_THRESHOLD_RATIO = 0.9;
const TOOL_CALLS_PRESERVE_LAST_N_MESSAGES = 2;

export type PruningResult = {
  messages: ModelMessage[];
  wasPruned: boolean;
  isStillOverLimit: boolean;
  // Skills whose load_skills result pruning removed, for the system prompt
  restoredSkillsSection?: string;
};

@Injectable()
export class MessagePruningService {
  private readonly logger = new Logger(MessagePruningService.name);

  pruneIfOverContextWindowLimit(
    messages: ModelMessage[],
    contextWindowTokens: number,
    conversationSizeTokens: number,
  ): PruningResult {
    const threshold = contextWindowTokens * COMPACTION_THRESHOLD_RATIO;

    if (conversationSizeTokens < threshold) {
      return { messages, wasPruned: false, isStillOverLimit: false };
    }

    this.logger.log(
      `Conversation size ${conversationSizeTokens} exceeds threshold ${Math.round(threshold)} (${contextWindowTokens} * ${COMPACTION_THRESHOLD_RATIO}). Pruning messages.`,
    );

    const prunedMessages = pruneMessages({
      messages,
      reasoning: 'before-last-message',
      toolCalls: `before-last-${TOOL_CALLS_PRESERVE_LAST_N_MESSAGES}-messages`,
      emptyMessages: 'remove',
    });

    const wasPruned = prunedMessages.length < messages.length;

    if (wasPruned) {
      this.logger.log(
        `Pruned ${messages.length - prunedMessages.length} messages (${messages.length} → ${prunedMessages.length})`,
      );
    }

    const isStillOverLimit = !wasPruned;
    const restoredSkillsSection = wasPruned
      ? buildRestoredSkillsSection(messages, prunedMessages)
      : undefined;

    return {
      messages: prunedMessages,
      wasPruned,
      isStillOverLimit,
      restoredSkillsSection,
    };
  }
}
