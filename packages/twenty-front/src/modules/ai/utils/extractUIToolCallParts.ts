import { type AgentChatMessageUIToolCallPart } from '@/ai/types/AgentChatMessageUIToolCallPart';
import { type UIDataTypes, type UIMessagePart, type UITools } from 'ai';

const UI_TOOL_NAMES = new Set(['navigate_app', 'highlight_org_chart']);

const isUIToolCallPart = (part: UIMessagePart<UIDataTypes, UITools>): boolean =>
  part.type === 'tool-execute_tool' &&
  typeof part.input === 'object' &&
  part.input !== null &&
  'toolName' in part.input &&
  UI_TOOL_NAMES.has((part.input as { toolName?: string }).toolName ?? '');

export const extractUIToolCallParts = (
  messageParts: UIMessagePart<UIDataTypes, UITools>[],
): AgentChatMessageUIToolCallPart[] =>
  messageParts.filter(
    isUIToolCallPart,
  ) as unknown as AgentChatMessageUIToolCallPart[];
