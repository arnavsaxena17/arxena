import { WriteSearchRowsToProjectTabService } from 'src/engine/core-modules/tool/tools/outreach-tab-tool/write-search-rows-to-project-tab.service';
import { type OutreachRow } from 'src/engine/core-modules/outreach-command/rows/outreach-rows.types';

const companyRow = (name: string, domain: string): OutreachRow => ({
  key: `d:${domain}`,
  id: domain,
  name,
  domain,
  website: `https://${domain}`,
  linkedinUrl: '',
  title: '',
  companyName: '',
  email: '',
  industry: '',
  location: '',
  country: '',
  size: '',
  about: '',
  source: 'apollo',
  addedAt: new Date().toISOString(),
});

describe('WriteSearchRowsToProjectTabService', () => {
  const upsertCompanies = {
    execute: jest.fn().mockResolvedValue({ success: true }),
  };
  const upsertPeople = {
    execute: jest.fn().mockResolvedValue({ success: true }),
  };
  const service = new WriteSearchRowsToProjectTabService(
    upsertCompanies as never,
    upsertPeople as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip when projectId is empty', async () => {
    const outcome = await service.write({
      projectId: '',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com')],
      context: { workspaceId: 'ws-1' },
      resultSetId: 'search-1',
    });

    expect(outcome).toEqual(
      expect.objectContaining({
        resultSetId: 'search-1',
        written: 0,
        total: 1,
        newRows: 0,
        alreadyOnTab: 0,
      }),
    );
    expect(upsertCompanies.execute).not.toHaveBeenCalled();
  });

  it('should stamp every row with the search it came from', async () => {
    await service.write({
      projectId: 'proj-1',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com'), companyRow('Beta', 'beta.com')],
      context: { workspaceId: 'ws-1' },
      resultSetId: 'search-1',
    });

    expect(upsertCompanies.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        mode: 'merge',
        companies: [
          expect.objectContaining({
            name: 'Acme',
            otherFields: expect.objectContaining({
              resultSetIds: ['search-1'],
              firstResultSetId: 'search-1',
            }),
          }),
          expect.objectContaining({ name: 'Beta' }),
        ],
      }),
      { workspaceId: 'ws-1' },
    );
  });

  it('should give a search with no id of its own a new one', async () => {
    const outcome = await service.write({
      projectId: 'proj-1',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com')],
      context: { workspaceId: 'ws-1' },
    });

    expect(outcome.resultSetId).toEqual(expect.any(String));
    expect(outcome.resultSetId.length).toBeGreaterThan(0);
  });

  it('should return the upsert error', async () => {
    upsertCompanies.execute.mockResolvedValueOnce({
      success: false,
      error: 'tab full',
    });

    const outcome = await service.write({
      projectId: 'proj-1',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com')],
      context: { workspaceId: 'ws-1' },
    });

    expect(outcome).toEqual(
      expect.objectContaining({ written: 0, total: 1, error: 'tab full' }),
    );
  });

  it('should split the written rows into new and already on the tab', async () => {
    upsertCompanies.execute.mockResolvedValueOnce({
      success: true,
      result: {
        createdCount: 1,
        updatedCount: 1,
        writtenRowIds: ['row-1', 'row-2'],
      },
    });

    const outcome = await service.write({
      projectId: 'proj-1',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com'), companyRow('Beta', 'beta.com')],
      context: { workspaceId: 'ws-1' },
    });

    expect(outcome).toEqual(
      expect.objectContaining({
        written: 2,
        newRows: 1,
        alreadyOnTab: 1,
        writtenRowIds: ['row-1', 'row-2'],
      }),
    );
    expect(outcome.summary).toContain('1 new row added to the companies tab');
  });

  it('should write people built by a tool through the people upsert', async () => {
    upsertPeople.execute.mockResolvedValueOnce({
      success: true,
      result: { createdCount: 0, updatedCount: 1 },
    });

    const outcome = await service.writePeople({
      projectId: 'proj-1',
      people: [
        {
          id: 'person-1',
          name: 'Uma Ali',
          title: 'Consultant Nephrologist',
          companyName: 'Lilavati Hospital',
          otherFields: { probe: true },
        } as never,
      ],
      context: { workspaceId: 'ws-1' },
      resultSetId: 'search-2',
    });

    expect(upsertPeople.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        people: [
          expect.objectContaining({
            otherFields: {
              probe: true,
              resultSetIds: ['search-2'],
              firstResultSetId: 'search-2',
            },
          }),
        ],
      }),
      { workspaceId: 'ws-1' },
    );
    expect(outcome.newRows).toBe(0);
    expect(outcome.summary).toContain('found no one new');
  });
});
