import { type ModelMessage } from 'ai';

import { MessagePruningService } from 'src/engine/metadata-modules/ai/ai-chat/services/message-pruning.service';

const toolPair = (
  toolCallId: string,
  toolName: string,
  value: unknown,
): ModelMessage[] => [
  {
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId, toolName, input: {} }],
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId,
        toolName,
        output: { type: 'json', value: value as never },
      },
    ],
  },
];

describe('MessagePruningService', () => {
  const service = new MessagePruningService();

  it('should restore a skill whose load pruning removed', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'find 300 CFOs in Pune' },
      ...toolPair('1', 'load_skills', {
        skills: [{ name: 'sourcing', content: 'Plan table' }],
      }),
      ...toolPair('2', 'execute_tool', { fetched: 25 }),
      ...toolPair('3', 'execute_tool', { fetched: 25 }),
      { role: 'user', content: 'keep going' },
    ];

    const result = service.pruneIfOverContextWindowLimit(messages, 1_000, 950);

    expect(result.wasPruned).toBe(true);
    expect(result.restoredSkillsSection).toContain('Plan table');
  });

  it('should restore nothing under the threshold', () => {
    const result = service.pruneIfOverContextWindowLimit([], 1_000, 10);

    expect(result.wasPruned).toBe(false);
    expect(result.restoredSkillsSection).toBeUndefined();
  });
});
