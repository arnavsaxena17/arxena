import OpenAI from 'openai';

export const mcpToolsToOpenAITools = (
  tools: Array<{ name: string; description: string; input_schema: unknown }>,
): OpenAI.Chat.Completions.ChatCompletionTool[] => {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters:
        typeof t.input_schema === 'object' && t.input_schema !== null
          ? (t.input_schema as Record<string, unknown>)
          : { type: 'object', properties: {} },
    },
  }));
};
