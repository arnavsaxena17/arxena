import { UploadProfilesService } from '../upload-profiles.service';

describe('UploadProfilesService', () => {
  const projectRepository = {
    findOne: jest.fn(),
  };
  const companyRepository = {
    findOne: jest.fn(),
  };
  const processCandidatesService = {
    queueRawDataForProcessing: jest.fn(),
  };
  const gtmWorkspaceAuthTokenService = {
    resolveOrMint: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    getRepository: jest.fn(),
    executeInWorkspaceContext: jest.fn(),
  };
  const fetchLinkedinProfileService = {
    execute: jest.fn(),
  };
  const upsertCompaniesService = {
    execute: jest.fn(),
  };

  const service = new UploadProfilesService(
    processCandidatesService as never,
    gtmWorkspaceAuthTokenService as never,
    globalWorkspaceOrmManager as never,
    fetchLinkedinProfileService as never,
    upsertCompaniesService as never,
  );

  const classifiedSearchHit = {
    name: 'Ziad Daoud',
    firstName: 'Ziad',
    lastName: 'Daoud',
    title: 'Chief Executive Officer',
    company: 'INJAZ',
    companyName: 'INJAZ',
    stdFunction: 'ceo',
    stdFunctionRoot: 'ceo',
    stdGrade: 'leadership',
    linkedinUrl: 'https://www.linkedin.com/in/ziad-daoud-33aa8a98',
    linkedinProfileId: 'ziad-daoud-33aa8a98',
    current_positions: [
      {
        role: 'Chief Executive Officer',
        company: 'INJAZ',
        company_id: '12345',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    projectRepository.findOne.mockResolvedValue({
      id: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      name: 'GTM Harvest',
      recruiterId: null,
    });
    companyRepository.findOne.mockResolvedValue(null);
    gtmWorkspaceAuthTokenService.resolveOrMint.mockResolvedValue('token');
    processCandidatesService.queueRawDataForProcessing.mockResolvedValue(
      undefined,
    );
    upsertCompaniesService.execute.mockResolvedValue({
      companyIds: ['3616d8a1-0219-408a-a6e9-75105117be4e'],
    });
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
    globalWorkspaceOrmManager.getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) =>
        objectName === 'company' ? companyRepository : projectRepository,
    );
  });

  it('queues every person when limit is unset (no default/hard cap)', async () => {
    const people = Array.from({ length: 64 }, (_, index) => ({
      ...classifiedSearchHit,
      name: `Person ${index}`,
      linkedinUrl: `https://www.linkedin.com/in/person-${index}`,
      linkedinProfileId: `person-${index}`,
    }));

    await expect(
      service.execute({
        workspaceId: '54a99d20-8be6-4869-8eeb-aa1aeadfb694',
        input: {
          projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
          people,
        },
      }),
    ).resolves.toEqual({
      success: true,
      queued: 64,
      projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      error: '',
    });

    expect(
      processCandidatesService.queueRawDataForProcessing,
    ).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ linkedinProfileId: 'person-0' }),
        expect.objectContaining({ linkedinProfileId: 'person-63' }),
      ]),
      'linkedin_search',
      '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      'GTM Harvest',
      '',
      expect.any(String),
      'gtm-workflow-upload-profiles',
      'token',
      expect.any(String),
    );
    expect(
      processCandidatesService.queueRawDataForProcessing.mock.calls[0][0],
    ).toHaveLength(64);
  });

  it('honors an explicit limit when provided', async () => {
    const people = Array.from({ length: 10 }, (_, index) => ({
      ...classifiedSearchHit,
      name: `Person ${index}`,
      linkedinUrl: `https://www.linkedin.com/in/person-${index}`,
      linkedinProfileId: `person-${index}`,
    }));

    await expect(
      service.execute({
        workspaceId: '54a99d20-8be6-4869-8eeb-aa1aeadfb694',
        input: {
          projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
          people,
          limit: 3,
        },
      }),
    ).resolves.toMatchObject({ success: true, queued: 3 });

    expect(
      processCandidatesService.queueRawDataForProcessing.mock.calls[0][0],
    ).toHaveLength(3);
  });

  it('queues classified search hits when the workflow did not pass a company', async () => {
    await expect(
      service.execute({
        workspaceId: '54a99d20-8be6-4869-8eeb-aa1aeadfb694',
        input: {
          projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
          people: [classifiedSearchHit],
        },
      }),
    ).resolves.toEqual({
      success: true,
      queued: 1,
      projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      error: '',
    });

    expect(
      processCandidatesService.queueRawDataForProcessing,
    ).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          linkedinProfileId: 'ziad-daoud-33aa8a98',
          jobCompanyId: '12345',
        }),
      ]),
      'linkedin_search',
      '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      'GTM Harvest',
      '',
      expect.any(String),
      'gtm-workflow-upload-profiles',
      'token',
      expect.any(String),
    );
  });

  it('fails instead of reporting success when every person is skipped', async () => {
    companyRepository.findOne.mockResolvedValue({
      id: '3616d8a1-0219-408a-a6e9-75105117be4e',
      name: 'Hinduja Hospital',
      linkedinId: '946958',
    });

    await expect(
      service.execute({
        workspaceId: '54a99d20-8be6-4869-8eeb-aa1aeadfb694',
        input: {
          projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
          companyId: '3616d8a1-0219-408a-a6e9-75105117be4e',
          people: [classifiedSearchHit],
        },
      }),
    ).resolves.toEqual({
      success: false,
      queued: 0,
      projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      error:
        'All 1 people were skipped because none matched the workflow company',
    });

    expect(
      processCandidatesService.queueRawDataForProcessing,
    ).not.toHaveBeenCalled();
  });

  it('still queues people when company tagging throws', async () => {
    upsertCompaniesService.execute.mockRejectedValue(
      new Error('unique linkedinId conflict'),
    );

    await expect(
      service.execute({
        workspaceId: '54a99d20-8be6-4869-8eeb-aa1aeadfb694',
        input: {
          projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
          people: [classifiedSearchHit],
        },
      }),
    ).resolves.toEqual({
      success: true,
      queued: 1,
      projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      error: '',
    });

    expect(upsertCompaniesService.execute).toHaveBeenCalled();
    expect(
      processCandidatesService.queueRawDataForProcessing,
    ).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          linkedinProfileId: 'ziad-daoud-33aa8a98',
          jobCompanyId: '12345',
        }),
      ]),
      'linkedin_search',
      '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      'GTM Harvest',
      '',
      expect.any(String),
      'gtm-workflow-upload-profiles',
      'token',
      expect.any(String),
    );
  });

  it('still queues people when company tagging returns success=false', async () => {
    upsertCompaniesService.execute.mockResolvedValue({
      success: false,
      created: 0,
      updated: 0,
      skipped: 0,
      projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
      companyIds: [],
      error: 'Project not found',
    });

    await expect(
      service.execute({
        workspaceId: '54a99d20-8be6-4869-8eeb-aa1aeadfb694',
        input: {
          projectId: '369c4ae7-4da5-5a2b-807f-4177b6e62c10',
          people: [classifiedSearchHit],
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      queued: 1,
    });

    expect(
      processCandidatesService.queueRawDataForProcessing,
    ).toHaveBeenCalled();
  });
});
