import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';

describe('TheOrgService', () => {
  let service: TheOrgService;
  let fileStorageService: jest.Mocked<FileStorageService>;
  let brightDataSerpService: jest.Mocked<
    Pick<BrightDataSerpService, 'isConfigured' | 'requestSerpGoogleJson'>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    delete process.env.THEORG_INLINE_PROFILE_MAX_PEOPLE;
    delete process.env.THEORG_STORAGE_PREFIX;
    delete process.env.THEORG_PERSIST_RESULTS;
    delete process.env.THEORG_OFFICE_PAGE_SIZE;

    fileStorageService = {
      write: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FileStorageService>;

    brightDataSerpService = {
      isConfigured: jest.fn().mockReturnValue(false),
      requestSerpGoogleJson: jest.fn(),
    };

    service = new TheOrgService(
      fileStorageService,
      brightDataSerpService as unknown as BrightDataSerpService,
    );
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

  it('maps org chart node profile images into orgChartPeople profileImageUrl', async () => {
    const companyHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialCompany: {
                  id: 'company-1',
                  slug: 'litify',
                  name: 'Litify',
                  industries: [{ title: 'Legal Tech' }],
                  stats: { positionCount: 1 },
                },
                __APOLLO_STATE__: {
                  'FlatPosition:1': {
                    id: 1,
                    fullName: 'Tom Mavis',
                    role: 'Vice President, Business Development',
                    slug: 'tom-mavis',
                    profileImage: {
                      endpoint: 'https://cdn.theorg.com',
                      ext: 'jpg',
                      uri: 'e8fe8757-d356-4e6f-b055-c494040c2315',
                      versions: ['thumb', 'xsmall', 'small', 'medium', 'large'],
                    },
                  },
                },
                initialNodes: [
                  {
                    id: 'p-11236725',
                    title: 'Tom Mavis',
                    containingNodeId: null,
                    order: 0,
                    parentId: null,
                    section: 'orgChart',
                    type: 'leaf',
                    reportCount: 0,
                    node: {
                      position: {
                        id: 11236725,
                        fullName: 'Tom Mavis',
                        role: 'Vice President, Business Development',
                        slug: 'tom-mavis',
                        claimedBy: null,
                        hasNotes: false,
                        profileImage: {
                          endpoint: 'https://cdn.theorg.com',
                          ext: 'jpg',
                          uri: 'e8fe8757-d356-4e6f-b055-c494040c2315',
                          versions: ['thumb', 'xsmall', 'small', 'medium', 'large'],
                        },
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

    const result = await service.fetchCompanyDetails('litify', {
      mode: 'orgchart',
    });

    expect(result.orgChartPeople).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Tom Mavis',
          profileImageUrl:
            'https://cdn.theorg.com/e8fe8757-d356-4e6f-b055-c494040c2315_medium.jpg',
        }),
      ]),
    );
    expect(result.people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Tom Mavis',
          profileImageUrl:
            'https://cdn.theorg.com/e8fe8757-d356-4e6f-b055-c494040c2315_medium.jpg',
        }),
      ]),
    );
  });

  it('rejects fetch when linkedinCompanySlugExpected mismatches page social.linkedInUrl', async () => {
    const companyHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialCompany: {
                  id: 'company-1',
                  slug: 'wrong-theorg-slug',
                  name: 'Wrong Co',
                  industries: [],
                  stats: { positionCount: 0 },
                  social: {
                    linkedInUrl: 'https://www.linkedin.com/company/some-other-li',
                  },
                },
                initialNodes: [],
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

    await expect(
      service.fetchCompanyDetails('wrong-theorg-slug', {
        mode: 'orgchart',
        linkedinCompanySlugExpected: 'expected-li-slug',
      }),
    ).rejects.toThrow('TheOrg LinkedIn company slug mismatch');
  });

  it('exposes linkedInCompanySlug from initialCompany.social.linkedInUrl', async () => {
    const companyHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialCompany: {
                  id: 'company-1',
                  slug: 'acme',
                  name: 'Acme',
                  industries: [],
                  stats: { positionCount: 0 },
                  social: {
                    linkedInUrl: 'https://www.linkedin.com/company/acme-ltd',
                  },
                },
                initialNodes: [],
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

    const result = await service.fetchCompanyDetails('acme', {
      mode: 'orgchart',
      linkedinCompanySlugExpected: 'acme-ltd',
    });

    expect(result.linkedInCompanySlug).toBe('acme-ltd');
  });

  it('maps team member profile images into teamPeople profileImageUrl', async () => {
    const companyHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialCompany: {
                  id: 'company-1',
                  slug: 'litify',
                  name: 'Litify',
                  industries: [{ title: 'Legal Tech' }],
                  stats: { positionCount: 0 },
                },
                initialTeams: [
                  {
                    id: 'leadership-team-id',
                    slug: 'leadership-team',
                    name: 'Leadership Team',
                    description: 'Leadership Team',
                    memberCount: 1,
                    members: [
                      {
                        id: 11236725,
                        fullName: 'Tom Mavis',
                        role: 'Vice President, Business Development',
                        slug: 'tom-mavis',
                        parentPositionId: null,
                        profileImage: {
                          endpoint: 'https://cdn.theorg.com',
                          ext: 'jpg',
                          uri: 'e8fe8757-d356-4e6f-b055-c494040c2315',
                          versions: ['thumb', 'xsmall', 'small', 'medium', 'large'],
                        },
                        lastUpdate: '2024-02-11T06:44:12.665',
                      },
                    ],
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

    const result = await service.fetchCompanyDetails('litify', {
      mode: 'teams',
    });

    expect(result.teamPeople).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Tom Mavis',
          profileImageUrl:
            'https://cdn.theorg.com/e8fe8757-d356-4e6f-b055-c494040c2315_medium.jpg',
        }),
      ]),
    );
    expect(result.people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Tom Mavis',
          profileImageUrl:
            'https://cdn.theorg.com/e8fe8757-d356-4e6f-b055-c494040c2315_medium.jpg',
        }),
      ]),
    );
  });

  it('fetches and paginates office people into officePeople and combined people', async () => {
    process.env.THEORG_OFFICE_PAGE_SIZE = '2';

    const companyHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialCompany: {
                  id: 'company-1',
                  slug: 'lilavati-hospital-research-centre',
                  name: 'Lilavati Hospital',
                  industries: [{ title: 'Healthcare' }],
                  stats: { positionCount: 4, officesCount: 1, teamsCount: 0 },
                  offices: [
                    {
                      id: 'office-hq',
                      slug: 'hq',
                      name: 'HQ',
                      description: 'Headquarters',
                      positionCount: 3,
                      jobPostCount: 0,
                      positions: [
                        {
                          id: 1,
                          fullName: 'Preview Only',
                          profileImage: null,
                        },
                      ],
                    },
                  ],
                },
                initialTeams: [],
                initialNodes: [],
              },
            },
          })}</script>
        </body>
      </html>
    `;

    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('prod-graphql-api.theorg.com')) {
        const body = JSON.parse(String(init?.body || '{}'));
        const offset = Number(body.variables?.positionsOffset ?? 0);

        const pages: Record<number, Array<Record<string, unknown>>> = {
          0: [
            {
              id: 10,
              fullName: 'Dr. Sindhu Kode',
              role: 'Intensivist',
              slug: 'dr-sindhu-kode',
              parentPositionId: null,
              lastUpdate: '2024-01-01T00:00:00.000Z',
              profileImage: {
                endpoint: 'https://cdn.theorg.com',
                ext: 'jpg',
                uri: 'office-person-1',
                versions: ['medium'],
              },
            },
            {
              id: 11,
              fullName: 'Sudheer Ambekar',
              role: 'Neurosurgeon',
              slug: 'sudheer-ambekar',
              parentPositionId: null,
              profileImage: null,
            },
          ],
          2: [
            {
              id: 12,
              fullName: 'Priyanka Bisht',
              role: 'Head International Marketing',
              slug: 'priyanka-bisht',
              parentPositionId: null,
              profileImage: null,
            },
          ],
        };

        return {
          ok: true,
          json: async () => ({
            data: {
              companyOffice: {
                id: 'office-hq',
                positionCount: 3,
                positions: pages[offset] || [],
              },
            },
          }),
        };
      }

      return {
        ok: true,
        text: async () => companyHtml,
      };
    });

    global.fetch = fetchMock as any;

    const result = await service.fetchCompanyDetails(
      'lilavati-hospital-research-centre',
      { mode: 'offices' },
    );

    expect(result.officeCount).toBe(1);
    expect(result.officePeopleCount).toBe(3);
    expect(result.officePeople).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Dr. Sindhu Kode',
          role: 'Intensivist',
          source: 'office',
          sources: ['offices'],
          officeSlugs: ['hq'],
          profileImageUrl:
            'https://cdn.theorg.com/office-person-1_medium.jpg',
        }),
        expect.objectContaining({
          name: 'Priyanka Bisht',
          officeNames: ['HQ'],
        }),
      ]),
    );
    expect(result.people).toHaveLength(3);
    expect(result.people.every((person) => person.sources?.includes('offices'))).toBe(
      true,
    );

    const graphqlCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('prod-graphql-api.theorg.com'),
    );
    expect(graphqlCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('includes office people when mode is combined', async () => {
    const companyHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                initialCompany: {
                  id: 'company-1',
                  slug: 'demo-co',
                  name: 'Demo Co',
                  industries: [],
                  stats: { positionCount: 1, officesCount: 1 },
                  offices: [
                    {
                      id: 'office-1',
                      slug: 'hq',
                      name: 'HQ',
                      positionCount: 1,
                      positions: [],
                    },
                  ],
                },
                initialTeams: [],
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
                        fullName: 'Org Chart Person',
                        role: 'CEO',
                        slug: 'org-chart-person',
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

    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('prod-graphql-api.theorg.com')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              companyOffice: {
                id: 'office-1',
                positionCount: 1,
                positions: [
                  {
                    id: 99,
                    fullName: 'Office Person',
                    role: 'Manager',
                    slug: 'office-person',
                    parentPositionId: null,
                    profileImage: null,
                  },
                ],
              },
            },
          }),
        };
      }

      return {
        ok: true,
        text: async () => companyHtml,
      };
    }) as any;

    const result = await service.fetchCompanyDetails('demo-co', {
      mode: 'combined',
    });

    expect(result.orgChartPeopleCount).toBe(1);
    expect(result.officePeopleCount).toBe(1);
    expect(result.people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Org Chart Person' }),
        expect.objectContaining({
          name: 'Office Person',
          sources: ['offices'],
        }),
      ]),
    );
  });
});
