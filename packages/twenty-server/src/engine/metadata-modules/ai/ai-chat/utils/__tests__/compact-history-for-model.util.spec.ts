import { type ModelMessage } from 'ai';

import { compactHistoryForModel } from 'src/engine/metadata-modules/ai/ai-chat/utils/compact-history-for-model.util';

const SOURCING = [
  '# Sourcing',
  'Always-on overview of how sourcing works.',
  '<!-- skill-section:people -->',
  '## People',
  'People search rules.',
  '<!-- skill-section:for-sales -->',
  '## For sales',
  'Prospects you sell to.',
  '<!-- skill-section:people-by-company -->',
  '## People by company',
  'Role at named companies.',
].join('\n');

const skillCatalog = [{ name: 'sourcing', content: SOURCING }];

const loadSkillsCall = (id: string, sections: string[]): ModelMessage => ({
  role: 'assistant',
  content: [
    { type: 'reasoning', text: `thinking about ${id}` },
    {
      type: 'tool-call',
      toolCallId: id,
      toolName: 'load_skills',
      input: { skillNames: ['sourcing'], sections },
    },
  ],
});

const loadSkillsResult = (id: string, content: string): ModelMessage => ({
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: id,
      toolName: 'load_skills',
      output: {
        type: 'json',
        value: { skills: [{ name: 'sourcing', content }], message: 'ok' },
      },
    },
  ],
});

const executeCall = (id: string, toolName: string): ModelMessage => ({
  role: 'assistant',
  content: [
    { type: 'reasoning', text: 'deciding' },
    {
      type: 'tool-call',
      toolCallId: id,
      toolName: 'execute_tool',
      input: { toolName, arguments: {} },
    },
  ],
});

const skillContent = (output: unknown): string =>
  (output as { value: { skills: Array<{ content: string }> } }).value.skills[0]
    .content;

describe('compactHistoryForModel', () => {
  it('should keep reasoning only on the last assistant message', () => {
    const { messages, stats } = compactHistoryForModel({
      messages: [
        { role: 'user', content: 'find nephrologists' },
        executeCall('a', 'get_outreach_tab'),
        executeCall('b', 'find_people_by_company'),
      ],
      skillCatalog,
    });

    const reasoningCounts = messages.map((message) =>
      Array.isArray(message.content)
        ? message.content.filter((part) => part.type === 'reasoning').length
        : 0,
    );

    expect(reasoningCounts).toEqual([0, 0, 1]);
    expect(stats.reasoningPartsDropped).toBe(1);
  });

  it('should drop a routing-only section once a tool ran after it', () => {
    const loaded = [
      '# Sourcing\nAlways-on overview of how sourcing works.',
      '## People by company\nRole at named companies.',
      '## For sales\nProspects you sell to.',
    ].join('\n\n');
    const { messages } = compactHistoryForModel({
      messages: [
        loadSkillsCall('load', ['people-by-company', 'for-sales']),
        loadSkillsResult('load', loaded),
        executeCall('run', 'find_people_by_company'),
      ],
      skillCatalog,
    });

    const content = skillContent(
      (messages[1].content as Array<{ output: unknown }>)[0].output,
    );

    expect(content).toContain('Role at named companies.');
    expect(content).not.toContain('Prospects you sell to.');
    expect(content).toContain('for-sales');
  });

  it('should keep a routing section while the plan is still being set', () => {
    const loaded =
      '# Sourcing\nAlways-on overview of how sourcing works.\n\n## For sales\nProspects you sell to.';
    const { messages } = compactHistoryForModel({
      messages: [
        loadSkillsCall('load', ['for-sales']),
        loadSkillsResult('load', loaded),
      ],
      skillCatalog,
    });

    expect(
      skillContent(
        (messages[1].content as Array<{ output: unknown }>)[0].output,
      ),
    ).toBe(loaded);
  });

  it('should keep only the later copy of a section loaded twice', () => {
    const first =
      '# Sourcing\nAlways-on overview of how sourcing works.\n\n## People\nPeople search rules.';
    const second =
      '# Sourcing\nAlways-on overview of how sourcing works.\n\n## People\nPeople search rules.\n\n## People by company\nRole at named companies.';
    const { messages, stats } = compactHistoryForModel({
      messages: [
        loadSkillsCall('one', ['people']),
        loadSkillsResult('one', first),
        loadSkillsCall('two', ['people', 'people-by-company']),
        loadSkillsResult('two', second),
      ],
      skillCatalog,
    });

    const firstContent = skillContent(
      (messages[1].content as Array<{ output: unknown }>)[0].output,
    );

    expect(firstContent).not.toContain('People search rules.');
    expect(firstContent).not.toContain('Always-on overview');
    expect(
      skillContent(
        (messages[3].content as Array<{ output: unknown }>)[0].output,
      ),
    ).toBe(second);
    expect(stats.skillSectionsDropped).toBe(2);
  });

  it('should keep schemas of tools that were called and shrink the rest', () => {
    const { messages, stats } = compactHistoryForModel({
      messages: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'learn',
              toolName: 'learn_tools',
              output: {
                type: 'json',
                value: {
                  tools: [
                    {
                      name: 'find_people_by_company',
                      description: 'Find people. Long description.',
                      inputSchema: { type: 'object' },
                    },
                    {
                      name: 'google_serp_search',
                      description: 'Search Google. Returns organic results.',
                      inputSchema: { type: 'object' },
                    },
                  ],
                },
              },
            },
          ],
        },
        executeCall('run', 'find_people_by_company'),
      ],
      skillCatalog,
    });

    const tools = (
      messages[0].content as unknown as Array<{
        output: { value: { tools: Array<Record<string, unknown>> } };
      }>
    )[0].output.value.tools;

    expect(tools[0]).toHaveProperty('inputSchema');
    expect(tools[1]).toEqual({
      name: 'google_serp_search',
      description: 'Search Google.',
      schemaOmitted:
        'Not called yet; call learn_tools for this tool before using it.',
    });
    expect(stats.toolSchemasDropped).toBe(1);
  });

  it('should leave a history with nothing to drop unchanged', () => {
    const history: ModelMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    ];

    expect(
      compactHistoryForModel({ messages: history, skillCatalog }).messages,
    ).toEqual(history);
  });
});
