import { OutreachTabTool } from 'src/engine/core-modules/tool/tools/outreach-tab-tool/outreach-tab-tool';

const row = (id: string, name: string, domain: string) => ({
  id,
  source: 'ephemeral' as const,
  name,
  domain,
  otherFields: {},
});

const buildTool = () => {
  const outreachTabService = {
    getAll: jest.fn(async () => [
      row('a', 'Acme', 'acme.com'),
      row('b', 'Beta', 'beta.com'),
    ]),
  };
  const exportService = {
    export: jest.fn(async () => ({
      fileId: 'file-1',
      filename: 'companies.csv',
      url: 'https://example.test/companies.csv',
      count: 2,
    })),
  };
  const dedupeService = {
    findExistingCrmKeys: jest.fn(async () => new Set(['d:acme.com'])),
  };
  const companies = [row('a', 'Acme', 'acme.com'), row('b', 'Beta', 'beta.com')];
  const companiesCacheService = {
    get: jest.fn(async () => ({ companies, projectId: 'project-1' })),
    set: jest.fn(async () => undefined),
  };
  const peopleCacheService = {
    get: jest.fn(async () => ({ people: [], projectId: 'project-1' })),
    set: jest.fn(async () => undefined),
  };
  const tool = new OutreachTabTool(
    outreachTabService as never,
    exportService as never,
    dedupeService as never,
    companiesCacheService as never,
    peopleCacheService as never,
  );

  return {
    tool,
    exportService,
    dedupeService,
    companiesCacheService,
  };
};

const context = { workspaceId: 'workspace-1', projectId: 'project-1' };

describe('OutreachTabTool', () => {
  it('should export the project tab as CSV', async () => {
    const { tool, exportService } = buildTool();

    const output = await tool.execute(
      { action: 'export', tab: 'companies' },
      context,
    );

    expect(exportService.export).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'workspace-1', entity: 'company' }),
    );
    expect(output.result).toEqual(
      expect.objectContaining({ count: 2, tab: 'companies' }),
    );
  });

  it('should mark CRM matches on the tab without removing them', async () => {
    const { tool, companiesCacheService } = buildTool();

    const output = await tool.execute(
      { action: 'dedupe', tab: 'companies', against: 'crm' },
      context,
    );

    expect(companiesCacheService.set).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      [
        expect.objectContaining({
          id: 'a',
          otherFields: expect.objectContaining({ inCrm: true }),
        }),
        expect.objectContaining({ id: 'b', otherFields: {} }),
      ],
    );
    expect(output.result).toEqual(
      expect.objectContaining({ matched: 1, removed: 0, total: 2 }),
    );
  });

  it('should remove CRM matches when remove is true', async () => {
    const { tool, companiesCacheService } = buildTool();

    await tool.execute(
      { action: 'dedupe', tab: 'companies', against: 'crm', remove: true },
      context,
    );

    expect(companiesCacheService.set).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      [expect.objectContaining({ id: 'b' })],
    );
  });

  it('should refuse without a project', async () => {
    const { tool } = buildTool();

    const output = await tool.execute({ action: 'export', tab: 'companies' }, {
      workspaceId: 'workspace-1',
    });

    expect(output.success).toBe(false);
    expect(output.message).toContain('projectId is required');
  });
});
