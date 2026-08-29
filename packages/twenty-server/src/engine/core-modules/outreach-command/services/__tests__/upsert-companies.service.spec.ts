import { CompanySearchHitTransformer } from 'src/engine/core-modules/company-api/services/company-search-hit.transformer';

import { UpsertCompaniesService } from '../upsert-companies.service';

describe('UpsertCompaniesService', () => {
  const createdRecords: Array<Record<string, unknown>> = [];
  const existingRows: Array<Record<string, unknown>> = [];

  const companyRepository = {
    metadata: {
      columns: [
        { propertyName: 'id' },
        { propertyName: 'name' },
        { propertyName: 'domainNamePrimaryLinkUrl' },
        { propertyName: 'linkedinLinkPrimaryLinkUrl' },
        { propertyName: 'linkedinId' },
        { propertyName: 'projectIds' },
        { propertyName: 'outreachFunnelStage' },
        { propertyName: 'createdBySource' },
      ],
    },
    find: jest.fn(async () => existingRows),
    create: jest.fn((record: Record<string, unknown>) => record),
    save: jest.fn(async (record: Record<string, unknown>) => {
      createdRecords.push(record);

      return record;
    }),
    update: jest.fn(async () => undefined),
  };

  const projectRepository = {
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
    })),
  };

  const globalWorkspaceOrmManager = {
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) =>
      objectName === 'project' ? projectRepository : companyRepository,
    ),
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
  };

  const service = new UpsertCompaniesService(
    globalWorkspaceOrmManager as never,
    new CompanySearchHitTransformer(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    createdRecords.length = 0;
    existingRows.length = 0;
    companyRepository.find.mockImplementation(async () => existingRows);
    projectRepository.findOne.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({ id: where.id }),
    );
    globalWorkspaceOrmManager.getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) =>
        objectName === 'project' ? projectRepository : companyRepository,
    );
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('parses a pasted search-companies JSON payload', async () => {
    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          projectId: '84a08312-0e86-59ed-8103-f575c3f17812',
          companies: JSON.stringify({
            success: true,
            companies: [
              {
                id: '1035',
                name: 'Microsoft',
                website: '',
                linkedinUrl: 'https://www.linkedin.com/company/microsoft/',
                industry: 'Software Development',
              },
            ],
          }),
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      created: 1,
      updated: 0,
      skipped: 0,
    });

    expect(companyRepository.create).not.toHaveBeenCalled();
    expect(createdRecords[0]).toMatchObject({
      name: 'Microsoft',
      linkedinLink: {
        primaryLinkUrl: 'https://www.linkedin.com/company/microsoft',
        primaryLinkLabel: 'linkedin.com',
      },
      linkedinId: '1035',
      projectIds: ['84a08312-0e86-59ed-8103-f575c3f17812'],
      outreachFunnelStage: 'ADDED',
    });
    expect(createdRecords[0].domainName).toBeUndefined();
  });

  it('maps Unipile and Harvest aliases through the search-hit transformer', async () => {
    await service.execute({
      workspaceId: 'ws-1',
      input: {
        projectId: 'project-1',
        companies: [
          {
            id: '5652',
            display_name: 'Egon Zehnder',
            profile_url: 'https://www.linkedin.com/company/egon-zehnder/',
            website: 'http://www.egonzehnder.com',
          },
          {
            companyName: 'Harvest Co',
            websiteUrl: 'harvest.co',
            linkedin_url: 'https://www.linkedin.com/company/harvest',
          },
        ],
      },
    });

    expect(createdRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Egon Zehnder',
          linkedinId: '5652',
          domainName: {
            primaryLinkUrl: 'http://www.egonzehnder.com',
            primaryLinkLabel: 'egonzehnder.com',
          },
          projectIds: ['project-1'],
        }),
        expect.objectContaining({
          name: 'Harvest Co',
          domainName: {
            primaryLinkUrl: 'https://harvest.co',
            primaryLinkLabel: 'harvest.co',
          },
        }),
      ]),
    );
  });

  it('backfills LinkedIn fields and tags an existing company to the project', async () => {
    existingRows.push({
      id: 'existing',
      name: 'Apple',
      projectIds: null,
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          projectId: 'project-1',
          companies: [
            {
              id: '162479',
              name: 'Apple',
              website: 'http://www.apple.com',
              linkedinUrl: 'https://www.linkedin.com/company/apple/',
            },
          ],
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      created: 0,
      updated: 1,
    });

    expect(companyRepository.update).toHaveBeenCalledWith(
      'existing',
      expect.objectContaining({
        domainName: {
          primaryLinkUrl: 'http://www.apple.com',
          primaryLinkLabel: 'apple.com',
        },
        linkedinLink: {
          primaryLinkUrl: 'https://www.linkedin.com/company/apple',
          primaryLinkLabel: 'linkedin.com',
        },
        linkedinId: '162479',
        projectIds: ['project-1'],
        outreachFunnelStage: 'ADDED',
      }),
    );
  });

  it('matches two Hinduja hospital names to one existing linkedinId', async () => {
    existingRows.push({
      id: 'crm-hinduja',
      name: 'Hinduja Hospital',
      linkedinId: '946958',
    });

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          projectId: 'project-1',
          companies: [
            { id: '946958', name: 'Hinduja Hospital' },
            {
              id: '946958',
              name: 'P.D. Hinduja National Hospital',
            },
          ],
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      created: 0,
      updated: 1,
      skipped: 1,
      companyIds: ['crm-hinduja', 'crm-hinduja'],
    });

    expect(createdRecords).toHaveLength(0);
  });

  it('returns Project not found when the tag target is missing', async () => {
    projectRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        input: {
          projectId: 'missing',
          companies: [{ name: 'Acme', linkedinUrl: 'https://linkedin.com/company/acme' }],
        },
      }),
    ).resolves.toMatchObject({
      success: false,
      error: 'Project not found',
    });
  });
});
