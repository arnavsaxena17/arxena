import { WriteOutreachListRowsToProjectTabService } from 'src/engine/core-modules/tool/tools/outreach-list-tool/write-outreach-list-rows-to-project-tab.service';
import { type OutreachListRow } from 'src/engine/core-modules/outreach-list/outreach-list.types';

const companyRow = (name: string, domain: string): OutreachListRow => ({
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

describe('WriteOutreachListRowsToProjectTabService', () => {
  const update = jest.fn().mockResolvedValue(undefined);
  const upsertCompanies = {
    execute: jest.fn().mockResolvedValue({ success: true }),
  };
  const upsertPeople = {
    execute: jest.fn().mockResolvedValue({ success: true }),
  };
  const service = new WriteOutreachListRowsToProjectTabService(
    { update } as never,
    upsertCompanies as never,
    upsertPeople as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip when projectId is empty', async () => {
    const outcome = await service.write({
      workspaceId: 'ws-1',
      listId: 'list-1',
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

  it('should merge companies and tag the list projectIds', async () => {
    const outcome = await service.write({
      workspaceId: 'ws-1',
      listId: 'list-1',
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
    expect(update).toHaveBeenCalledWith('ws-1', 'list-1', expect.any(Function));

    const current = { meta: { projectIds: [] as string[] } };

    (update.mock.calls[0][2] as (document: typeof current) => void)(current);
    expect(current.meta.projectIds).toEqual(['proj-1']);
  });

  it('should return the upsert error without tagging the list', async () => {
    upsertCompanies.execute.mockResolvedValueOnce({
      success: false,
      error: 'tab full',
    });

    const outcome = await service.write({
      workspaceId: 'ws-1',
      listId: 'list-1',
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
    expect(update).not.toHaveBeenCalled();
  });

  it('should keep the new and already-known row counts on the list', async () => {
    upsertCompanies.execute.mockResolvedValueOnce({
      success: true,
      result: { createdCount: 1, updatedCount: 1 },
    });

    const outcome = await service.write({
      workspaceId: 'ws-1',
      listId: 'list-1',
      projectId: 'proj-1',
      entity: 'company',
      rows: [companyRow('Acme', 'acme.com'), companyRow('Beta', 'beta.com')],
      context: { workspaceId: 'ws-1' },
    });

    expect(outcome.createdCount).toBe(1);
    expect(outcome.updatedCount).toBe(1);

    const current = {
      meta: {
        projectIds: [] as string[],
        newUnique: 2,
        alreadyKnown: 3,
      },
    };

    (update.mock.calls[0][2] as (document: typeof current) => void)(current);
    expect(current.meta.newUnique).toBe(3);
    expect(current.meta.alreadyKnown).toBe(4);
  });
});
