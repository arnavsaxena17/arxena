import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/gtm-command/services/linkedin-provider-id.store';

const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

describe('LinkedinProviderIdStoreService', () => {
  const candidateRepository = {
    metadata: {
      columns: [
        { propertyName: 'id' },
        { propertyName: 'peopleId' },
        { propertyName: 'linkedinProfileId' },
        { propertyName: 'linkedinUrlPrimaryLinkUrl' },
      ],
    },
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const personRepository = {
    metadata: {
      columns: [
        { propertyName: 'id' },
        { propertyName: 'linkedinProfileId' },
        { propertyName: 'linkedinLinkPrimaryLinkUrl' },
      ],
    },
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) =>
      objectName === 'person' ? personRepository : candidateRepository,
    ),
  };

  const service = new LinkedinProviderIdStoreService(
    globalWorkspaceOrmManager as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    candidateRepository.findOne.mockResolvedValue(null);
    personRepository.findOne.mockResolvedValue(null);
    candidateRepository.update.mockResolvedValue(undefined);
    personRepository.update.mockResolvedValue(undefined);
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
    globalWorkspaceOrmManager.getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) =>
        objectName === 'person' ? personRepository : candidateRepository,
    );
  });

  it('saves ACoAA onto candidate and person linkedinProfileId without touching URL fields', async () => {
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      peopleId: 'person-1',
      linkedinProfileId: 'jane-doe',
      linkedinUrl: { primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe' },
    });
    personRepository.findOne.mockResolvedValue({
      id: 'person-1',
      linkedinProfileId: 'jane-doe',
      linkedinLink: {
        primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe',
      },
    });

    await service.saveProviderId({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      identifier: 'jane-doe',
      providerId: VALID_PROVIDER_ID,
    });

    expect(candidateRepository.update).toHaveBeenCalledWith('cand-1', {
      linkedinProfileId: VALID_PROVIDER_ID,
    });
    expect(personRepository.update).toHaveBeenCalledWith('person-1', {
      linkedinProfileId: VALID_PROVIDER_ID,
    });
    expect(candidateRepository.update.mock.calls[0][1]).not.toHaveProperty(
      'linkedinUrl',
    );
    expect(personRepository.update.mock.calls[0][1]).not.toHaveProperty(
      'linkedinLink',
    );
  });

  it('does not persist a public slug as linkedinProfileId', async () => {
    await service.saveProviderId({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      identifier: 'jane-doe',
      providerId: 'jane-doe',
    });

    expect(candidateRepository.update).not.toHaveBeenCalled();
    expect(personRepository.update).not.toHaveBeenCalled();
  });

  it('skips Unipile when candidate already stores ACoAA', async () => {
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      linkedinProfileId: VALID_PROVIDER_ID,
    });
    const fetchProviderId = jest.fn();

    await expect(
      service.resolveForSend({
        workspaceId: 'ws-1',
        candidateId: 'cand-1',
        identifier: 'jane-doe',
        fetchProviderId,
      }),
    ).resolves.toBe(VALID_PROVIDER_ID);
    expect(fetchProviderId).not.toHaveBeenCalled();
  });

  it('fetches then persists ACoAA when CRM still has a slug', async () => {
    candidateRepository.findOne.mockResolvedValueOnce({
      id: 'cand-1',
      peopleId: 'person-1',
      linkedinProfileId: 'jane-doe',
    });
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      peopleId: 'person-1',
      linkedinProfileId: 'jane-doe',
    });
    personRepository.findOne.mockResolvedValue({
      id: 'person-1',
      linkedinProfileId: 'jane-doe',
    });
    const fetchProviderId = jest.fn().mockResolvedValue(VALID_PROVIDER_ID);

    await expect(
      service.resolveForSend({
        workspaceId: 'ws-1',
        candidateId: 'cand-1',
        identifier: 'jane-doe',
        fetchProviderId,
      }),
    ).resolves.toBe(VALID_PROVIDER_ID);
    expect(fetchProviderId).toHaveBeenCalledTimes(1);
    expect(candidateRepository.update).toHaveBeenCalledWith('cand-1', {
      linkedinProfileId: VALID_PROVIDER_ID,
    });
    expect(personRepository.update).toHaveBeenCalledWith('person-1', {
      linkedinProfileId: VALID_PROVIDER_ID,
    });
  });
});
