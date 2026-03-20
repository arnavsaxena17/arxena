import type { AssistantThreadMessage } from '../../assistant.types';
import { threadMessagesToHistory } from '../thread-history.util';

describe('threadMessagesToHistory', () => {
  it('converts mixed user and assistant messages with tool calls', () => {
    const messages: AssistantThreadMessage[] = [
      { role: 'user', content: 'Hello' },
      {
        role: 'assistant',
        content: 'Hi there',
        toolCalls: [
          { name: 'some_tool', args: { foo: 'bar' } },
          { name: 'other_tool', args: {} },
        ],
      },
    ];

    const history = threadMessagesToHistory(messages, { lastK: 10 });

    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(history[1].role).toBe('assistant');

    const assistantContent = history[1].content;
    expect(Array.isArray(assistantContent)).toBe(true);
    if (!Array.isArray(assistantContent)) return;

    const textBlocks = assistantContent.filter((b) => b.type === 'text');
    const toolBlocks = assistantContent.filter((b) => b.type === 'tool_use');

    expect(textBlocks).toHaveLength(1);
    expect(textBlocks[0]).toEqual({ type: 'text', text: 'Hi there' });
    expect(toolBlocks).toHaveLength(2);
    expect(toolBlocks[0]).toMatchObject({
      type: 'tool_use',
      id: 'tc-1-0',
      name: 'some_tool',
      input: { foo: 'bar' },
    });
    expect(toolBlocks[1]).toMatchObject({
      type: 'tool_use',
      id: 'tc-1-1',
      name: 'other_tool',
      input: {},
    });
  });

  it('preserves assistant tool results as follow-up user tool_result blocks', () => {
    const messages: AssistantThreadMessage[] = [
      {
        role: 'assistant',
        content: 'Generated query set.',
        toolCalls: [
          {
            name: 'generate_iterative_linkedin_query_set',
            args: { rawRequirement: 'Pulmonologist in Mumbai' },
          },
        ],
        toolResults: [
          {
            content:
              '{"final_query_set":{"search_query_set":[{"job_title":"Pulmonologist","location":["Mumbai"]}]}}',
          },
        ],
      },
    ];

    const history = threadMessagesToHistory(messages, { lastK: 10 });

    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Generated query set.' },
        {
          type: 'tool_use',
          id: 'tc-0-0',
          name: 'generate_iterative_linkedin_query_set',
          input: { rawRequirement: 'Pulmonologist in Mumbai' },
        },
      ],
    });
    expect(history[1]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tc-0-0',
          content:
            '{"final_query_set":{"search_query_set":[{"job_title":"Pulmonologist","location":["Mumbai"]}]}}',
        },
      ],
    });
  });

  it('limits to the last K messages', () => {
    const messages: AssistantThreadMessage[] = [];
    for (let i = 0; i < 30; i += 1) {
      messages.push({ role: 'user', content: `Message ${i}` });
    }

    const history = threadMessagesToHistory(messages, { lastK: 5 });

    expect(history).toHaveLength(5);
    expect(history[0]).toEqual({ role: 'user', content: 'Message 25' });
    expect(history[4]).toEqual({ role: 'user', content: 'Message 29' });
  });

  it('returns an empty history when there are no messages', () => {
    const history = threadMessagesToHistory([], { lastK: 10 });
    expect(history).toEqual([]);
  });

  it('skips assistant messages with no content and no tool calls', () => {
    const messages: AssistantThreadMessage[] = [
      { role: 'assistant', content: '' },
      { role: 'user', content: 'User message' },
    ];

    const history = threadMessagesToHistory(messages, { lastK: 10 });

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ role: 'user', content: 'User message' });
  });
});
