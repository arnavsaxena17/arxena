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

import { PeopleApiService } from '../people-api.service';
import type { PeopleLinkedInSourcingService } from '../services/people-linkedin-sourcing.service';

describe('PeopleApiService.searchPeopleByJobTitle', () => {
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
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies job title and searches people with resolved std filters', async () => {
    const result = await service.searchPeopleByJobTitle({
      jobTitle: 'VP Engineering',
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
    });
    expect(result.items).toHaveLength(1);
  });

  it('requires company scope', async () => {
    await expect(
      service.searchPeopleByJobTitle({ jobTitle: 'VP Engineering' }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('returns 422 when taxonomy cannot resolve function or grade', async () => {
    (titleTaxonomyRemoteService.classifyTitle as jest.Mock).mockResolvedValueOnce({
      title: 'unknown',
      normalized_title: 'unknown',
      function_root: null,
      function: null,
      grade: null,
      confidence: 0,
    });

    await expect(
      service.searchPeopleByJobTitle({
        jobTitle: 'unknown',
        companyId: 'acme',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });
});

describe('PeopleApiService.searchPeopleByTaxonomy', () => {
  const peopleEsService = {
    isEnabled: jest.fn().mockReturnValue(true),
  } as unknown as PeopleEsService;

  const titleTaxonomyRemoteService = {
    classifyTitles: jest.fn().mockResolvedValue([
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
  } as unknown as TitleTaxonomyRemoteService;

  const peopleLinkedInSourcingService = {
    isUnipileConfigured: jest.fn().mockReturnValue(true),
    search: jest.fn().mockResolvedValue({
      candidateSource: 'unipile',
      keywords: 'engineer OR engineering',
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
      },
      'token',
    );

    expect(peopleLinkedInSourcingService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateSource: 'unipile',
        stdFunctionRoot: 'engineering',
        stdGrade: 'leadership',
        apiToken: 'token',
      }),
    );
    expect(titleTaxonomyRemoteService.classifyTitles).toHaveBeenCalledWith([
      'VP Engineering',
      'Account Executive',
    ]);
    expect(result.dataSource).toBe('unipile');
    expect(result.totalBeforeFilter).toBe(2);
    expect(result.total).toBe(1);
    expect(result.items[0].resolved.stdFunctionRoot).toBe('engineering');
  });

  it('throws when taxonomy batch classify is unavailable', async () => {
    (titleTaxonomyRemoteService.classifyTitles as jest.Mock).mockResolvedValueOnce(
      null,
    );

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
});
