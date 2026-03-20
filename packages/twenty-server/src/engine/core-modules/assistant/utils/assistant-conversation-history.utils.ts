import {
    AssistantChatRequestBody,
    AssistantContentBlock,
    MessageParam,
} from 'src/engine/core-modules/assistant/assistant.types';

export type NormalizedAssistantConversationMessage = MessageParam;

export const normalizeAssistantConversationHistory = (
  conversationHistory: AssistantChatRequestBody['conversationHistory'],
): NormalizedAssistantConversationMessage[] => {
  return (conversationHistory ?? []).map(
    (
      m,
    ): MessageParam => {
      if (m.role === 'user') {
        if (Array.isArray(m.content)) {
          return {
            role: 'user',
            content: m.content as Array<{
              type: 'tool_result';
              tool_use_id: string;
              content: string;
            }>,
          };
        }

        return {
          role: 'user',
          content: String(m.content),
        };
      }
      const content: AssistantContentBlock[] = Array.isArray(m.content)
        ? (m.content as AssistantContentBlock[])
        : [{ type: 'text', text: String(m.content) }];

      return { role: 'assistant', content };
    },
  );
};
