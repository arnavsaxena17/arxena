jest.mock('src/engine/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));

import { TheOrgController } from 'src/engine/core-modules/theorg/controllers/theorg.controller';
import { TheOrgJobService } from 'src/engine/core-modules/theorg/services/theorg-job.service';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';

describe('TheOrgController', () => {
  let controller: TheOrgController;

  const theOrgService = {
    fetchCompanyDetails: jest.fn(),
    fetchPersonProfileBySlugs: jest.fn(),
  } as unknown as jest.Mocked<TheOrgService>;

  const theOrgJobService = {
    queueCompanyProfileEnrichment: jest.fn(),
    getJobProgress: jest.fn(),
  } as unknown as jest.Mocked<TheOrgJobService>;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new TheOrgController(theOrgService, theOrgJobService);
  });

  it('queues async enrichment for deferred company profile requests', async () => {
    theOrgService.fetchCompanyDetails = jest.fn().mockResolvedValue({
      slug: 'marico',
      peopleProfilesDeferred: true,
      people: [],
      companyName: 'Marico',
      includePeopleProfiles: true,
    });
    theOrgJobService.queueCompanyProfileEnrichment = jest
      .fn()
      .mockResolvedValue('job-123');

    const result = await controller.getCompany(
      { workspaceId: 'workspace-1' } as any,
      'marico',
      'true',
    );

    expect(theOrgService.fetchCompanyDetails).toHaveBeenCalledWith('marico', {
      includePeopleProfiles: true,
    });
    expect(theOrgJobService.queueCompanyProfileEnrichment).toHaveBeenCalledWith(
      'marico',
      'workspace-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        asyncProfileEnrichmentJob: {
          jobId: 'job-123',
          status: 'queued',
          statusEndpoint: '/theorg/jobs/job-123',
        },
      }),
    );
  });

  it('returns the sync response when profiles are not deferred', async () => {
    theOrgService.fetchCompanyDetails = jest.fn().mockResolvedValue({
      slug: 'hawkins-cookers',
      peopleProfilesDeferred: false,
      people: [{ id: 1, name: 'A' }],
      companyName: 'Hawkins',
      includePeopleProfiles: false,
    });

    const result = await controller.getCompany({} as any, 'hawkins-cookers');

    expect(theOrgJobService.queueCompanyProfileEnrichment).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        slug: 'hawkins-cookers',
        peopleProfilesDeferred: false,
      }),
    );
  });

  it('returns job progress when requested', async () => {
    theOrgJobService.getJobProgress = jest.fn().mockResolvedValue({
      jobId: 'job-123',
      slug: 'marico',
      status: 'completed',
      total: 1,
      completed: 1,
      failed: 0,
    });

    await expect(controller.getJob('job-123')).resolves.toEqual(
      expect.objectContaining({
        jobId: 'job-123',
        status: 'completed',
      }),
    );
  });
});
