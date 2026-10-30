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
    });

    expect(outcome).toEqual({
      written: 0,
      total: 1,
      createdCount: 0,
      updatedCount: 0,
    });
    expect(upsertCompanies.execute).not.toHaveBeenCalled();
  });

  it('should merge companies into the project tab', async () => {
    const outcome = await service.write({
      projectId: 'proj-1',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com'), companyRow('Beta', 'beta.com')],
      context: { workspaceId: 'ws-1' },
    });

    expect(outcome).toEqual({
      written: 2,
      total: 2,
      createdCount: 0,
      updatedCount: 0,
    });
    expect(upsertCompanies.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        mode: 'merge',
        companies: expect.arrayContaining([
          expect.objectContaining({ name: 'Acme', domain: 'acme.com' }),
        ]),
      }),
      { workspaceId: 'ws-1' },
    );
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

    expect(outcome).toEqual({
      written: 0,
      total: 1,
      createdCount: 0,
      updatedCount: 0,
      error: 'tab full',
    });
  });

  it('should return the new and already-known row counts', async () => {
    upsertCompanies.execute.mockResolvedValueOnce({
      success: true,
      result: { createdCount: 1, updatedCount: 1 },
    });

    const outcome = await service.write({
      projectId: 'proj-1',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com'), companyRow('Beta', 'beta.com')],
      context: { workspaceId: 'ws-1' },
    });

    expect(outcome.createdCount).toBe(1);
    expect(outcome.updatedCount).toBe(1);

  });
});
