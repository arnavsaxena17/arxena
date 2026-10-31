import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';

// ids stay non-UUID so the CRM half of the write has nothing to look up
const buildService = ({
  people,
}: {
  people: Array<Record<string, unknown>>;
}) => {
  const setPeople = jest.fn().mockResolvedValue(undefined);
  const service = new OutreachTabService(
    {
      get: jest.fn().mockResolvedValue({ people }),
      set: setPeople,
    } as never,
    {
      get: jest.fn().mockResolvedValue({ companies: [] }),
      set: jest.fn().mockResolvedValue(undefined),
    } as never,
    {
      executeInWorkspaceContext: (callback: () => unknown) => callback(),
      getRepository: jest.fn().mockResolvedValue({}),
    } as never,
  );

  return { service, setPeople };
};

describe('OutreachTabService.writeOtherFields', () => {
  it('should name the patched rows so the tab upserts them', async () => {
    const { service, setPeople } = buildService({
      people: [
        { id: 'p1', name: 'Ada Lovelace', companyName: 'Analytical Engines' },
        { id: 'p2', name: 'Grace Hopper', companyName: 'Analytical Engines' },
      ],
    });

    const written = await service.writeOtherFields({
      workspaceId: 'w',
      projectId: 'pr',
      tab: 'people',
      valuesByRowId: new Map([['p2', { icpFit: 'high' }]]),
    });

    expect(written.ephemeralUpdated).toBe(1);
    expect(setPeople.mock.calls[0].at(-1)).toEqual({
      writtenRows: [expect.objectContaining({ id: 'p2' })],
    });
  });

  it('should patch nothing when no row was addressed', async () => {
    const { service, setPeople } = buildService({
      people: [{ id: 'p1', name: 'Ada Lovelace' }],
    });

    const written = await service.writeOtherFields({
      workspaceId: 'w',
      projectId: 'pr',
      tab: 'people',
      valuesByRowId: new Map([['unknown-row', { icpFit: 'high' }]]),
    });

    expect(written.ephemeralUpdated).toBe(0);
    expect(setPeople).not.toHaveBeenCalled();
  });
});
