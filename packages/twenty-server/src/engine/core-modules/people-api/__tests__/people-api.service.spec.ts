import { HttpException, HttpStatus } from '@nestjs/common';

import type { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import type { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import type { ContactOutPeopleSearchService } from 'src/engine/core-modules/org-chart/services/contactout-people-search.service';
import type { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import type { PdlPersonOrgMovementService } from 'src/engine/core-modules/org-chart/services/pdl-person-org-movement.service';
import type { PeopleEsService } from 'src/engine/core-modules/org-chart/services/people-es.service';

import { PeopleApiService } from '../people-api.service';

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
  } as unknown as TitleTaxonomyRemoteService;

  const service = new PeopleApiService(
    peopleEsService,
    titleTaxonomyRemoteService,
    {} as ApolloIoRestService,
    {} as PdlPersonOrgMovementService,
    {} as ContactOutPeopleSearchService,
    {} as HarvestLinkedinService,
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
    console.log('[PeopleApiService.searchPeopleByJobTitle] result', result);
  });

  it('requires company scope', async () => {
    await expect(
      service.searchPeopleByJobTitle({ jobTitle: 'VP Engineering' }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    console.log('[PeopleApiService.searchPeopleByJobTitle] missing company scope');
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

    const promise = service.searchPeopleByJobTitle({
      jobTitle: 'unknown',
      companyId: 'acme',
    });

    await expect(promise).rejects.toBeInstanceOf(HttpException);
    await expect(promise).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
    console.log('[PeopleApiService.searchPeopleByJobTitle] unresolved title');
  });
});
