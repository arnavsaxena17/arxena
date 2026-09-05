import { applyUniqueCompanyLinkedinId } from 'src/database/commands/upgrade-version-command/2-25/utils/apply-unique-company-linkedin-id.util';

describe('applyUniqueCompanyLinkedinId', () => {
  const createWorkspaceQueryService = ({
    tableExists = true,
    columnExists = true,
  }: {
    tableExists?: boolean;
    columnExists?: boolean;
  } = {}) => ({
    checkIfTableExists: jest.fn().mockResolvedValue(tableExists),
    checkIfColumnExists: jest.fn().mockResolvedValue(columnExists),
  });

  it('should skip when company table is missing', async () => {
    const coreDataSource = { query: jest.fn() };
    const logger = { log: jest.fn() };
    const workspaceQueryService = createWorkspaceQueryService({
      tableExists: false,
    });

    await applyUniqueCompanyLinkedinId({
      coreDataSource: coreDataSource as never,
      workspaceQueryService: workspaceQueryService as never,
      schemaName: 'workspace_test',
      workspaceId: 'workspace-1',
      logger,
    });

    expect(coreDataSource.query).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('company missing'),
    );
  });

  it('should null empties/duplicates and create unique index when missing', async () => {
    const coreDataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'empty-1' }])
        .mockResolvedValueOnce([{ id: 'dup-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined),
    };
    const logger = { log: jest.fn() };
    const workspaceQueryService = createWorkspaceQueryService();

    await applyUniqueCompanyLinkedinId({
      coreDataSource: coreDataSource as never,
      workspaceQueryService: workspaceQueryService as never,
      schemaName: 'workspace_test',
      workspaceId: 'workspace-1',
      logger,
    });

    expect(coreDataSource.query).toHaveBeenCalledTimes(4);
    expect(coreDataSource.query.mock.calls[3][0]).toContain(
      'IDX_UNIQUE_company_linkedinId',
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        'emptyNulled=1, duplicatesNulled=1, existingIndexes=0',
      ),
    );
  });

  it('should not create a second unique index when one already exists', async () => {
    const coreDataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ indexname: 'IDX_UNIQUE_existing' }]),
    };
    const logger = { log: jest.fn() };

    await applyUniqueCompanyLinkedinId({
      coreDataSource: coreDataSource as never,
      workspaceQueryService: createWorkspaceQueryService() as never,
      schemaName: 'workspace_test',
      workspaceId: 'workspace-1',
      logger,
    });

    expect(coreDataSource.query).toHaveBeenCalledTimes(3);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('existingIndexes=1'),
    );
  });
});
