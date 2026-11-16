import { type ModelMessage } from 'ai';

import {
  buildRestoredSkillsSection,
  collectLoadedSkills,
} from 'src/engine/metadata-modules/ai/ai-chat/utils/restore-pruned-skills.util';

const loadSkillsCall = (
  toolCallId: string,
  skills: { name: string; content: string }[],
  format: 'json' | 'text' = 'json',
): ModelMessage => {
  const value = { skills, message: 'Loaded.' };

  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId,
        toolName: 'load_skills',
        output:
          format === 'json'
            ? { type: 'json', value }
            : { type: 'text', value: JSON.stringify(value) },
      },
    ],
  };
};

const userMessage: ModelMessage = { role: 'user', content: 'find 10 CFOs' };

describe('restore pruned skills', () => {
  it('should keep the latest load of each skill', () => {
    const loaded = collectLoadedSkills([
      loadSkillsCall('1', [{ name: 'sourcing', content: 'people' }]),
      loadSkillsCall('2', [{ name: 'sourcing', content: 'companies' }], 'text'),
    ]);

    expect([...loaded.entries()]).toEqual([['sourcing', 'companies']]);
  });

  it('should restore a skill that pruning removed', () => {
    const before = [
      userMessage,
      loadSkillsCall('1', [{ name: 'sourcing', content: 'Plan table' }]),
    ];

    const section = buildRestoredSkillsSection(before, [userMessage]);

    expect(section).toContain('<skill name="sourcing">\nPlan table\n</skill>');
  });

  it('should restore nothing when the skill survived pruning', () => {
    const messages = [
      userMessage,
      loadSkillsCall('1', [{ name: 'outreach', content: 'Sequences' }]),
    ];

    expect(buildRestoredSkillsSection(messages, messages)).toBeUndefined();
  });

  it('should ignore other tools and failed loads', () => {
    const otherTool: ModelMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: '1',
          toolName: 'execute_tool',
          output: {
            type: 'json',
            value: { skills: [{ name: 'x', content: 'y' }] },
          },
        },
      ],
    };

    expect(
      buildRestoredSkillsSection([otherTool, loadSkillsCall('2', [])], []),
    ).toBeUndefined();
  });
});
