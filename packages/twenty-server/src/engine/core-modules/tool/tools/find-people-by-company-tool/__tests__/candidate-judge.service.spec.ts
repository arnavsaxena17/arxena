import { CandidateJudgeService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/candidate-judge.service';

jest.mock(
  'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service',
  () => ({
    AiSdkExecutionService: class {},
    runGenerateObject: jest.fn(),
  }),
);

const { runGenerateObject } = jest.requireMock(
  'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service',
) as { runGenerateObject: jest.Mock };

const registry = {
  getDefaultSpeedModel: () => ({ modelId: 'fast-model' }),
  resolveModelForAgentInWorkspace: jest
    .fn()
    .mockResolvedValue({ modelId: 'fast-model', model: {} }),
};
const candidates = [
  {
    id: 'a',
    name: 'Amit Jatia',
    title: 'Chairperson',
    companyName: 'Westlife Foodworld Limited',
    evidence: "Experience: McDonald's India",
  },
  {
    id: 'b',
    name: 'Binita Shah',
    title: '',
    companyName: 'BNP Paribas CIB',
    evidence: '',
  },
];
const verdict = (overrides: Record<string, unknown>) => ({
  index: 0,
  company: 'related',
  companyLinkBasis: 'known_fact',
  companyNote: 'Westlife operates the Hardcastle outlets.',
  role: 'related',
  roleNote: 'Chairperson.',
  ...overrides,
});
const run = (verdicts: Array<Record<string, unknown>>) => {
  runGenerateObject.mockResolvedValue({ object: { verdicts } });

  return new CandidateJudgeService(registry as never, {} as never).judge({
    workspaceId: 'workspace-id',
    company: 'Hardcastle Restaurants Pvt. Ltd.',
    alternateNames: ['Westlife Foodworld'],
    roles: ['MD', 'CEO'],
    candidates,
  });
};

describe('CandidateJudgeService', () => {
  beforeEach(() => runGenerateObject.mockReset());

  it("should return the model's verdict for each candidate, keyed by id", async () => {
    const verdicts = await run([
      verdict({}),
      verdict({
        index: 1,
        company: 'different',
        companyNote: 'A namesake at a bank.',
        role: 'none',
        roleNote: 'No role stated.',
      }),
    ]);

    expect(verdicts.get('a')).toEqual({
      company: 'related',
      companyNote: 'Westlife operates the Hardcastle outlets.',
      role: 'related',
      roleNote: 'Chairperson.',
    });
    expect(verdicts.get('b')?.company).toBe('different');
  });

  it('should give the model the company, its other names, the roles and every candidate', async () => {
    await run([verdict({})]);

    const { options } = runGenerateObject.mock.calls[0][1];

    expect(options.prompt).toContain(
      'Target company: Hardcastle Restaurants Pvt. Ltd.',
    );
    expect(options.prompt).toContain('Also known as: Westlife Foodworld');
    expect(options.prompt).toContain('Wanted roles: MD, CEO');
    expect(options.prompt).toContain(
      '0. Amit Jatia | title: Chairperson | company on profile: Westlife Foodworld Limited',
    );
    expect(options.prompt).toContain('1. Binita Shah | title: (none)');
  });

  it('should tell the model to understand brand, operator and parent links and to say unknown when unsure', async () => {
    await run([verdict({})]);

    const { options } = runGenerateObject.mock.calls[0][1];

    expect(options.system).toContain('master franchisee');
    expect(options.system).toContain(
      'If you are not sure two companies are linked, answer unknown',
    );
  });

  it('should turn a "related" with nothing behind it into unknown', async () => {
    const verdicts = await run([
      verdict({
        companyLinkBasis: 'none',
        companyNote: 'Shares the word Arab; the connection is unconfirmed.',
      }),
    ]);

    expect(verdicts.get('a')?.company).toBe('unknown');
  });

  it('should keep a "related" the evidence or a known fact supports', async () => {
    const fromEvidence = await run([verdict({ companyLinkBasis: 'evidence' })]);
    const fromFact = await run([verdict({ companyLinkBasis: 'known_fact' })]);

    expect(fromEvidence.get('a')?.company).toBe('related');
    expect(fromFact.get('a')?.company).toBe('related');
  });

  it('should leave "same" and "different" alone whatever the basis says', async () => {
    const verdicts = await run([
      verdict({ company: 'same', companyLinkBasis: 'none' }),
      verdict({ index: 1, company: 'different', companyLinkBasis: 'none' }),
    ]);

    expect(verdicts.get('a')?.company).toBe('same');
    expect(verdicts.get('b')?.company).toBe('different');
  });

  it('should tell the model that a title holding the wanted role with others is exact', async () => {
    await run([verdict({})]);

    const { options } = runGenerateObject.mock.calls[0][1];

    expect(options.system).toContain('Founder & CEO is a CEO');
    expect(options.system).toContain('companyLinkBasis');
  });

  it('should ignore a verdict for a candidate that does not exist', async () => {
    const verdicts = await run([verdict({ index: 9 })]);

    expect(verdicts.size).toBe(0);
  });

  it('should leave a candidate the model skipped without a verdict', async () => {
    const verdicts = await run([verdict({})]);

    expect(verdicts.has('b')).toBe(false);
  });

  it('should not call the model with no candidates', async () => {
    const verdicts = await new CandidateJudgeService(registry as never).judge({
      workspaceId: 'workspace-id',
      company: 'Acme',
      alternateNames: [],
      roles: ['CEO'],
      candidates: [],
    });

    expect(verdicts.size).toBe(0);
    expect(runGenerateObject).not.toHaveBeenCalled();
  });

  it('should fail when no model registry is available', async () => {
    await expect(
      new CandidateJudgeService().judge({
        workspaceId: 'workspace-id',
        company: 'Acme',
        alternateNames: [],
        roles: ['CEO'],
        candidates,
      }),
    ).rejects.toThrow('No AI model registry');
  });
});
