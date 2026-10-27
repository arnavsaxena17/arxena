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
  const upsertCompanies = {
    execute: jest.fn(async () => ({ success: true })),
  };
  const outreachList = {
    get: jest.fn(async () => document),
    update: jest.fn(async () => document),
  };
  const tool = new OutreachListTool(
    outreachList as never,
    {} as never,
    {} as never,
    upsertCompanies as never,
    { execute: jest.fn() } as never,
  );

  return { tool, upsertCompanies };
};

describe('OutreachListTool attach', () => {
  const context = { workspaceId: 'workspace-1', projectId: 'project-1' };

  it('should skip a list that is already on the project', async () => {
    const { tool, upsertCompanies } = buildTool(['project-1']);

    const output = await tool.execute(
      { action: 'attach', listId: 'list-1' },
      context,
    );

    expect(upsertCompanies.execute).not.toHaveBeenCalled();
    expect(output.success).toBe(true);
    expect(output.result).toEqual(
      expect.objectContaining({ alreadyOnProject: true }),
    );
  });

  it('should still page on when an offset is given', async () => {
    const { tool, upsertCompanies } = buildTool(['project-1']);

    await tool.execute(
      { action: 'attach', listId: 'list-1', offset: 0 },
      context,
    );

    expect(upsertCompanies.execute).toHaveBeenCalled();
  });

  it('should attach to the browsing-context project when none is passed', async () => {
    const { tool, upsertCompanies } = buildTool([]);

    await tool.execute({ action: 'attach', listId: 'list-1' }, context);

    expect(upsertCompanies.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
      expect.anything(),
    );
  });

  it('should ask for a project when neither the call nor the context has one', async () => {
    const { tool, upsertCompanies } = buildTool([]);

    const output = await tool.execute(
      { action: 'attach', listId: 'list-1' },
      { workspaceId: 'workspace-1' },
    );

    expect(upsertCompanies.execute).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
  });
});
