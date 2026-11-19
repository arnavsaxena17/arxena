import { isNonEmptyString } from '@sniptt/guards';
import { asSchema, type ToolSet } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import {
  fenceValueForLog,
  formatValueForLog,
} from 'src/engine/core-modules/tool-provider/utils/format-value-for-log.util';

// Nest writes log lines verbatim, so this does not render markdown: it lays the
// block out so headings and fences read in a terminal. Tool payloads go through
// formatValueForLog, which prints long strings as their own text instead of one
// line of \n escapes.
const MAX_SYSTEM_SECTIONS = 40;
const SYSTEM_SECTION_HEADING = /^\s{0,8}##\s+(?!#)(.+?)\s*$/;

type LoggablePart = { type?: string; [key: string]: unknown };
type LoggableMessage = {
  role?: unknown;
  content?: unknown;
  parts?: unknown;
};

const fence = (body: string): string => `\`\`\`\n${body}\n\`\`\``;

const toParts = (content: unknown): LoggablePart[] =>
  typeof content === 'string'
    ? [{ type: 'text', text: content }]
    : Array.isArray(content)
      ? (content as LoggablePart[])
      : [];

const formatPayload = (value: unknown): string =>
  fence(formatValueForLog(value));

const systemSummary = (text: string): string => {
  const sections = text
    .split('\n')
    .map((line) => SYSTEM_SECTION_HEADING.exec(line)?.[1])
    .filter(isNonEmptyString);

  return (
    `system prompt ${text.length} chars` +
    (sections.length > 0
      ? `, sections: ${sections.slice(0, MAX_SYSTEM_SECTIONS).join(' · ')}` +
        (sections.length > MAX_SYSTEM_SECTIONS
          ? ` · +${sections.length - MAX_SYSTEM_SECTIONS} more`
          : '')
      : '')
  );
};

const formatPart = (part: LoggablePart): string => {
  switch (part.type) {
    case 'text':
      return `text:\n${fence(String(part.text ?? ''))}`;
    case 'reasoning':
      return `reasoning:\n${fence(String(part.text ?? ''))}`;
    case 'tool-call':
      return (
        `tool-call \`${String(part.toolName)}\`:\n` + formatPayload(part.input)
      );
    case 'tool-result':
      return (
        `tool-result \`${String(part.toolName ?? 'unknown')}\`:\n` +
        formatPayload(part.output)
      );
    case 'image':
    case 'file':
      return `${String(part.type)} ${String(part.mediaType ?? part.mimeType ?? '')}`;
    default: {
      // UI parts name their tool in the type (`tool-load_skills`), while model
      // parts carry it in toolName
      const isToolPart =
        typeof part.type === 'string' && part.type.startsWith('tool-');

      if (isToolPart) {
        return (
          `${String(part.type).replace(/^tool-/, '')}:\n` +
          formatPayload({ input: part.input, output: part.output })
        );
      }

      return formatPayload(part);
    }
  }
};

const formatMessage = (message: LoggableMessage, index: number): string => {
  const role = String(message.role ?? 'unknown');
  const heading = `#### ${index + 1}. ${role}`;

  if (role === 'system') {
    return `${heading}\n${systemSummary(String(message.content ?? ''))}`;
  }

  // Model messages carry content, UI messages (ExtendedUIMessage) carry parts
  const parts = toParts(message.content ?? message.parts).map(formatPart);

  return parts.length > 0 ? `${heading}\n${parts.join('\n')}` : heading;
};

export const formatMessagesForLog = (messages: readonly unknown[]): string =>
  messages
    .map((message, index) => formatMessage(message as LoggableMessage, index))
    .join('\n\n');

// Step output (text, reasoning, tool calls and their results) is the same shape
// as an assistant message's content, so it reuses the message renderer.
export const formatContentPartsForLog = (content: unknown): string =>
  formatMessage({ role: 'assistant', content }, 0);

// A tool definition's inputSchema is either a zod schema, whose JSON is hundreds
// of lines of ~standard/def/checks internals, or an already-built `{ jsonSchema }`
// wrapper. asSchema normalises the first; the second is used as-is.
const toJsonSchema = (inputSchema: unknown): unknown => {
  if (!isDefined(inputSchema)) {
    return undefined;
  }

  if (
    typeof inputSchema === 'object' &&
    inputSchema !== null &&
    'jsonSchema' in inputSchema
  ) {
    return (inputSchema as { jsonSchema: unknown }).jsonSchema;
  }

  try {
    return asSchema(inputSchema as Parameters<typeof asSchema>[0]).jsonSchema;
  } catch {
    return undefined;
  }
};

export const formatToolSetForLog = (tools: ToolSet): string =>
  fenceValueForLog(
    Object.fromEntries(
      Object.entries(tools).map(([name, definition]) => [
        name,
        {
          description: definition.description,
          inputSchema: toJsonSchema(definition.inputSchema),
        },
      ]),
    ),
  );
