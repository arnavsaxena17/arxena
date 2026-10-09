import { SaveOutreachTargetsToCrmService } from 'src/engine/core-modules/outreach-command/services/save-outreach-targets-to-crm.service';

const WORKSPACE_ID = 'workspace-1';
const PROJECT_ID = 'project-1';

const buildService = ({
  companies = [],
  people = [],
  existingPeople = [],
}: {
  companies?: Array<Record<string, unknown>>;
  people?: Array<Record<string, unknown>>;
  existingPeople?: Array<Record<string, unknown>>;
}) => {
  const savedPeople: Array<Record<string, unknown>> = [];
  const personRepository = {
    find: jest.fn().mockResolvedValue(existingPeople),
    save: jest.fn(async (record: Record<string, unknown>) => {
      savedPeople.push(record);
    }),
  };
  const repositoryNames: string[] = [];
  const ormManager = {
    executeInWorkspaceContext: jest.fn(async (callback: () => unknown) =>
      callback(),
    ),
    getRepository: jest.fn(async (_workspaceId: string, name: string) => {
      repositoryNames.push(name);

      return personRepository;
    }),
  };
  const upsertCompaniesService = {
    execute: jest.fn(
      async ({ input }: { input: { companies: Array<{ name: string }> } }) => ({
        success: true,
        created: 1,
        updated: 0,
        skipped: 0,
        projectId: PROJECT_ID,
        companyIds: [`crm-${input.companies[0].name}`],
      }),
    ),
  };
  const service = new SaveOutreachTargetsToCrmService(
    ormManager as never,
    { get: jest.fn().mockResolvedValue({ companies }) } as never,
    { get: jest.fn().mockResolvedValue({ people }) } as never,
    upsertCompaniesService as never,
  );

  return {
    service,
    savedPeople,
    personRepository,
    upsertCompaniesService,
    repositoryNames,
  };
};

const person = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Ada Lovelace',
  title: 'CEO',
  companyId: 'c1',
  companyName: 'Acme',
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  email: '',
  ...overrides,
});

const company = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Acme',
  domain: 'acme.com',
  industry: 'Software',
  ...overrides,
});

describe('SaveOutreachTargetsToCrmService', () => {
  it('should save people linked to their company and never touch candidates', async () => {
    const { service, savedPeople, repositoryNames, upsertCompaniesService } =
      buildService({ companies: [company()], people: [person()] });

    const result = await service.execute({
      workspaceId: WORKSPACE_ID,
      input: { projectId: PROJECT_ID, target: 'people' },
    });

    expect(result.success).toBe(true);
    expect(result.people).toEqual({ created: 1, matched: 0, skipped: 0 });
    expect(result.companies.created).toBe(1);
    expect(savedPeople).toHaveLength(1);
    expect(savedPeople[0]).toMatchObject({
      name: { firstName: 'Ada', lastName: 'Lovelace' },
      companyId: 'crm-Acme',
    });
    expect(upsertCompaniesService.execute).toHaveBeenCalledTimes(1);
    expect(repositoryNames).toEqual(['person']);
  });

  it('should link people already in the CRM instead of duplicating them', async () => {
    const { service, savedPeople } = buildService({
      companies: [company()],
      people: [person()],
      existingPeople: [
        {
          id: 'crm-person',
          linkedinLink: { primaryLinkUrl: 'https://linkedin.com/in/ada/' },
        },
      ],
    });

    const result = await service.execute({
      workspaceId: WORKSPACE_ID,
      input: { projectId: PROJECT_ID, target: 'people' },
    });

    expect(result.people).toEqual({ created: 0, matched: 1, skipped: 0 });
    expect(result.crmPersonIdByEphemeralId).toEqual({ p1: 'crm-person' });
    expect(savedPeople).toHaveLength(0);
  });

  it('should skip people without a LinkedIn URL', async () => {
    const { service, savedPeople } = buildService({
      companies: [company()],
      people: [person({ linkedinUrl: '' })],
    });

    const result = await service.execute({
      workspaceId: WORKSPACE_ID,
      input: { projectId: PROJECT_ID, target: 'people' },
    });

    expect(result.people.skipped).toBe(1);
    expect(savedPeople).toHaveLength(0);
  });

  it('should only save the selected ids', async () => {
    const { service, savedPeople } = buildService({
      companies: [company()],
      people: [
        person(),
        person({
          id: 'p2',
          name: 'Grace Hopper',
          linkedinUrl: 'linkedin.com/in/grace',
        }),
      ],
    });

    await service.execute({
      workspaceId: WORKSPACE_ID,
      input: { projectId: PROJECT_ID, target: 'people', personIds: ['p2'] },
    });

    expect(savedPeople).toHaveLength(1);
    expect(savedPeople[0]).toMatchObject({
      name: { firstName: 'Grace', lastName: 'Hopper' },
    });
  });

  it('should save companies only without creating people', async () => {
    const { service, savedPeople, personRepository } = buildService({
      companies: [company()],
      people: [person()],
    });

    const result = await service.execute({
      workspaceId: WORKSPACE_ID,
      input: { projectId: PROJECT_ID, target: 'companies' },
    });

    expect(result.companies).toEqual({ created: 1, matched: 0, skipped: 0 });
    expect(result.crmCompanyIdByEphemeralId).toEqual({ c1: 'crm-Acme' });
    expect(savedPeople).toHaveLength(0);
    expect(personRepository.find).not.toHaveBeenCalled();
  });

  it('should fail when the tabs hold no matching rows', async () => {
    const { service } = buildService({});

    const result = await service.execute({
      workspaceId: WORKSPACE_ID,
      input: { projectId: PROJECT_ID, target: 'both' },
    });

    expect(result.success).toBe(false);
  });
});
