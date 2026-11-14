jest.mock('../services/people-linkedin-sourcing.service', () => ({
  PeopleLinkedInSourcingService: jest.fn().mockImplementation(() => ({
    isUnipileConfigured: jest.fn().mockReturnValue(true),
    search: jest.fn(),
  })),
}));

import { HttpException } from '@nestjs/common';

import type { Request } from 'express';

import { ThrottlerService } from 'src/engine/core-modules/throttler/throttler.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';

import { PeopleApiController } from '../people-api.controller';
import { PeopleApiService } from '../people-api.service';

describe('PeopleApiController taxonomy slice and classify-llm', () => {
  const peopleApiService = {
    getTaxonomySlice: jest.fn(),
    classifyLlm: jest.fn(),
  };

  const throttlerService = {
    tokenBucketThrottleOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  const twentyConfigService = {
    get: jest.fn().mockReturnValue(100),
  };

  const controller = new PeopleApiController(
    peopleApiService as unknown as PeopleApiService,
    throttlerService as unknown as ThrottlerService,
    twentyConfigService as unknown as TwentyConfigService,
    {} as WorkspaceCreditsService,
  );

  const request = { workspace: { id: 'workspace-1' } } as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    twentyConfigService.get.mockReturnValue(100);
    throttlerService.tokenBucketThrottleOrThrow.mockResolvedValue(undefined);
  });

  it('returns a taxonomy slice for a function_root', async () => {
    const slice = {
      status: 'ok',
      function_root: 'technology',
      functions: [],
      grades: [],
    };
    peopleApiService.getTaxonomySlice.mockResolvedValue(slice);

    const result = await controller.getTaxonomySlice(request, 'technology');

    expect(peopleApiService.getTaxonomySlice).toHaveBeenCalledWith(
      'technology',
    );
    expect(result).toEqual(slice);
  });

  it('proxies classify-llm job titles', async () => {
    const classifications = {
      status: 'ok',
      classifications: [{ std_function_root: 'technology', source: 'llm' }],
    };
    peopleApiService.classifyLlm.mockResolvedValue(classifications);

    const result = await controller.classifyLlm(request, {
      job_titles: ['CTO'],
    });

    expect(peopleApiService.classifyLlm).toHaveBeenCalledWith({
      job_titles: ['CTO'],
    });
    expect(result).toEqual(classifications);
  });

  it('rethrows HttpExceptions from classify-llm', async () => {
    peopleApiService.classifyLlm.mockRejectedValue(
      new HttpException('Provide either job_titles or profiles, not both', 400),
    );

    await expect(
      controller.classifyLlm(request, {
        job_titles: ['CTO'],
        profiles: ['Name: A'],
      }),
    ).rejects.toMatchObject({
      message: 'Provide either job_titles or profiles, not both',
    });
  });
});
