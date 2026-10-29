import { utils, write } from 'xlsx';

import { type FileService } from 'src/engine/core-modules/file/services/file.service';
import {
  type CompanyNameResolverService,
  type ResolvedCompanyFromRawName,
} from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';
import {
  type OutreachCompaniesCacheService,
  type OutreachEphemeralCompany,
} from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { type OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { type OutreachSpreadsheetMappingService } from 'src/engine/core-modules/outreach-command/services/outreach-spreadsheet-mapping.service';
import { ImportOutreachSpreadsheetTool } from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-import-tool';
import { type OutreachSpreadsheetMapping } from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-mapping.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';

const buildSheet = (): Buffer => {
  const sheet = utils.aoa_to_sheet([
    ['Company', 'Website', 'LinkedIn'],
    ['Torrent Power', '', ''],
    ['Tata Group', '', ''],
    ['Nowhere Widgets', '', ''],
    ['Has Domain Co', 'hasdomain.com', ''],
    ['Has Linkedin Co', '', 'https://www.linkedin.com/company/has-linkedin'],
  ]);
  const workbook = utils.book_new();

  utils.book_append_sheet(workbook, sheet, 'Companies');

  return write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const MAPPING: OutreachSpreadsheetMapping = {
  company: {
    name: 'Company',
    domain: 'Website',
    extra: [
      { header: 'LinkedIn', key: 'linkedin', label: 'LinkedIn', type: 'url' },
    ],
  },
  peopleGroups: [],
};

const resolution = (
  overrides: Partial<ResolvedCompanyFromRawName>,
): ResolvedCompanyFromRawName => ({
  rawCompanyName: '',
  cleanedQuery: '',
  resolved: true,
  name: null,
  id: null,
  website: null,
  industry: null,
  country: null,
  linkedinUrl: null,
  countOrg: null,
  size: null,
  founded: null,
  corporateScore: null,
  isOrgChart: null,
  editDistance: 0,
  matchConfidence: 'high',
  alternates: [],
  lookupFailed: false,
  durationMs: 1,
  ...overrides,
});

const RESOLUTION_BY_NAME: Record<string, ResolvedCompanyFromRawName> = {
  'Torrent Power': resolution({
    name: 'Torrent Power Limited',
    website: 'https://www.torrentpower.com/',
    linkedinUrl: 'https://www.linkedin.com/company/torrent-power',
    size: '10001+',
  }),
  'Tata Group': resolution({
    name: 'Tata Consultancy Services',
    website: 'tcs.com',
    linkedinUrl: 'https://www.linkedin.com/company/tcs',
    matchConfidence: 'low',
    alternates: [
      {
        name: 'Tata Steel',
        website: 'tatasteel.com',
        linkedinUrl: 'https://www.linkedin.com/company/tata-steel',
        size: '10001+',
      },
    ],
  }),
  'Nowhere Widgets': resolution({
    resolved: false,
    matchConfidence: null,
    editDistance: null,
  }),
};

describe('ImportOutreachSpreadsheetTool company resolution', () => {
  let written: OutreachEphemeralCompany[];
  let resolver: jest.Mocked<
    Pick<CompanyNameResolverService, 'isEnabled' | 'resolveMany'>
  >;

  const buildTool = () =>
    new ImportOutreachSpreadsheetTool(
      {
        getFileContentById: jest
          .fn()
          .mockResolvedValue({ buffer: buildSheet() }),
      } as unknown as FileService,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(async (_workspaceId, _projectId, companies) => {
          written = companies;
        }),
      } as unknown as OutreachCompaniesCacheService,
      {} as OutreachPeopleCacheService,
      {} as OutreachSpreadsheetMappingService,
      resolver as unknown as CompanyNameResolverService,
    );

  const runImport = () =>
    buildTool().execute(
      {
        fileId: 'file-1',
        projectId: 'project-1',
        target: 'companies',
        mapping: MAPPING,
        mode: 'merge',
      },
      { workspaceId: 'workspace-1' } as ToolExecutionContext,
    );

  const companyNamed = (name: string) =>
    written.find((company) => company.name === name);

  beforeEach(() => {
    jest.clearAllMocks();
    written = [];
    resolver = {
      isEnabled: jest.fn().mockReturnValue(true),
      resolveMany: jest.fn(async (names: string[]) =>
        names.map((name) => RESOLUTION_BY_NAME[name]),
      ),
    };
  });

  it('should resolve only companies without a domain or LinkedIn URL', async () => {
    await runImport();

    expect(resolver.resolveMany).toHaveBeenCalledTimes(1);
    expect(resolver.resolveMany).toHaveBeenCalledWith([
      'Torrent Power',
      'Tata Group',
      'Nowhere Widgets',
    ]);
    expect(companyNamed('Has Domain Co')?.otherFields?.matchConfidence).toBe(
      undefined,
    );
  });

  it('should fill the domain and LinkedIn URL from a high-confidence match', async () => {
    await runImport();

    const company = companyNamed('Torrent Power');

    expect(company?.domain).toBe('torrentpower.com');
    expect(company?.status).toBe('new');
    expect(company?.otherFields).toMatchObject({
      matchConfidence: 'high',
      alternates: [],
      linkedinUrl: 'https://www.linkedin.com/company/torrent-power',
    });
  });

  it('should keep a low-confidence match unfilled and write its alternates', async () => {
    await runImport();

    const company = companyNamed('Tata Group');

    expect(company?.domain).toBe('');
    expect(company?.otherFields?.linkedinUrl).toBeUndefined();
    expect(company?.otherFields).toMatchObject({
      matchConfidence: 'low',
      matchedCompany: { name: 'Tata Consultancy Services' },
      alternates: [{ name: 'Tata Steel', website: 'tatasteel.com' }],
    });
  });

  it('should mark a company with no match as unresolvable', async () => {
    await runImport();

    expect(companyNamed('Nowhere Widgets')?.status).toBe('unresolvable');
  });

  it('should report the resolution counts in the result', async () => {
    const output = await runImport();

    expect(output.success).toBe(true);
    expect(output.result).toMatchObject({
      companyResolution: {
        status: 'done',
        checked: 3,
        resolved: 1,
        lowConfidence: 1,
        unresolvable: 1,
        lookupFailed: 0,
      },
    });
    expect(output.message).toContain(
      '1 resolved, 1 low confidence (check alternates), 1 unresolvable',
    );
  });

  it('should leave a company as imported when the lookup failed', async () => {
    resolver.resolveMany.mockImplementation(async (names: string[]) =>
      names.map(() => resolution({ resolved: false, lookupFailed: true })),
    );

    const output = await runImport();

    expect(companyNamed('Nowhere Widgets')?.status).toBe('new');
    expect(output.result).toMatchObject({
      companyResolution: { lookupFailed: 3, unresolvable: 0 },
    });
  });

  it('should skip resolution when the resolver is not configured', async () => {
    resolver.isEnabled.mockReturnValue(false);

    const output = await runImport();

    expect(resolver.resolveMany).not.toHaveBeenCalled();
    expect(output.result).toMatchObject({
      companyResolution: { status: 'skipped', checked: 3 },
    });
  });
});
