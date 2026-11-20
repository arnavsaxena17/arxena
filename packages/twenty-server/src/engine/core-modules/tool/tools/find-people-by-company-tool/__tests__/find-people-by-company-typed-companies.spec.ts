import { FindPeopleByCompanyTool } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company-tool';

type EnsureCompanyRows = (
  input: Record<string, unknown>,
  companies: Array<Record<string, unknown>>,
  context: Record<string, unknown>,
) => Promise<Array<Record<string, unknown>>>;

const buildTool = ({
  resolveFromRawCompanyName,
}: {
  resolveFromRawCompanyName?: jest.Mock;
}) => {
  const upsertCompanies = {
    execute: jest.fn().mockResolvedValue({
      success: true,
      result: { writtenRowIds: ['row-1', 'row-2'] },
    }),
  };
  const tool = new FindPeopleByCompanyTool(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    upsertCompanies as never,
    undefined,
    resolveFromRawCompanyName === undefined
      ? undefined
      : ({ resolveFromRawCompanyName } as never),
  );

  return {
    upsertCompanies,
    ensureCompanyRows: (
      tool as unknown as { ensureCompanyRows: EnsureCompanyRows }
    ).ensureCompanyRows.bind(tool),
  };
};

const input = { projectId: 'project-1', plan: {} };
const context = { workspaceId: 'workspace-1' };
const companies = [
  {
    name: 'Kokilaben Dhirubhai Ambani Hospital',
    domain: 'kokilabenhospital.com',
  },
  { name: 'P.D. Hinduja Hospital & MRC', domain: 'hindujahospital.com' },
];

describe('FindPeopleByCompanyTool typed companies', () => {
  it('should enrich a typed company from the index before writing it to the tab', async () => {
    const resolveFromRawCompanyName = jest
      .fn()
      .mockImplementation(async (name: string) =>
        name.startsWith('Kokilaben')
          ? {
              resolved: true,
              lookupFailed: false,
              name: 'Kokilaben Dhirubhai Ambani Hospital',
              id: 'index-1',
              website: 'kokilabenhospital.com',
              industry: 'Hospitals and Health Care',
              size: '5001-10000',
              linkedinUrl: 'https://www.linkedin.com/company/kokilaben',
              country: 'IN',
              founded: null,
              matchConfidence: 'high',
            }
          : {
              resolved: true,
              lookupFailed: false,
              name: 'hinduja tech',
              website: 'hindujatech.com',
              industry: 'IT Services',
              size: '1001-5000',
              matchConfidence: 'low',
            },
      );
    const { upsertCompanies, ensureCompanyRows } = buildTool({
      resolveFromRawCompanyName,
    });

    const rows = await ensureCompanyRows(input, companies, context);

    expect(resolveFromRawCompanyName).toHaveBeenCalledTimes(2);
    const written = upsertCompanies.execute.mock.calls[0][0].companies;

    expect(written[0]).toEqual(
      expect.objectContaining({
        industry: 'Hospitals and Health Care',
        employees: '5001-10000',
        otherFields: expect.objectContaining({
          identitySource: 'index',
          linkedinUrl: 'https://www.linkedin.com/company/kokilaben',
        }),
      }),
    );
    // A low match never lends its facts: Hinduja stays as typed
    expect(written[1]).toEqual(
      expect.objectContaining({
        industry: '',
        employees: '',
        otherFields: { identitySource: 'model' },
      }),
    );
    expect(rows.map((row: Record<string, unknown>) => row.id)).toEqual([
      'row-1',
      'row-2',
    ]);
  });

  it('should write the companies as typed when the index lookup fails', async () => {
    const resolveFromRawCompanyName = jest
      .fn()
      .mockRejectedValue(new Error('index down'));
    const { upsertCompanies, ensureCompanyRows } = buildTool({
      resolveFromRawCompanyName,
    });

    await ensureCompanyRows(input, companies, context);

    expect(upsertCompanies.execute.mock.calls[0][0].companies).toEqual([
      expect.objectContaining({
        name: 'Kokilaben Dhirubhai Ambani Hospital',
        domain: 'kokilabenhospital.com',
        otherFields: { identitySource: 'model' },
      }),
      expect.objectContaining({ otherFields: { identitySource: 'model' } }),
    ]);
  });

  it('should not ask the index for a company the model already described', async () => {
    const resolveFromRawCompanyName = jest.fn();
    const { ensureCompanyRows } = buildTool({ resolveFromRawCompanyName });

    await ensureCompanyRows(
      input,
      [
        {
          name: 'Saifee Hospital',
          domain: 'saifeehospital.com',
          industry: 'Hospital',
          employees: 800,
        },
      ],
      context,
    );

    expect(resolveFromRawCompanyName).not.toHaveBeenCalled();
  });
});
