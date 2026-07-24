import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import OpenAI from 'openai';
import { INTERNAL_TOOL_NAMES } from '../mcp-assistant.constants';
import { mcpToolsToOpenAITools } from './mcp-assistant-openai-mapping.util';

export const fetchAnthropicTools = async (
  client: Client,
): Promise<Anthropic.Messages.Tool[]> => {
  const toolsResult = await client.listTools();
  return toolsResult.tools
    .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name))
    .map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: {
        type: 'object' as const,
        ...(typeof t.inputSchema === 'object' && t.inputSchema !== null
          ? (t.inputSchema as Record<string, unknown>)
          : {}),
      },
    })) as Anthropic.Messages.Tool[];
};

export const fetchOpenAITools = async (
  client: Client,
): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> => {
  const toolsResult = await client.listTools();
  return mcpToolsToOpenAITools(
    toolsResult.tools
      .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description ?? '',
        input_schema: t.inputSchema,
      })),
  );
};
