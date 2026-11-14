import { EnrichContactService } from '../enrich-contact.service';

describe('EnrichContactService', () => {
  const candidateRepository = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const personRepository = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) =>
      objectName === 'person' ? personRepository : candidateRepository,
    ),
  };
  const contactEnrichmentWaterfallService = {
    fetchContacts: jest.fn(),
  };
  const featureFlagService = {
    isFeatureEnabled: jest.fn().mockResolvedValue(false),
  };

  const service = new EnrichContactService(
    contactEnrichmentWaterfallService as never,
    globalWorkspaceOrmManager as never,
    featureFlagService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      peopleId: 'person-1',
    });
  });

  it('should return the stored email without calling providers when the person has one', async () => {
    personRepository.findOne.mockResolvedValue({
      id: 'person-1',
      emails: {
        primaryEmail: 'jane@example.com',
        additionalEmails: ['jane.doe@example.org'],
      },
      linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe' },
    });

    const result = await service.execute({
      workspaceId: 'ws-1',
      input: { candidateId: 'cand-1', wantEmail: true, wantPhone: false },
    });

    expect(result).toMatchObject({
      success: true,
      email: 'jane@example.com',
      emails: ['jane@example.com', 'jane.doe@example.org'],
      source: 'person',
      enrichStatus: 'FOUND',
    });
    expect(
      contactEnrichmentWaterfallService.fetchContacts,
    ).not.toHaveBeenCalled();
    expect(candidateRepository.update).toHaveBeenCalledWith('cand-1', {
      enrichStatus: 'FOUND',
    });
  });

  it('should call providers and save the email when the person has none', async () => {
    personRepository.findOne.mockResolvedValue({
      id: 'person-1',
      emails: { primaryEmail: '', additionalEmails: [] },
      linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe' },
    });
    contactEnrichmentWaterfallService.fetchContacts.mockResolvedValue({
      emails: ['found@acme.com'],
      phones: [],
      source: 'provider',
    });

    const result = await service.execute({
      workspaceId: 'ws-1',
      input: { candidateId: 'cand-1', wantEmail: true, wantPhone: false },
    });

    expect(
      contactEnrichmentWaterfallService.fetchContacts,
    ).toHaveBeenCalledWith('https://www.linkedin.com/in/jane-doe', {
      wantEmail: true,
      wantPhone: false,
    });
    expect(result).toMatchObject({
      email: 'found@acme.com',
      source: 'provider',
    });
    expect(personRepository.update).toHaveBeenCalledWith('person-1', {
      emails: { primaryEmail: 'found@acme.com', additionalEmails: [] },
    });
  });

  it('should call providers when a phone is wanted but none is stored', async () => {
    personRepository.findOne.mockResolvedValue({
      id: 'person-1',
      emails: { primaryEmail: 'jane@example.com', additionalEmails: [] },
      phones: { primaryPhoneNumber: '' },
      linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe' },
    });
    contactEnrichmentWaterfallService.fetchContacts.mockResolvedValue({
      emails: [],
      phones: ['+15550100'],
      source: 'provider',
    });

    await service.execute({
      workspaceId: 'ws-1',
      input: { candidateId: 'cand-1' },
    });

    expect(contactEnrichmentWaterfallService.fetchContacts).toHaveBeenCalled();
  });
});
