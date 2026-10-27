import { OutreachListTool } from 'src/engine/core-modules/tool/tools/outreach-list-tool/outreach-list-tool';

const buildTool = (projectIds: string[]) => {
  const document = {
    meta: {
      id: 'list-1',
      workspaceId: 'workspace-1',
      entity: 'company',
      projectIds,
    },
    rows: [{ key: 'row-1', name: 'Company 1' }],
  };
  const writeService = {
    write: jest.fn(async () => ({ written: 1, total: 1 })),
  };
  const tool = new OutreachListTool(
    { get: jest.fn(async () => document) } as never,
    {} as never,
    {} as never,
    writeService as never,
  );

  return { tool, writeService };
};

describe('OutreachListTool attach', () => {
  const context = { workspaceId: 'workspace-1', projectId: 'project-1' };

  it('should skip a list that is already on the project', async () => {
    const { tool, writeService } = buildTool(['project-1']);

    const output = await tool.execute(
      { action: 'attach', listId: 'list-1' },
      context,
    );

    expect(writeService.write).not.toHaveBeenCalled();
    expect(output.success).toBe(true);
    expect(output.result).toEqual(
      expect.objectContaining({ alreadyOnProject: true }),
    );
  });

  it('should still page on when an offset is given', async () => {
    const { tool, writeService } = buildTool(['project-1']);

    await tool.execute(
      { action: 'attach', listId: 'list-1', offset: 0 },
      context,
    );

    expect(writeService.write).toHaveBeenCalled();
  });

  it('should attach to the browsing-context project when none is passed', async () => {
    const { tool, writeService } = buildTool([]);

    await tool.execute({ action: 'attach', listId: 'list-1' }, context);

    expect(writeService.write).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
    );
  });

  it('should ask for a project when neither the call nor the context has one', async () => {
    const { tool, writeService } = buildTool([]);

    const output = await tool.execute(
      { action: 'attach', listId: 'list-1' },
      { workspaceId: 'workspace-1' },
    );

    expect(writeService.write).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });
});
