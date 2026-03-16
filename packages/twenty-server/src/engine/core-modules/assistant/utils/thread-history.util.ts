import type {
  AssistantContentBlock,
  AssistantThreadMessage,
  MessageParam,
} from '../assistant.types';

const DEFAULT_LAST_K = 20;

export const threadMessagesToHistory = (
  messages: AssistantThreadMessage[],
  options?: { lastK?: number },
): MessageParam[] => {
  const out: MessageParam[] = [];
  const lastK = options?.lastK ?? DEFAULT_LAST_K;
  const slice = messages.slice(-lastK);

  slice.forEach((message, index) => {
    if (message.role === 'user') {
      out.push({ role: 'user', content: message.content });
      return;
    }

    const contentBlocks: AssistantContentBlock[] = [
      ...(message.content
        ? [
            {
              type: 'text' as const,
              text: message.content,
            },
          ]
        : []),
      ...(message.toolCalls ?? []).map((toolCall, toolIndex) => ({
        type: 'tool_use' as const,
        id: `tc-${index}-${toolIndex}`,
        name: toolCall.name,
        input: toolCall.args ?? {},
      })),
    ];

    if (contentBlocks.length > 0) {
      out.push({
        role: 'assistant',
        content: contentBlocks,
      });
    }
  });

  return out;
};

