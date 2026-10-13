import { type ModelMessage, type ToolSet, jsonSchema } from 'ai';

import {
  buildInputTokenBreakdown,
  estimateTokens,
  estimateToolDefinitionTokens,
  formatInputTokenBreakdown,
} from 'src/engine/metadata-modules/ai/ai-chat/utils/build-input-token-breakdown.util';

const SYSTEM_PROMPT = [
  'You are a helpful assistant.',
  '    ## Available Skills',
  'x'.repeat(400),
  '    ### Not a section',
  '    ## Available Tools',
  'y'.repeat(800),
].join('\n');

const buildMessages = (): ModelMessage[] => [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: 'earlier question' },
  { role: 'assistant', content: 'earlier answer' },
  { role: 'user', content: 'find the CEO of Acme' },
  {
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'z'.repeat(40) },
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'execute_tool',
        input: { toolName: 'search_bright_data_business', arguments: {} },
      },
    ],
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'execute_tool',
        output: { type: 'json', value: { rows: 'r'.repeat(400) } },
      },
    ],
  },
];

describe('buildInputTokenBreakdown', () => {
  it('should split the system prompt by top-level heading', () => {
    const breakdown = buildInputTokenBreakdown({
      messages: buildMessages(),
      toolDefinitionTokens: {},
    });

    expect(Object.keys(breakdown.systemPrompt.sections)).toEqual([
      'Base instructions',
      'Available Skills',
      'Available Tools',
    ]);
    expect(breakdown.systemPrompt.total).toBeGreaterThan(300);
  });

  it('should label execute_tool calls and results by the inner tool', () => {
    const breakdown = buildInputTokenBreakdown({
      messages: buildMessages(),
      toolDefinitionTokens: {},
    });

    expect(Object.keys(breakdown.history.toolCalls.byTool)).toEqual([
      'execute_tool:search_bright_data_business',
    ]);
    expect(
      breakdown.history.toolResults.byTool[
        'execute_tool:search_bright_data_business'
      ],
    ).toBeGreaterThanOrEqual(100);
  });

  it('should separate earlier turns from the current turn', () => {
    const breakdown = buildInputTokenBreakdown({
      messages: buildMessages(),
      toolDefinitionTokens: {},
    });

    expect(breakdown.pastTurnsTokens).toBe(
      estimateTokens('earlier question') + estimateTokens('earlier answer'),
    );
    expect(breakdown.currentTurnTokens).toBeGreaterThan(100);
    expect(breakdown.history.reasoning).toBe(10);
  });

  it('should add up to the estimated total', () => {
    const breakdown = buildInputTokenBreakdown({
      messages: buildMessages(),
      toolDefinitionTokens: { execute_tool: 50 },
    });

    expect(breakdown.estimatedTotal).toBe(
      breakdown.systemPrompt.total +
        50 +
        breakdown.pastTurnsTokens +
        breakdown.currentTurnTokens,
    );
  });
});

describe('estimateToolDefinitionTokens', () => {
  it('should count name, description and schema for each tool', () => {
    const tools = {
      learn_tools: {
        description: 'Learn tool schemas',
        inputSchema: jsonSchema({
          type: 'object',
          properties: { toolNames: { type: 'array' } },
        }),
      },
    } as unknown as ToolSet;

    const tokens = estimateToolDefinitionTokens(tools);

    expect(tokens.learn_tools).toBeGreaterThan(
      estimateTokens('learn_tools Learn tool schemas'),
    );
  });
});

describe('formatInputTokenBreakdown', () => {
  it('should report the gap between reported and estimated input', () => {
    const breakdown = buildInputTokenBreakdown({
      messages: buildMessages(),
      toolDefinitionTokens: { execute_tool: 50 },
    });

    const output = formatInputTokenBreakdown({
      breakdown,
      stepNumber: 2,
      reportedInputTokens: breakdown.estimatedTotal + 100,
      cacheReadTokens: 500,
      contextWindowTokens: 200_000,
    });

    expect(output).toContain('Input tokens, step 2');
    expect(output).toContain('unattributed (reported - estimated) +100');
    expect(output).toContain('(cache read 500)');
    expect(output).toContain('/ 200,000');
  });
});
