import { buildCoreToolSet } from 'src/engine/core-modules/tool-provider/tools/build-core-tool-set.util';
import { type ToolContext } from 'src/engine/core-modules/tool-provider/types/tool-context.type';
import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';

describe('buildCoreToolSet', () => {
  const resolveAndExecute = jest.fn();
  const toolRegistry = { resolveAndExecute } as unknown as ToolRegistryService;
  const toolContext = { workspaceId: 'workspace-1' } as ToolContext;
  const skillService = {
    findFlatSkillsByNames: jest.fn(),
    findAllFlatSkills: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should build learn, execute and load-skill tools', () => {
    const coreTools = buildCoreToolSet({
      toolRegistry,
      toolContext,
      skillService,
      workspaceId: 'workspace-1',
      excludeTools: new Set(),
    });

    expect(Object.keys(coreTools).sort()).toEqual([
      'executeTool',
      'learnTools',
      'loadSkills',
    ]);
  });

  it('should block excluded tools in execute_tool', async () => {
    const coreTools = buildCoreToolSet({
      toolRegistry,
      toolContext,
      skillService,
      workspaceId: 'workspace-1',
      excludeTools: new Set(['http_request']),
    });

    const result = await coreTools.executeTool.execute({
      toolName: 'http_request',
      arguments: {},
    });

    expect(result.success).toBe(false);
    expect(resolveAndExecute).not.toHaveBeenCalled();
  });

  it('should pass output options through to the registry', async () => {
    resolveAndExecute.mockResolvedValue({ success: true, message: 'ok' });

    const coreTools = buildCoreToolSet({
      toolRegistry,
      toolContext,
      skillService,
      workspaceId: 'workspace-1',
      excludeTools: new Set(),
      outputOptions: { compactOutput: true, spillLargeOutput: true },
    });

    await coreTools.executeTool.execute({ toolName: 'any', arguments: {} });

    expect(resolveAndExecute).toHaveBeenCalledWith('any', {}, toolContext, {
      compactOutput: true,
      spillLargeOutput: true,
    });
  });

  it('should load skills from the given workspace', async () => {
    skillService.findFlatSkillsByNames.mockResolvedValue([
      { name: 'search', label: 'Search', content: 'body' },
    ]);

    const coreTools = buildCoreToolSet({
      toolRegistry,
      toolContext,
      skillService,
      workspaceId: 'workspace-1',
      excludeTools: new Set(),
    });

    await coreTools.loadSkills.execute({ skillNames: ['search'] });

    expect(skillService.findFlatSkillsByNames).toHaveBeenCalledWith(
      ['search'],
      'workspace-1',
    );
  });
});
