import { McpPromptService } from 'src/engine/api/mcp/services/mcp-prompt.service';
import { type SkillService } from 'src/engine/metadata-modules/skill/skill.service';

describe('McpPromptService', () => {
  const skill = {
    name: 'search-people',
    label: 'Search People',
    description: 'Sourcing people',
    content: '# Search people\nUse search_people_api.',
  };

  const skillService = {
    findAllFlatSkills: jest.fn(),
    findFlatSkillsByNames: jest.fn(),
  };

  const service = new McpPromptService(
    skillService as unknown as SkillService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists active skills as MCP prompts with an optional task argument', async () => {
    skillService.findAllFlatSkills.mockResolvedValue([skill]);

    const prompts = await service.listPrompts('workspace-1');

    expect(prompts).toEqual([
      {
        name: 'search-people',
        title: 'Search People',
        description: 'Sourcing people',
        arguments: [
          {
            name: 'task',
            description: expect.stringContaining('skip load_skills'),
            required: false,
          },
        ],
      },
    ]);
  });

  it('returns skill markdown and appends the user task', async () => {
    skillService.findFlatSkillsByNames.mockResolvedValue([skill]);

    const result = await service.getPrompt({
      workspaceId: 'workspace-1',
      name: 'search-people',
      task: 'Find CEOs at Acme',
    });

    expect(result?.messages[0].content.text).toContain('# Search people');
    expect(result?.messages[0].content.text).toContain(
      'User request:\nFind CEOs at Acme',
    );
  });

  it('returns null for an unknown skill name', async () => {
    skillService.findFlatSkillsByNames.mockResolvedValue([]);

    await expect(
      service.getPrompt({
        workspaceId: 'workspace-1',
        name: 'not-a-skill',
      }),
    ).resolves.toBeNull();
  });
});
