import { asSchema, type ModelMessage, type ToolSet } from 'ai';
import { isDefined } from 'twenty-shared/utils';

// Providers only report a total for the input, so this is an estimate by source.
// ~4 characters per token, the same rule the system prompt preview uses.
const CHARACTERS_PER_TOKEN = 4;

// Set TOKEN_BREAKDOWN_LOG=false to silence the per-step breakdown
export const isTokenBreakdownLoggingEnabled = (): boolean =>
  process.env.TOKEN_BREAKDOWN_LOG?.trim().toLowerCase() !== 'false';

export const estimateTokens = (value: unknown): number => {
  if (!isDefined(value)) {
    return 0;
  }

  const text = typeof value === 'string' ? value : safeStringify(value);

  return Math.ceil(text.length / CHARACTERS_PER_TOKEN);
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
};

export type TokenBySource = Record<string, number>;

export type InputTokenBreakdown = {
  systemPrompt: { total: number; sections: TokenBySource };
  toolDefinitions: { total: number; byTool: TokenBySource };
  history: {
    userText: number;
    assistantText: number;
    reasoning: number;
    files: number;
    toolCalls: { total: number; byTool: TokenBySource };
    toolResults: { total: number; byTool: TokenBySource };
  };
  // Tokens in messages before the latest user message (earlier turns) and from it onward
  pastTurnsTokens: number;
  currentTurnTokens: number;
  estimatedTotal: number;
};

const SYSTEM_SECTION_HEADING = /^\s{0,8}##\s+(?!#)(.+?)\s*$/;

const splitSystemPromptSections = (systemPrompt: string): TokenBySource => {
  const sections: TokenBySource = {};
  let currentTitle = 'Base instructions';
  let currentLines: string[] = [];

  const flush = () => {
    const tokens = estimateTokens(currentLines.join('\n'));

    if (tokens > 0) {
      sections[currentTitle] = (sections[currentTitle] ?? 0) + tokens;
    }
  };

  for (const line of systemPrompt.split('\n')) {
    const heading = SYSTEM_SECTION_HEADING.exec(line);

    if (heading !== null) {
      flush();
      currentTitle = heading[1];
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  flush();

  return sections;
};

export const estimateToolDefinitionTokens = (tools: ToolSet): TokenBySource =>
  Object.fromEntries(
    Object.entries(tools).map(([name, definition]) => {
      let schema: unknown;

      try {
        schema = isDefined(definition.inputSchema)
          ? asSchema(definition.inputSchema).jsonSchema
          : undefined;
      } catch {
        schema = undefined;
      }

      return [
        name,
        estimateTokens({ name, description: definition.description, schema }),
      ];
    }),
  );

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

const addTo = (target: TokenBySource, key: string, tokens: number) => {
  target[key] = (target[key] ?? 0) + tokens;
};

// execute_tool wraps the real tool, so label its calls by the inner tool
const labelToolCall = (toolName: string, input: unknown): string => {
  if (toolName === 'execute_tool' && typeof input === 'object' && input !== null) {
    const innerToolName = (input as { toolName?: unknown }).toolName;

    if (typeof innerToolName === 'string') {
      return `execute_tool:${innerToolName}`;
    }
  }

  return toolName;
};

type ContentPart = { type?: string; [key: string]: unknown };

export const buildInputTokenBreakdown = ({
  messages,
  toolDefinitionTokens,
}: {
  // Exactly what the model receives, system message(s) first
  messages: ModelMessage[];
  toolDefinitionTokens: TokenBySource;
}): InputTokenBreakdown => {
  const systemSections: TokenBySource = {};
  const history: InputTokenBreakdown['history'] = {
    userText: 0,
    assistantText: 0,
    reasoning: 0,
    files: 0,
    toolCalls: { total: 0, byTool: {} },
    toolResults: { total: 0, byTool: {} },
  };
  const callLabelById = new Map<string, string>();
  const tokensPerMessage: number[] = [];
  let lastUserMessageIndex = -1;

  messages.forEach((message, index) => {
    if (message.role === 'user') {
      lastUserMessageIndex = index;
    }
  });

  messages.forEach((message) => {
    let messageTokens = 0;

    if (message.role === 'system') {
      for (const [title, tokens] of Object.entries(
        splitSystemPromptSections(
          typeof message.content === 'string'
            ? message.content
            : safeStringify(message.content),
        ),
      )) {
        addTo(systemSections, title, tokens);
      }

      tokensPerMessage.push(0);

      return;
    }

    const parts: ContentPart[] =
      typeof message.content === 'string'
        ? [{ type: 'text', text: message.content }]
        : (message.content as ContentPart[]);

    for (const part of parts) {
      switch (part.type) {
        case 'text': {
          const tokens = estimateTokens(part.text);

          if (message.role === 'user') {
            history.userText += tokens;
          } else {
            history.assistantText += tokens;
          }

          messageTokens += tokens;
          break;
        }
        case 'reasoning': {
          const tokens = estimateTokens(part.text);

          history.reasoning += tokens;
          messageTokens += tokens;
          break;
        }
        case 'image':
        case 'file': {
          // Binary payloads are inlined by the provider; count the reference only
          const tokens = estimateTokens({ ...part, data: undefined });

          history.files += tokens;
          messageTokens += tokens;
          break;
        }
        case 'tool-call': {
          const toolName = String(part.toolName);
          const label = labelToolCall(toolName, part.input);
          const tokens = estimateTokens({
            toolName,
            toolCallId: part.toolCallId,
            input: part.input,
          });

          callLabelById.set(String(part.toolCallId), label);
          history.toolCalls.total += tokens;
          addTo(history.toolCalls.byTool, label, tokens);
          messageTokens += tokens;
          break;
        }
        case 'tool-result': {
          const label =
            callLabelById.get(String(part.toolCallId)) ??
            String(part.toolName ?? 'unknown');
          const tokens = estimateTokens({
            toolCallId: part.toolCallId,
            output: part.output,
          });

          history.toolResults.total += tokens;
          addTo(history.toolResults.byTool, label, tokens);
          messageTokens += tokens;
          break;
        }
        default: {
          messageTokens += estimateTokens(part);
        }
      }
    }

    tokensPerMessage.push(messageTokens);
  });

  const pastTurnsTokens = sum(
    tokensPerMessage.slice(
      0,
      lastUserMessageIndex === -1 ? 0 : lastUserMessageIndex,
    ),
  );
  const systemTotal = sum(Object.values(systemSections));
  const toolDefinitionsTotal = sum(Object.values(toolDefinitionTokens));
  const historyTotal = sum(tokensPerMessage);

  return {
    systemPrompt: { total: systemTotal, sections: systemSections },
    toolDefinitions: {
      total: toolDefinitionsTotal,
      byTool: toolDefinitionTokens,
    },
    history,
    pastTurnsTokens,
    currentTurnTokens: historyTotal - pastTurnsTokens,
    estimatedTotal: systemTotal + toolDefinitionsTotal + historyTotal,
  };
};

const formatCount = (value: number): string => value.toLocaleString('en-US');

const formatTopEntries = (entries: TokenBySource, limit = 6): string =>
  Object.entries(entries)
    .sort(([, first], [, second]) => second - first)
    .slice(0, limit)
    .map(([name, tokens]) => `${name} ${formatCount(tokens)}`)
    .join(' · ');

export const formatInputTokenBreakdown = ({
  breakdown,
  stepNumber,
  reportedInputTokens,
  cacheReadTokens,
  contextWindowTokens,
}: {
  breakdown: InputTokenBreakdown;
  stepNumber: number;
  reportedInputTokens?: number;
  cacheReadTokens?: number;
  contextWindowTokens?: number;
}): string => {
  const { history } = breakdown;
  const staticTokens =
    breakdown.systemPrompt.total + breakdown.toolDefinitions.total;
  const lines: Array<string | null> = [
    `Input tokens, step ${stepNumber}: estimated ${formatCount(breakdown.estimatedTotal)}` +
      (isDefined(reportedInputTokens)
        ? `, reported ${formatCount(reportedInputTokens)}` +
          (isDefined(cacheReadTokens)
            ? ` (cache read ${formatCount(cacheReadTokens)})`
            : '')
        : ''),
    `  system prompt        ${formatCount(breakdown.systemPrompt.total)}  (static)  ${formatTopEntries(breakdown.systemPrompt.sections, 5)}`,
    `  tool definitions     ${formatCount(breakdown.toolDefinitions.total)}  (static)  ${formatTopEntries(breakdown.toolDefinitions.byTool, 5)}`,
    `  history: user text   ${formatCount(history.userText)}`,
    `  history: assistant   ${formatCount(history.assistantText)}`,
    history.reasoning > 0
      ? `  history: reasoning   ${formatCount(history.reasoning)}`
      : null,
    history.files > 0
      ? `  history: files       ${formatCount(history.files)}`
      : null,
    `  tool calls           ${formatCount(history.toolCalls.total)}  ${formatTopEntries(history.toolCalls.byTool)}`,
    `  tool results         ${formatCount(history.toolResults.total)}  ${formatTopEntries(history.toolResults.byTool)}`,
    `  static ${formatCount(staticTokens)} · past turns ${formatCount(breakdown.pastTurnsTokens)} · this turn ${formatCount(breakdown.currentTurnTokens)}`,
  ];

  if (isDefined(reportedInputTokens)) {
    const unattributed = reportedInputTokens - breakdown.estimatedTotal;

    lines.push(
      `  unattributed (reported - estimated) ${unattributed >= 0 ? '+' : ''}${formatCount(unattributed)}`,
    );
  }

  if (isDefined(contextWindowTokens) && contextWindowTokens > 0) {
    const used = reportedInputTokens ?? breakdown.estimatedTotal;

    lines.push(
      `  context window ${formatCount(used)} / ${formatCount(contextWindowTokens)} (${((used / contextWindowTokens) * 100).toFixed(1)}%)`,
    );
  }

  return lines.filter((line): line is string => line !== null).join('\n');
};
