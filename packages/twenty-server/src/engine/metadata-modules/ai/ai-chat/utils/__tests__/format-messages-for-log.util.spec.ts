import { z } from 'zod';

import {
  formatContentPartsForLog,
  formatMessagesForLog,
  formatToolSetForLog,
} from 'src/engine/metadata-modules/ai/ai-chat/utils/format-messages-for-log.util';

describe('formatMessagesForLog', () => {
  it('summarises the system prompt instead of dumping it', () => {
    const text = formatMessagesForLog([
      { role: 'system', content: 'intro\n## Tools\nbody\n## Skills\nmore' },
    ]);

    expect(text).toContain('#### 1. system');
    expect(text).toContain('sections: Tools · Skills');
    expect(text).not.toContain('intro');
  });

  it('fences user text and keeps the tool payload skeleton', () => {
    const text = formatMessagesForLog([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolName: 'find_many_people',
            input: { limit: 5 },
          },
          {
            type: 'tool-result',
            toolName: 'find_many_people',
            output: { rows: ['a', 'b'] },
          },
        ],
      },
    ]);

    expect(text).toContain('#### 1. user\ntext:\n```\nhello\n```');
    expect(text).toContain('tool-call `find_many_people`');
    expect(text).toContain('"rows"');
  });

  it('prints a loaded skill body as markdown lines, not \\n escapes', () => {
    const skillBody = `\n# Sourcing Skill\n\n${'body line\n'.repeat(50)}`;

    const text = formatMessagesForLog([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-result',
            toolName: 'load_skills',
            output: { skills: [{ name: 'sourcing', content: skillBody }] },
          },
        ],
      },
    ]);

    expect(text).toContain('"name": "sourcing"');
    expect(text).toContain('skills[0].content:');
    expect(text).toContain('\n# Sourcing Skill\n');
    expect(text).not.toContain('\\n# Sourcing Skill');
  });

  it('renders UI tool parts keyed by their type', () => {
    const text = formatContentPartsForLog([
      { type: 'tool-load_skills', input: { skillNames: ['sourcing'] } },
    ]);

    expect(text).toContain('load_skills:');
    expect(text).toContain('skillNames');
  });

  it('does not truncate long payloads', () => {
    const longBody = `# Sourcing Skill\n${'line of skill text\n'.repeat(4_000)}`;

    const text = formatContentPartsForLog([
      {
        type: 'tool-result',
        toolName: 'load_skills',
        output: { content: longBody },
      },
    ]);

    expect(text).not.toContain('truncated');
    expect(text.split('\n').length).toBeGreaterThan(4_000);
  });

  it('renders step content parts with the same layout', () => {
    const text = formatContentPartsForLog([
      { type: 'text', text: 'The plan is one line.' },
    ]);

    expect(text).toBe(
      '#### 1. assistant\ntext:\n```\nThe plan is one line.\n```',
    );
  });

  it('renders a UI message from parts when it has no content', () => {
    const text = formatMessagesForLog([
      {
        role: 'user',
        parts: [
          { type: 'text', text: '<message_timestamp>Sent: today' },
          { type: 'text', text: 'Find nephrologists in Mumbai.' },
        ],
      },
    ]);

    expect(text).toContain('#### 1. user');
    expect(text).toContain('Find nephrologists in Mumbai.');
  });
});

describe('formatToolSetForLog', () => {
  it('prints a zod input schema as JSON Schema, not zod internals', () => {
    const text = formatToolSetForLog({
      ask_questions: {
        description: 'Ask the user.',
        inputSchema: z.object({ query: z.string() }),
      },
    } as never);

    // the schema the provider receives
    expect(text).toContain('"type": "object"');
    expect(text).toContain('"query"');
    // not the ~standard / def / checks tree JSON.stringify would print
    expect(text).not.toContain('~standard');
    expect(text).not.toContain('"vendor"');
  });

  it('keeps a plain jsonSchema untouched', () => {
    const text = formatToolSetForLog({
      get_tool_catalog: {
        description: 'Discover tools.',
        inputSchema: {
          jsonSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
          },
        },
      },
    } as never);

    expect(text).toContain('get_tool_catalog');
    expect(text).toContain('Discover tools.');
    expect(text).toContain('"query"');
    expect(text).not.toContain('"jsonSchema"');
  });
});
