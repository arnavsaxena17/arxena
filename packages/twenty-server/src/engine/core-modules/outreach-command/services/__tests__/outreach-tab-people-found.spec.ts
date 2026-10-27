import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';

const buildService = ({
  companies,
  people,
}: {
  companies: Array<Record<string, unknown>>;
  people: Array<Record<string, unknown>>;
}) => {
  const setCompanies = jest.fn().mockResolvedValue(undefined);
  const setPeople = jest.fn().mockResolvedValue(undefined);
  const service = new OutreachTabService(
    {
      get: jest.fn().mockResolvedValue({ people }),
      set: setPeople,
    } as never,
    {
      get: jest.fn().mockResolvedValue({ companies }),
      set: setCompanies,
    } as never,
    {
      executeInWorkspaceContext: (callback: () => unknown) => callback(),
      getRepository: jest.fn().mockResolvedValue({}),
    } as never,
  );

  return { service, setCompanies, setPeople };
};

describe('OutreachTabService.syncPeopleFound', () => {
  it('should fill People found for companies that already have people', async () => {
    const { service, setCompanies, setPeople } = buildService({
      companies: [
        { id: 'c1', name: 'Monginis' },
        { id: 'c2', name: 'Ghost Co' },
      ],
      people: [
        { id: 'p1', companyId: 'c1', companyName: 'Monginis' },
        { id: 'p2', companyId: '', companyName: 'Monginis Foods Pvt. Ltd.' },
      ],
    });

    const result = await service.syncPeopleFound({
      workspaceId: 'w',
      projectId: 'p',
    });
    const written = setCompanies.mock.calls[0][2];

    expect(result.updated).toBe(1);
    expect(written[0].otherFields.peopleFound).toBe('Found');
    expect(written[0].otherFields.peopleFoundCount).toBe(2);
    expect(setPeople.mock.calls[0][2].map((p: any) => p.companyId)).toEqual([
      'c1',
      'c1',
    ]);
    // nothing says Ghost Co was searched, so it stays blank
    expect(written[1].otherFields).toBeUndefined();
  });

  it('should write nothing when the counts are already recorded', async () => {
    const { service, setCompanies } = buildService({
      companies: [
        { id: 'c1', name: 'Monginis', otherFields: { peopleFoundCount: 1 } },
      ],
      people: [{ id: 'p1', companyId: 'c1', companyName: 'Monginis' }],
    });

    const result = await service.syncPeopleFound({
      workspaceId: 'w',
      projectId: 'p',
    });

    expect(result.updated).toBe(0);
    expect(setCompanies).not.toHaveBeenCalled();
  });
});
