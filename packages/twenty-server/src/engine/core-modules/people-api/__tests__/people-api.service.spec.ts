jest.mock('../services/people-linkedin-sourcing.service', () => ({
  PeopleLinkedInSourcingService: jest.fn().mockImplementation(() => ({
    isUnipileConfigured: jest.fn().mockReturnValue(true),
    search: jest.fn(),
  })),
}));

import { HttpException, HttpStatus } from '@nestjs/common';

import type { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import type { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import type { ContactOutPeopleSearchService } from 'src/engine/core-modules/org-chart/services/contactout-people-search.service';
import type { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import type { PdlPersonOrgMovementService } from 'src/engine/core-modules/org-chart/services/pdl-person-org-movement.service';
import type { PeopleEsService } from 'src/engine/core-modules/org-chart/services/people-es.service';

import type { PeopleSearchByTaxonomyDto } from '../dto/people-search-by-taxonomy.dto';
import type { PeopleSearchDto } from '../dto/people-search.dto';
import { PeopleApiService } from '../people-api.service';
import type { PeopleCompanyScopeResolver } from '../services/people-company-scope.resolver';
import type { PeopleLinkedInSourcingService } from '../services/people-linkedin-sourcing.service';
import type { PeopleLocationScopeResolver } from '../services/people-location-scope.resolver';
import type { PeopleSearchDataSourceResolver } from '../services/people-search-data-source.resolver';
import {
  PEOPLE_SEARCH_COMPANY_REQUIRED_MESSAGE,
  type PeopleNaturalLanguageParserService,
} from '../services/people-natural-language-parser.service';

const createPassthroughCompanyScopeResolver = (): PeopleCompanyScopeResolver =>
  ({
    resolve: jest.fn(
      async (input: {
        companyName?: string;
        companyId?: string;
        website?: string;
      }) => ({
        companyName: input.companyName,
        companyId: input.companyId,
        website: input.website,
        resolvedVia:
          input.companyId || input.website ? 'provided' : 'unresolved',
      }),
    ),
  }) as unknown as PeopleCompanyScopeResolver;

const createPassthroughLocationScopeResolver = (): PeopleLocationScopeResolver =>
  ({
    resolve: jest.fn(
      async (input: { location?: string; country?: string }) => ({
        raw: input.location,
        linkedinLocationName: input.location,
        resolvedVia: input.location ? 'unresolved' : 'omitted',
      }),
    ),
  }) as unknown as PeopleLocationScopeResolver;

const createIndexDataSourceResolver = (): PeopleSearchDataSourceResolver =>
  ({
    resolve: jest.fn(
      async (input: { dataSource?: string; accountId?: string }) => ({
        dataSource:
          input.dataSource && input.dataSource !== 'auto'
            ? input.dataSource
            : 'index',
        accountId: input.accountId,
      }),
    ),
  }) as unknown as PeopleSearchDataSourceResolver;

const createNaturalLanguageParser = (): PeopleNaturalLanguageParserService =>
  ({
    parse: jest.fn(async (naturalLanguage: string) => {
      const trimmed = naturalLanguage.trim();
      if (trimmed === 'CEO at StayVista') {
        return {
          jobTitle: 'CEO',
          companyName: 'StayVista',
          locations: [],
        };
      }
      if (trimmed === 'CEO at StayVista in India') {
        return {
          jobTitle: 'CEO',
          companyName: 'StayVista',
          locations: ['India'],
        };
      }
      if (trimmed === 'CEO at Acme in UAE and Saudi Arabia') {
        return {
          jobTitle: 'CEO',
          companyName: 'Acme',
          locations: ['UAE', 'Saudi Arabia'],
        };
      }
      return { jobTitle: trimmed, locations: [] };
    }),
  }) as unknown as PeopleNaturalLanguageParserService;

describe('PeopleApiService.searchPeople naturalLanguage (legacy jobTitle path)', () => {
  const peopleEsService = {
    isEnabled: jest.fn().mockReturnValue(true),
    searchPeople: jest.fn().mockResolvedValue({
      total: 1,
      items: [{ full_name: 'Jane Doe', job_title: 'VP Engineering' }],
    }),
  } as unknown as PeopleEsService;

  const titleTaxonomyRemoteService = {
    classifyTitle: jest.fn().mockResolvedValue({
      title: 'VP Engineering',
      normalized_title: 'vp engineering',
      function_root: {
        id: 'engineering',
        label: 'engineering',
        name: 'engineering',
        parent_id: null,
        level: 1,
      },
      function: {
        id: 'engineering',
        label: 'engineering',
        name: 'engineering',
        parent_id: 'engineering',
        level: 2,
      },
      grade: {
        id: 'leadership',
        label: 'leadership',
        name: 'leadership',
        parent_id: 'senior',
        level: 'senior',
      },
      confidence: 0.75,
    }),
    classifyTitles: jest.fn(),
    classifyProfiles: jest.fn(),
    getFunctionRoots: jest.fn(),
    getFunctions: jest.fn(),
  } as unknown as TitleTaxonomyRemoteService;

  const peopleLinkedInSourcingService = {
    isUnipileConfigured: jest.fn().mockReturnValue(true),
    search: jest.fn(),
  } as unknown as PeopleLinkedInSourcingService;

  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(true),
  } as unknown as HarvestLinkedinService;

  const service = new PeopleApiService(
    peopleEsService,
    titleTaxonomyRemoteService,
    {} as ApolloIoRestService,
    {} as PdlPersonOrgMovementService,
    {} as ContactOutPeopleSearchService,
    harvestLinkedinService,
    peopleLinkedInSourcingService,
    createPassthroughCompanyScopeResolver(),
    createPassthroughLocationScopeResolver(),
    createNaturalLanguageParser(),
    createIndexDataSourceResolver(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies job title and searches people with resolved std filters', async () => {
    const result = await service.searchPeople({
      naturalLanguage: 'VP Engineering',
      companyId: 'acme',
      limit: 10,
    });

    expect(titleTaxonomyRemoteService.classifyTitle).toHaveBeenCalledWith(
      'VP Engineering',
    );
    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'acme',
        stdFunction: 'engineering',
        stdGrade: 'leadership',
        jobTitle: 'VP Engineering',
        limit: 10,
      }),
    );
    expect(result.resolved).toEqual({
      jobTitle: 'VP Engineering',
      normalizedTitle: 'vp engineering',
      stdFunction: 'engineering',
      stdFunctionRoot: 'engineering',
      stdGrade: 'leadership',
      confidence: 0.75,
      locations: [],
    });
    expect(result.items).toHaveLength(1);
  });

  it('parses company from a natural-language job title utterance', async () => {
    const result = await service.searchPeople({
      naturalLanguage: 'CEO at StayVista',
      limit: 10,
    });

    expect(titleTaxonomyRemoteService.classifyTitle).toHaveBeenCalledWith(
      'CEO',
    );
    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'StayVista',
        jobTitle: 'CEO',
      }),
    );
    expect(result.resolved.jobTitle).toBe('CEO');
  });

  it('requires company scope', async () => {
    await expect(
      service.searchPeople({ naturalLanguage: 'VP Engineering' }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      message: PEOPLE_SEARCH_COMPANY_REQUIRED_MESSAGE,
    });
  });

  it('returns 422 when taxonomy cannot resolve function or grade', async () => {
    (
      titleTaxonomyRemoteService.classifyTitle as jest.Mock
    ).mockResolvedValueOnce({
      title: 'unknown',
      normalized_title: 'unknown',
      function_root: null,
      function: null,
      grade: null,
      confidence: 0,
    });

    await expect(
      service.searchPeople({
        naturalLanguage: 'unknown',
        companyId: 'acme',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });

  it('should search with company id and website from name resolution', async () => {
    const peopleCompanyScopeResolver = {
      resolve: jest.fn().mockResolvedValue({
        companyName: 'StayVista',
        companyId: 'stay-vista',
        website: 'stayvista.com',
        linkedinUrl: 'https://www.linkedin.com/company/stay-vista/',
        resolvedVia: 'serp_domain',
      }),
    } as unknown as PeopleCompanyScopeResolver;

    const scopedService = new PeopleApiService(
      peopleEsService,
      titleTaxonomyRemoteService,
      {} as ApolloIoRestService,
      {} as PdlPersonOrgMovementService,
      {} as ContactOutPeopleSearchService,
      harvestLinkedinService,
      peopleLinkedInSourcingService,
      peopleCompanyScopeResolver,
      createPassthroughLocationScopeResolver(),
      createNaturalLanguageParser(),
      createIndexDataSourceResolver(),
    );

    const result = await scopedService.searchPeople({
      naturalLanguage: 'CEO at StayVista',
      limit: 10,
    });

    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'StayVista',
        companyId: 'stay-vista',
        website: 'stayvista.com',
        jobTitle: 'CEO',
      }),
    );
    expect(result.query?.company).toMatchObject({
      name: 'StayVista',
      slug: 'stay-vista',
      website: 'stayvista.com',
      resolvedVia: 'serp_domain',
    });
  });
});

describe('PeopleApiService.searchPeople naturalLanguage', () => {
  const peopleEsService = {
    isEnabled: jest.fn().mockReturnValue(true),
    searchPeople: jest.fn().mockResolvedValue({
      total: 1,
      items: [{ full_name: 'Jane Doe', job_title: 'CEO' }],
    }),
  } as unknown as PeopleEsService;

  const titleTaxonomyRemoteService = {
    classifyTitle: jest.fn().mockResolvedValue({
      title: 'CEO',
      normalized_title: 'ceo',
      function_root: {
        id: 'corporate',
        label: 'corporate',
        name: 'corporate',
        parent_id: null,
        level: 1,
      },
      function: {
        id: 'corporate',
        label: 'corporate',
        name: 'corporate',
        parent_id: 'corporate',
        level: 2,
      },
      grade: {
        id: 'leadership',
        label: 'leadership',
        name: 'leadership',
        parent_id: 'senior',
        level: 'senior',
      },
      confidence: 0.9,
    }),
    classifyTitles: jest.fn(),
    classifyProfiles: jest.fn(),
    getFunctionRoots: jest.fn(),
    getFunctions: jest.fn(),
  } as unknown as TitleTaxonomyRemoteService;

  const peopleLinkedInSourcingService = {
    isUnipileConfigured: jest.fn().mockReturnValue(true),
    search: jest.fn(),
  } as unknown as PeopleLinkedInSourcingService;

  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(true),
  } as unknown as HarvestLinkedinService;

  const peopleNaturalLanguageParser = createNaturalLanguageParser();

  const service = new PeopleApiService(
    peopleEsService,
    titleTaxonomyRemoteService,
    {} as ApolloIoRestService,
    {} as PdlPersonOrgMovementService,
    {} as ContactOutPeopleSearchService,
    harvestLinkedinService,
    peopleLinkedInSourcingService,
    createPassthroughCompanyScopeResolver(),
    createPassthroughLocationScopeResolver(),
    peopleNaturalLanguageParser,
    createIndexDataSourceResolver(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should classify an utterance and search when company is in the phrase', async () => {
    const result = await service.searchPeople({
      naturalLanguage: 'CEO at StayVista',
      limit: 10,
    });

    expect(titleTaxonomyRemoteService.classifyTitle).toHaveBeenCalledWith(
      'CEO',
    );
    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'StayVista',
        stdFunction: 'corporate',
        stdGrade: 'leadership',
        jobTitle: 'CEO',
        limit: 10,
      }),
    );
    expect(result.resolved).toEqual({
      jobTitle: 'CEO',
      normalizedTitle: 'ceo',
      stdFunction: 'corporate',
      stdFunctionRoot: 'corporate',
      stdGrade: 'leadership',
      confidence: 0.9,
      locations: [],
    });
  });

  it('should pass location from the utterance into search and resolved', async () => {
    const result = await service.searchPeople({
      naturalLanguage: 'CEO at StayVista in India',
      limit: 10,
    });

    expect(titleTaxonomyRemoteService.classifyTitle).toHaveBeenCalledWith(
      'CEO',
    );
    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'StayVista',
        country: 'India',
        jobTitle: 'CEO',
      }),
    );
    expect(result.resolved).toEqual({
      jobTitle: 'CEO',
      normalizedTitle: 'ceo',
      stdFunction: 'corporate',
      stdFunctionRoot: 'corporate',
      stdGrade: 'leadership',
      confidence: 0.9,
      locations: ['India'],
    });
  });

  it('should classify jobTitle without parsing natural language', async () => {
    const result = await service.searchPeople({
      jobTitle: 'CEO',
      companyName: 'StayVista',
      locations: ['united Arab Emirates', 'Saudi Arabia'],
      limit: 10,
    });

    expect(peopleNaturalLanguageParser.parse).not.toHaveBeenCalled();
    expect(titleTaxonomyRemoteService.classifyTitle).toHaveBeenCalledWith(
      'CEO',
    );
    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: 'CEO',
        companyName: 'StayVista',
        stdFunction: 'corporate',
        stdGrade: 'leadership',
        limit: 10,
      }),
    );
    expect(result.resolved).toEqual({
      jobTitle: 'CEO',
      normalizedTitle: 'ceo',
      stdFunction: 'corporate',
      stdFunctionRoot: 'corporate',
      stdGrade: 'leadership',
      confidence: 0.9,
      locations: ['united Arab Emirates', 'Saudi Arabia'],
    });
  });

  it('should skip natural-language parse when jobTitle is already provided', async () => {
    await service.searchPeople({
      naturalLanguage: 'CEO at StayVista in India',
      jobTitle: 'CEO',
      companyName: 'StayVista',
      locations: ['united Arab Emirates', 'Saudi Arabia'],
      limit: 10,
    });

    expect(peopleNaturalLanguageParser.parse).not.toHaveBeenCalled();
    expect(titleTaxonomyRemoteService.classifyTitle).toHaveBeenCalledWith(
      'CEO',
    );
    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: 'CEO',
        companyName: 'StayVista',
        stdFunction: 'corporate',
        stdGrade: 'leadership',
      }),
    );
  });

  it('should omit unclassified function from search while keeping it on resolved', async () => {
    (
      titleTaxonomyRemoteService.classifyTitle as jest.Mock
    ).mockResolvedValueOnce({
      title: 'CEO',
      normalized_title: 'ceo',
      function_root: null,
      function: {
        id: 'unclassified',
        label: 'unclassified',
        name: 'unclassified',
      },
      grade: {
        id: 'leadership',
        label: 'leadership',
        name: 'leadership',
      },
      confidence: 0.4,
    });

    const result = await service.searchPeople({
      jobTitle: 'CEO',
      companyName: 'StayVista',
    });

    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: 'CEO',
        companyName: 'StayVista',
        stdGrade: 'leadership',
      }),
    );
    expect(peopleEsService.searchPeople.mock.calls[0][0].stdFunction).toBeUndefined();
    expect(peopleEsService.searchPeople.mock.calls[0][0].stdFunctionRoot).toBeUndefined();
    expect(result.resolved).toMatchObject({
      jobTitle: 'CEO',
      stdFunction: 'unclassified',
      stdFunctionRoot: null,
      stdGrade: 'leadership',
    });
  });

  it('should ask for company name when the utterance has no company', async () => {
    await expect(
      service.searchPeople({ naturalLanguage: 'CHRO' }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      message: PEOPLE_SEARCH_COMPANY_REQUIRED_MESSAGE,
    });
  });

  it('should use an explicit company when the utterance has none', async () => {
    await service.searchPeople({
      naturalLanguage: 'CHRO',
      companyName: 'Apple',
    });

    expect(titleTaxonomyRemoteService.classifyTitle).toHaveBeenCalledWith(
      'CHRO',
    );
    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Apple',
        jobTitle: 'CHRO',
      }),
    );
  });
});

describe('PeopleApiService.searchPeopleByTaxonomy', () => {
  const peopleEsService = {
    isEnabled: jest.fn().mockReturnValue(true),
  } as unknown as PeopleEsService;

  const titleTaxonomyRemoteService = {
    classifyTitles: jest.fn(),
    classifyProfiles: jest.fn().mockResolvedValue([
      {
        title: 'VP Engineering',
        normalized_title: 'vp engineering',
        function_root: { id: 'engineering', name: 'engineering' },
        function: { id: 'software engineering', name: 'software engineering' },
        grade: { id: 'leadership', name: 'leadership' },
        confidence: 0.8,
      },
      {
        title: 'Account Executive',
        normalized_title: 'account executive',
        function_root: { id: 'sales', name: 'sales' },
        function: { id: 'sales', name: 'sales' },
        grade: { id: 'mid', name: 'mid' },
        confidence: 0.7,
      },
    ]),
    getFunctions: jest.fn().mockResolvedValue([
      {
        id: 'software engineering',
        label: 'software engineering',
        name: 'software engineering',
        parent_id: 'engineering',
        level: 2,
      },
      {
        id: 'sales',
        label: 'sales',
        name: 'sales',
        parent_id: 'sales',
        level: 2,
      },
    ]),
  } as unknown as TitleTaxonomyRemoteService;

  const peopleLinkedInSourcingService = {
    isUnipileConfigured: jest.fn().mockReturnValue(true),
    search: jest.fn().mockResolvedValue({
      dataSource: 'unipile',
      keywords: 'engineer OR engineering',
      appliedFilters: {
        functionIds: ['8'],
        seniorities: ['cxo', 'director'],
      },
      company: {
        name: 'Stripe',
        slug: 'stripe',
        linkedinUrl: 'https://www.linkedin.com/company/stripe/',
      },
      items: [
        { jobTitle: 'VP Engineering', name: 'Alex' },
        { jobTitle: 'Account Executive', name: 'Sam' },
      ],
    }),
  } as unknown as PeopleLinkedInSourcingService;

  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(true),
  } as unknown as HarvestLinkedinService;

  const service = new PeopleApiService(
    peopleEsService,
    titleTaxonomyRemoteService,
    {} as ApolloIoRestService,
    {} as PdlPersonOrgMovementService,
    {} as ContactOutPeopleSearchService,
    harvestLinkedinService,
    peopleLinkedInSourcingService,
    createPassthroughCompanyScopeResolver(),
    createPassthroughLocationScopeResolver(),
    createNaturalLanguageParser(),
    createIndexDataSourceResolver(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects stdGrade alone', async () => {
    await expect(
      service.searchPeopleByTaxonomy(
        {
          website: 'stripe.com',
          stdGrade: 'leadership',
        },
        'token',
      ),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });

  it('defaults to unipile and filters by stdFunctionRoot + stdGrade', async () => {
    const result = await service.searchPeopleByTaxonomy(
      {
        website: 'stripe.com',
        stdFunctionRoot: 'engineering',
        stdGrade: 'leadership',
        accountId: 'acct-1',
      },
      'token',
    );

    expect(peopleLinkedInSourcingService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSource: 'unipile',
        accountId: 'acct-1',
        stdFunctionRoot: 'engineering',
        stdGrade: 'leadership',
        apiToken: 'token',
      }),
    );
    expect(titleTaxonomyRemoteService.classifyTitles).not.toHaveBeenCalled();
    expect(titleTaxonomyRemoteService.classifyProfiles).toHaveBeenCalledWith([
      { jobTitle: 'VP Engineering', experience: [] },
      { jobTitle: 'Account Executive', experience: [] },
    ]);
    expect(result.dataSource).toBe('unipile');
    expect(result.totalBeforeFilter).toBe(2);
    expect(result.total).toBe(1);
    expect(result.items[0].resolved.stdFunctionRoot).toBe('engineering');
    expect(result.query.appliedFilters?.functionIds).toEqual(['8']);
  });

  it('uses classifyProfiles when hits include experience history', async () => {
    (
      peopleLinkedInSourcingService.search as jest.Mock
    ).mockResolvedValueOnce({
      dataSource: 'unipile',
      keywords: 'engineer OR engineering',
      appliedFilters: {
        functionIds: ['8'],
        seniorities: ['cxo', 'director'],
      },
      company: {
        name: 'Stripe',
        slug: 'stripe',
        linkedinUrl: 'https://www.linkedin.com/company/stripe/',
      },
      items: [
        {
          jobTitle: 'Product Strategy & GTM',
          name: 'Alex',
          experience: [
            { title: { name: 'VP Product' }, endDate: '2024-01-01' },
          ],
        },
      ],
    });
    (
      titleTaxonomyRemoteService.classifyProfiles as jest.Mock
    ).mockResolvedValueOnce([
      {
        title: 'Product Strategy & GTM',
        normalized_title: 'product strategy gtm',
        function_root: { id: 'product', name: 'product' },
        function: { id: 'product', name: 'product' },
        grade: { id: 'leadership', name: 'leadership' },
        confidence: 0.75,
      },
    ]);

    const result = await service.searchPeopleByTaxonomy(
      {
        website: 'stripe.com',
        stdFunctionRoot: 'product',
        stdGrade: 'leadership',
        accountId: 'acct-1',
      },
      'token',
    );

    expect(titleTaxonomyRemoteService.classifyTitles).not.toHaveBeenCalled();
    expect(titleTaxonomyRemoteService.classifyProfiles).toHaveBeenCalledWith([
      {
        jobTitle: 'Product Strategy & GTM',
        experience: [
          {
            title: 'VP Product',
            startDate: null,
            endDate: '2024-01-01',
            isCurrent: false,
          },
        ],
      },
    ]);
    expect(result.total).toBe(1);
    expect(result.items[0].resolved.stdFunctionRoot).toBe('product');
  });

  it('sends Unipile current_positions and work_experience to classifyProfiles', async () => {
    (
      peopleLinkedInSourcingService.search as jest.Mock
    ).mockResolvedValueOnce({
      dataSource: 'unipile',
      keywords: null,
      appliedFilters: { functionIds: [], seniorities: [] },
      company: {
        name: 'Korn Ferry',
        slug: 'kornferry',
        linkedinUrl: 'https://www.linkedin.com/company/kornferry/',
      },
      items: [
        {
          headline:
            'Director of Talent Solutions | Speaker & Facilitator | Strategic Communication',
          current_positions: [
            {
              role: 'Director of Talent Solutions | Interim Executive & Professional Search',
              start: { year: 2021, month: 3 },
            },
          ],
          work_experience: [
            {
              role: 'Talent Lead',
              start: { year: 2018, month: 1 },
              end: { year: 2021, month: 2 },
            },
          ],
        },
      ],
    });
    (
      titleTaxonomyRemoteService.classifyProfiles as jest.Mock
    ).mockResolvedValueOnce([
      {
        title:
          'Director of Talent Solutions | Interim Executive & Professional Search',
        normalized_title: 'director of talent solutions',
        function_root: { id: 'human resources', name: 'human resources' },
        function: { id: 'talent acquisition', name: 'talent acquisition' },
        grade: { id: 'leadership', name: 'leadership' },
        confidence: 0.8,
      },
    ]);

    await service.searchPeopleByTaxonomy(
      {
        website: 'kornferry.com',
        stdFunctionRoot: 'human resources',
        stdGrade: 'leadership',
        accountId: 'acct-1',
      },
      'token',
    );

    expect(titleTaxonomyRemoteService.classifyProfiles).toHaveBeenCalledWith([
      {
        jobTitle:
          'Director of Talent Solutions | Interim Executive & Professional Search',
        experience: [
          {
            title:
              'Director of Talent Solutions | Interim Executive & Professional Search',
            startDate: '2021-03-01',
            endDate: null,
            isCurrent: true,
          },
          {
            title: 'Talent Lead',
            startDate: '2018-01-01',
            endDate: '2021-02-01',
            isCurrent: false,
          },
        ],
      },
    ]);
  });

  it('classifies the current_position whose company_id matches, not current_positions[0]', async () => {
    (
      peopleLinkedInSourcingService.search as jest.Mock
    ).mockResolvedValueOnce({
      dataSource: 'unipile',
      keywords: null,
      appliedFilters: { functionIds: [], seniorities: [] },
      company: {
        name: 'Mazaya',
        slug: 'mazaya-arabia',
        linkedinUrl: 'https://www.linkedin.com/company/mazaya-arabia/',
        id: '68533040',
      },
      items: [
        {
          name: 'Hani Abdelrahman',
          headline: 'Project management',
          jobTitles: ['Co-Founder'],
          current_positions: [
            {
              role: 'Co-Founder',
              company: 'Intelligent Brain project management',
              company_id: '111',
            },
            {
              role: 'Operation Manager',
              company: 'Mazaya international',
              company_id: '68533040',
            },
          ],
        },
      ],
    });
    (
      titleTaxonomyRemoteService.classifyProfiles as jest.Mock
    ).mockResolvedValueOnce([
      {
        title: 'Operation Manager',
        stdFunction: 'operations',
        stdFunctionRoot: 'operations',
        stdGrade: 'mid',
      },
    ]);

    const result = await service.searchPeopleByTaxonomy(
      {
        companyName: 'Mazaya',
        stdFunction: 'ceo',
        dataSource: 'unipile',
      },
      'token',
    );

    expect(titleTaxonomyRemoteService.classifyProfiles).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: 'Hani Abdelrahman',
          title: 'Operation Manager',
        }),
      ],
      expect.any(String),
    );
    expect(result.total).toBe(0);
    expect(result.totalBeforeFilter).toBe(1);
  });

  it('drops people whose current roles are at another company before taxonomy classify', async () => {
    (
      peopleLinkedInSourcingService.search as jest.Mock
    ).mockResolvedValueOnce({
      dataSource: 'unipile',
      keywords: null,
      appliedFilters: { functionIds: [], seniorities: [] },
      company: {
        name: 'Mazaya',
        slug: 'mazaya-arabia',
        linkedinUrl: 'https://www.linkedin.com/company/mazaya-arabia/',
        id: '68533040',
      },
      items: [
        {
          name: 'Hani Abdelrahman',
          headline: 'Project management',
          jobTitles: ['Co-Founder'],
          current_positions: [
            {
              role: 'Co-Founder',
              company: 'Intelligent Brain project management',
              company_id: '111',
            },
          ],
        },
        {
          name: 'Sara Ali',
          current_positions: [
            {
              role: 'Operation Manager',
              company: 'Mazaya international',
              company_id: '68533040',
            },
          ],
        },
      ],
    });
    (
      titleTaxonomyRemoteService.classifyProfiles as jest.Mock
    ).mockResolvedValueOnce([
      {
        title: 'Operation Manager',
        normalized_title: 'operation manager',
        function_root: { id: 'operations', name: 'operations' },
        function: { id: 'operations', name: 'operations' },
        grade: { id: 'mid', name: 'mid' },
        confidence: 0.8,
      },
    ]);

    const result = await service.searchPeopleByTaxonomy(
      {
        companyName: 'Mazaya',
        stdFunction: 'operations',
        dataSource: 'unipile',
      },
      'token',
    );

    expect(titleTaxonomyRemoteService.classifyProfiles).toHaveBeenCalledWith([
      { jobTitle: 'Operation Manager', experience: [] },
    ]);
    expect(result.totalBeforeFilter).toBe(2);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      name: 'Sara Ali',
      resolved: { stdFunction: 'operations' },
    });
  });

  it('throws when taxonomy batch classify is unavailable', async () => {
    (
      titleTaxonomyRemoteService.classifyProfiles as jest.Mock
    ).mockResolvedValueOnce(null);

    await expect(
      service.searchPeopleByTaxonomy(
        {
          companyName: 'Stripe',
          stdFunction: 'software engineering',
        },
        'token',
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects an unknown stdFunction', async () => {
    await expect(
      service.searchPeopleByTaxonomy(
        {
          website: 'stripe.com',
          stdFunction: 'not a real function',
        },
        'token',
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        stdFunctionRoot: null,
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'software engineering' }),
          expect.objectContaining({ id: 'sales' }),
        ]),
      },
    });
  });

  it('rejects an unknown stdFunctionRoot', async () => {
    await expect(
      service.searchPeopleByTaxonomy(
        {
          website: 'stripe.com',
          stdFunctionRoot: 'not a department',
        } as PeopleSearchByTaxonomyDto,
        'token',
      ),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });
});

describe('PeopleApiService.searchPeople taxonomy filters', () => {
  const peopleEsService = {
    isEnabled: jest.fn().mockReturnValue(true),
    searchPeople: jest.fn().mockResolvedValue({ total: 0, items: [] }),
  } as unknown as PeopleEsService;

  const titleTaxonomyRemoteService = {
    classifyTitle: jest.fn(),
    classifyTitles: jest.fn(),
    classifyProfiles: jest.fn(),
    getFunctionRoots: jest.fn(),
    getFunctions: jest.fn().mockResolvedValue([
      {
        id: 'software engineering',
        label: 'software engineering',
        name: 'software engineering',
        parent_id: 'engineering',
        level: 2,
      },
      {
        id: 'data science',
        label: 'data science',
        name: 'data science',
        parent_id: 'engineering',
        level: 2,
      },
      {
        id: 'talent acquisition',
        label: 'talent acquisition',
        name: 'talent acquisition',
        parent_id: 'human resources',
        level: 2,
      },
    ]),
  } as unknown as TitleTaxonomyRemoteService;

  const service = new PeopleApiService(
    peopleEsService,
    titleTaxonomyRemoteService,
    {} as ApolloIoRestService,
    {} as PdlPersonOrgMovementService,
    {} as ContactOutPeopleSearchService,
    {
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as HarvestLinkedinService,
    {
      isUnipileConfigured: jest.fn().mockReturnValue(true),
      search: jest.fn(),
    } as unknown as PeopleLinkedInSourcingService,
    createPassthroughCompanyScopeResolver(),
    createPassthroughLocationScopeResolver(),
    createNaturalLanguageParser(),
    createIndexDataSourceResolver(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (titleTaxonomyRemoteService.getFunctions as jest.Mock).mockResolvedValue([
      {
        id: 'software engineering',
        label: 'software engineering',
        name: 'software engineering',
        parent_id: 'engineering',
        level: 2,
      },
      {
        id: 'data science',
        label: 'data science',
        name: 'data science',
        parent_id: 'engineering',
        level: 2,
      },
      {
        id: 'talent acquisition',
        label: 'talent acquisition',
        name: 'talent acquisition',
        parent_id: 'human resources',
        level: 2,
      },
    ]);
  });

  it('should reject an unknown stdGrade', async () => {
    await expect(
      service.searchPeople({
        companyId: 'acme',
        stdGrade: 'manager',
      } as PeopleSearchDto),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });

  it('should accept a known stdFunction', async () => {
    await service.searchPeople({
      companyId: 'acme',
      stdFunction: 'software engineering',
    });

    expect(peopleEsService.searchPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'acme',
        stdFunction: 'software engineering',
      }),
    );
  });

  it('should return stdFunction items for the given root when validation fails', async () => {
    await expect(
      service.searchPeople({
        companyId: 'acme',
        stdFunctionRoot: 'engineering',
        stdFunction: 'not a real function',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        stdFunctionRoot: 'engineering',
        items: [
          { id: 'data science', label: 'data science' },
          { id: 'software engineering', label: 'software engineering' },
        ],
      },
    });
    expect(titleTaxonomyRemoteService.getFunctions).toHaveBeenCalledWith(
      'engineering',
    );
  });
});

describe('PeopleApiService.searchPeople searchUrl', () => {
  const peopleLinkedInSourcingService = {
    isUnipileConfigured: jest.fn().mockReturnValue(true),
    search: jest.fn().mockResolvedValue({
      dataSource: 'unipile',
      keywords: null,
      appliedFilters: { functionIds: [], seniorities: [] },
      company: { name: null, slug: null, linkedinUrl: null },
      items: [{ name: 'Ada', type: 'PEOPLE' }],
    }),
  } as unknown as PeopleLinkedInSourcingService;

  const service = new PeopleApiService(
    {
      isEnabled: jest.fn().mockReturnValue(true),
      searchPeople: jest.fn(),
    } as unknown as PeopleEsService,
    {
      classifyTitle: jest.fn(),
      classifyTitles: jest.fn(),
      classifyProfiles: jest.fn(),
      getFunctionRoots: jest.fn(),
      getFunctions: jest.fn(),
    } as unknown as TitleTaxonomyRemoteService,
    {} as ApolloIoRestService,
    {} as PdlPersonOrgMovementService,
    {} as ContactOutPeopleSearchService,
    { isConfigured: jest.fn().mockReturnValue(true) } as unknown as HarvestLinkedinService,
    peopleLinkedInSourcingService,
    createPassthroughCompanyScopeResolver(),
    createPassthroughLocationScopeResolver(),
    createNaturalLanguageParser(),
    createIndexDataSourceResolver(),
  );

  it('runs LinkedIn sourcing from a people search URL without company or title', async () => {
    const searchUrl =
      'https://www.linkedin.com/sales/search/people?savedSearchId=1936431145';

    const result = await service.searchPeople(
      {
        searchUrl,
        dataSource: 'unipile',
        accountId: 'acct-1',
        limit: 10,
      },
      'token',
    );

    expect(peopleLinkedInSourcingService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        searchUrl,
        dataSource: 'unipile',
        accountId: 'acct-1',
        apiToken: 'token',
        limit: 10,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.query?.searchUrl).toBe(searchUrl);
  });

  it('rejects searchUrl when auto falls back to the people index', async () => {
    await expect(
      service.searchPeople({
        searchUrl:
          'https://www.linkedin.com/search/results/people/?keywords=helo',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });
});

describe('PeopleApiService.getManualBooleanQueries', () => {
  const titleTaxonomyRemoteService = {
    getManualBooleanQueries: jest.fn(),
  } as unknown as TitleTaxonomyRemoteService;

  const service = new PeopleApiService(
    { isEnabled: jest.fn(), searchPeople: jest.fn() } as unknown as PeopleEsService,
    titleTaxonomyRemoteService,
    {} as ApolloIoRestService,
    {} as PdlPersonOrgMovementService,
    {} as ContactOutPeopleSearchService,
    { isConfigured: jest.fn() } as unknown as HarvestLinkedinService,
    {
      isUnipileConfigured: jest.fn(),
      search: jest.fn(),
    } as unknown as PeopleLinkedInSourcingService,
    createPassthroughCompanyScopeResolver(),
    createPassthroughLocationScopeResolver(),
    createNaturalLanguageParser(),
    createIndexDataSourceResolver(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps curated python rows to camelCase items', async () => {
    (
      titleTaxonomyRemoteService.getManualBooleanQueries as jest.Mock
    ).mockResolvedValue({
      status: 'ok',
      found: true,
      count: 1,
      items: [
        {
          kind: 'std_function',
          label: 'sales',
          std_grade: 'mid',
          boolean_query: '("sales manager")',
          keywords: 'sales',
        },
      ],
    });

    const result = await service.getManualBooleanQueries({
      stdFunction: 'sales',
      stdGrade: 'mid',
    });

    expect(
      titleTaxonomyRemoteService.getManualBooleanQueries,
    ).toHaveBeenCalledWith({
      kind: undefined,
      label: undefined,
      stdGrade: 'mid',
      stdFunction: 'sales',
      stdFunctionRoot: undefined,
      includeEmpty: undefined,
    });
    expect(result).toEqual({
      status: 'ok',
      found: true,
      count: 1,
      items: [
        {
          kind: 'std_function',
          label: 'sales',
          stdGrade: 'mid',
          booleanQuery: '("sales manager")',
          keywords: 'sales',
        },
      ],
    });
  });

  it('throws when the python taxonomy service is down', async () => {
    (
      titleTaxonomyRemoteService.getManualBooleanQueries as jest.Mock
    ).mockResolvedValue(null);

    await expect(
      service.getManualBooleanQueries({ stdFunction: 'sales' }),
    ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
  });
});
