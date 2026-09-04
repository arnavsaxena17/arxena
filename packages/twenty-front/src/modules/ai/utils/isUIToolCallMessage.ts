import { type ExtendedUIMessage } from 'twenty-shared/ai';

type ToolCallInput = { toolName?: string };

const UI_TOOL_NAMES = new Set(['navigate_app', 'highlight_org_chart']);

const isToolCallInput = (value: unknown): value is ToolCallInput =>
  typeof value === 'object' && value !== null && 'toolName' in value;

export const isUIToolCallMessage = (message: ExtendedUIMessage) => {
  return message.parts.some(
    (part) =>
      part.type === 'tool-execute_tool' &&
      isToolCallInput(part.input) &&
      typeof part.input.toolName === 'string' &&
      UI_TOOL_NAMES.has(part.input.toolName),
  );
};
