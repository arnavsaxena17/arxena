import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';

describe('TheOrgService', () => {
  let service: TheOrgService;
  let fileStorageService: jest.Mocked<FileStorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    delete process.env.THEORG_INLINE_PROFILE_MAX_PEOPLE;
    delete process.env.THEORG_STORAGE_PREFIX;
    delete process.env.THEORG_PERSIST_RESULTS;

    fileStorageService = {
      write: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FileStorageService>;

    service = new TheOrgService(fileStorageService);
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('persists person profile responses', async () => {
    const personHtml = `
      <html>
        <head>
          <link rel="canonical" href="https://theorg.com/org/marico/org-chart/jane-doe" />
        </head>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialPosition: {
                  id: 10,
                  slug: 'jane-doe',
                  fullName: 'Jane Doe',
                  currentRole: 'CEO',
                  profilePicture: null,
                  social: null,
                  locationV2: { city: 'Mumbai' },
                  offices: [],
                  teams: [],
                  reports: [],
                  previousCompanies: [],
                  roleTimeline: [],
                  companyV2: {
                    id: 'company-1',
                    slug: 'marico',
                    name: 'Marico',
                    logoImage: null,
                    verification: 'verified',
                    private: false,
                  },
                },
              },
            },
          })}</script>
        </body>
      </html>
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => personHtml,
    }) as any;

    const result = await service.fetchPersonProfileBySlugs('marico', 'jane-doe');

    expect(fileStorageService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'theorg/people/marico/jane-doe',
        name: 'latest.json',
        mimeType: 'application/json',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        fullName: 'Jane Doe',
        storage: {
          folderPath: 'theorg/people/marico/jane-doe',
          filename: 'latest.json',
          path: 'theorg/people/marico/jane-doe/latest.json',
        },
      }),
    );
  });

  it('persists company responses and defers inline profile enrichment for large orgs', async () => {
    process.env.THEORG_INLINE_PROFILE_MAX_PEOPLE = '1';
    process.env.THEORG_STORAGE_PREFIX = 'theorg-test';

    const companyHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialCompany: {
                  id: 'company-1',
                  slug: 'hawkins-cookers',
                  name: 'Hawkins Cookers Limited',
                  industries: [{ title: 'Appliances' }],
                  stats: { positionCount: 2 },
                },
                __APOLLO_STATE__: {
                  'FlatPosition:1': {
                    id: 1,
                    fullName: 'Bill Kerr',
                    role: 'CEO',
                    slug: 'bill-kerr',
                  },
                },
                initialNodes: [
                  {
                    id: 'node-1',
                    title: 'CEO',
                    containingNodeId: null,
                    order: 0,
                    parentId: null,
                    section: 'orgChart',
                    type: 'POSITION',
                    reportCount: 0,
                    node: {
                      position: {
                        id: 1,
                        fullName: 'Bill Kerr',
                        role: 'CEO',
                        slug: 'bill-kerr',
                        claimedBy: null,
                        hasNotes: false,
                        profileImage: null,
                        social: null,
                      },
                    },
                  },
                  {
                    id: 'node-2',
                    title: 'CFO',
                    containingNodeId: null,
                    order: 1,
                    parentId: 'node-1',
                    section: 'orgChart',
                    type: 'POSITION',
                    reportCount: 0,
                    node: {
                      position: {
                        id: 2,
                        fullName: 'Jane Roe',
                        role: 'CFO',
                        slug: 'jane-roe',
                        claimedBy: null,
                        hasNotes: false,
                        profileImage: null,
                        social: null,
                      },
                    },
                  },
                ],
              },
            },
          })}</script>
        </body>
      </html>
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => companyHtml,
    }) as any;

    const result = await service.fetchCompanyDetails('hawkins-cookers', {
      includePeopleProfiles: true,
    });

    expect(result.peopleProfilesDeferred).toBe(true);
    expect(result.people).toHaveLength(2);
    expect(fileStorageService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'theorg-test/companies/hawkins-cookers',
        name: 'latest.json',
        mimeType: 'application/json',
      }),
    );
    expect(result.storage).toEqual({
      folderPath: 'theorg-test/companies/hawkins-cookers',
      filename: 'latest.json',
      path: 'theorg-test/companies/hawkins-cookers/latest.json',
    });
  });
});
