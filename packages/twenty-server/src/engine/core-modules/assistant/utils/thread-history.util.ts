import type {
  AssistantContentBlock,
  AssistantThreadMessage,
  MessageParam,
} from '../assistant.types';

const DEFAULT_LAST_K = 20;

export const threadMessagesToHistory = (
  messages: AssistantThreadMessage[],
  options?: { includeStatusMessages?: boolean; lastK?: number },
): MessageParam[] => {
  const out: MessageParam[] = [];
  const includeStatusMessages = options?.includeStatusMessages ?? true;
  const lastK = options?.lastK ?? DEFAULT_LAST_K;
  const slice = messages.slice(-lastK);

  slice.forEach((message, index) => {
    if (message.isStatus && !includeStatusMessages) {
      return;
    }

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

    const toolResults = (message.toolResults ?? [])
      .map((toolResult, toolIndex) => {
        const content = toolResult.content?.trim();

        if (!content) {
          return null;
        }

        return {
          type: 'tool_result' as const,
          tool_use_id: `tc-${index}-${toolIndex}`,
          content,
        };
      })
      .filter((toolResult) => toolResult !== null);

    if (toolResults.length > 0) {
      out.push({
        role: 'user',
        content: toolResults,
      });
    }
  });

  return out;
};
