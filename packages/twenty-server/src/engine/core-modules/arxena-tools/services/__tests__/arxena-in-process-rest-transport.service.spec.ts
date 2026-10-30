import { OutreachTabTool } from 'src/engine/core-modules/tool/tools/outreach-tab-tool/outreach-tab-tool';
import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';
import { ArxenaInProcessRestTransportService } from 'src/engine/core-modules/arxena-tools/services/arxena-in-process-rest-transport.service';

const CONTEXT = {
  workspaceId: 'workspace-id',
  userId: 'user-id',
  userWorkspaceId: 'user-workspace-id',
};

const buildService = () => {
  const searchTool = {
    execute: jest.fn(async () => ({ success: true, message: 'search' })),
  };
  const tabTool = {
    execute: jest.fn(async () => ({ success: true, message: 'tab' })),
  };
  const moduleRef = {
    get: jest.fn((token: unknown) =>
      token === SearchBrightDataBusinessTool ? searchTool : tabTool,
    ),
  };

  return {
    searchTool,
    tabTool,
    service: new ArxenaInProcessRestTransportService(moduleRef as never),
  };
};

describe('ArxenaInProcessRestTransportService', () => {
  afterEach(() => {
    delete process.env.ARXENA_IN_PROCESS_TOOLS;
  });

  it('should answer a Bright Data people search by calling the tool with the entity and the actor', async () => {
    const { service, searchTool } = buildService();

    const outcome = await service.forContext(CONTEXT)!({
      method: 'POST',
      pathPrefix: 'bright-data/business-search',
      endpoint: 'people',
      body: { query: 'CEO of Acme', autoExecute: true },
    });

    expect(outcome).toEqual({
      handled: true,
      data: { success: true, message: 'search' },
    });
    expect(searchTool.execute).toHaveBeenCalledWith(
      { query: 'CEO of Acme', autoExecute: true, entity: 'people' },
      CONTEXT,
    );
  });

  it('should answer outreach_tab by calling the tool', async () => {
    const { service, tabTool } = buildService();

    await service.forContext(CONTEXT)!({
      method: 'POST',
      pathPrefix: 'outreach-tab',
      endpoint: 'run',
      body: { action: 'export', tab: 'companies' },
    });

    expect(tabTool.execute).toHaveBeenCalledWith(
      { action: 'export', tab: 'companies' },
      CONTEXT,
    );
  });

  it('should leave other routes to HTTP', async () => {
    const { service } = buildService();

    await expect(
      service.forContext(CONTEXT)!({
        method: 'POST',
        pathPrefix: 'candidate-sourcing',
        endpoint: 'upload-profiles',
        body: {},
      }),
    ).resolves.toEqual({ handled: false });
  });

  it('should not answer a GET on a route registered for POST', async () => {
    const { service } = buildService();

    await expect(
      service.forContext(CONTEXT)!({
        method: 'GET',
        pathPrefix: 'outreach-tab',
        endpoint: 'run',
      }),
    ).resolves.toEqual({ handled: false });
  });

  it('should return no transport when switched off', () => {
    process.env.ARXENA_IN_PROCESS_TOOLS = 'false';

    expect(buildService().service.forContext(CONTEXT)).toBeUndefined();
  });
});
