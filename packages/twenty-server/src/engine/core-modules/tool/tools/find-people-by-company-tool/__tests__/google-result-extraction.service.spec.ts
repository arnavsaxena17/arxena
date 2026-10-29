import { GoogleResultExtractionService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/google-result-extraction.service';

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
const results = [
  {
    title: 'About us',
    url: 'https://99pancakes.in/pages/about-us',
    snippet:
      "Vikesh Shah, founder of 99 Pancakes, started his first pancake outlet in Mumbai's Kala Ghoda area in 2017.",
  },
  {
    title: 'Vikesh Shah - 99 Pancakes | LinkedIn',
    url: 'https://in.linkedin.com/in/vikesh-shah-253a67204',
    snippet: 'As a CEO, I believe',
  },
  {
    title: 'Binita Shah - Co Founder of 99 Pancakes | LinkedIn',
    url: 'https://in.linkedin.com/in/binita-shah-4a4aa61b9',
    snippet: 'Binita Shah is an accomplished woman entrepreneur.',
  },
];
const record = (overrides: Record<string, unknown>) => ({
  name: 'Vikesh Shah',
  jobTitle: 'founder',
  companyName: '99 Pancakes',
  location: '',
  isCurrentRole: true,
  resultIndex: 2,
  evidence: 'Vikesh Shah, founder of 99 Pancakes',
  ...overrides,
});
const runWith = (
  records: Array<Record<string, unknown>>,
  resultsToRead: typeof results,
) => {
  runGenerateObject.mockResolvedValue({ object: { people: records } });

  return new GoogleResultExtractionService(
    registry as never,
    {} as never,
  ).extract({
    workspaceId: 'workspace-id',
    company: '99 Pancakes',
    roles: ['founder'],
    results: resultsToRead,
  });
};
const run = (records: Array<Record<string, unknown>>) =>
  runWith(records, results);

describe('GoogleResultExtractionService', () => {
  it('should return the fields the model isolated, with the profile URL from its result', async () => {
    await expect(run([record({})])).resolves.toEqual([
      {
        name: 'Vikesh Shah',
        jobTitle: 'founder',
        companyName: '99 Pancakes',
        location: '',
        isCurrentRole: true,
        evidence: 'Vikesh Shah, founder of 99 Pancakes',
        linkedinUrl: 'https://in.linkedin.com/in/vikesh-shah-253a67204',
        linkedinUrlDerivedFromPost: false,
        sourceUrl: 'https://in.linkedin.com/in/vikesh-shah-253a67204',
      },
    ]);
  });

  it('should find the profile by name when the model points at a page without one', async () => {
    const [extracted] = await run([record({ resultIndex: 1 })]);

    expect(extracted.linkedinUrl).toBe(
      'https://in.linkedin.com/in/vikesh-shah-253a67204',
    );
    expect(extracted.sourceUrl).toBe('https://99pancakes.in/pages/about-us');
  });

  it('should leave the URL empty for a person who only appears on a web page', async () => {
    const [extracted] = await run([
      record({
        name: 'Rajeev Varman',
        evidence: 'Rajeev Varman',
        resultIndex: 1,
      }),
    ]).catch(() => [undefined]);

    // Not in the results text, so dropped rather than invented
    expect(extracted).toBeUndefined();
  });

  it('should never take a URL the model wrote itself', async () => {
    const [extracted] = await run([
      record({
        resultIndex: 1,
        linkedinUrl: 'https://www.linkedin.com/in/made-up',
      }),
    ]);

    expect(extracted.linkedinUrl).toBe(
      'https://in.linkedin.com/in/vikesh-shah-253a67204',
    );
  });

  it('should recover the profile of a person who only appears as a post author', async () => {
    const [extracted] = await runWith(
      [
        record({
          name: 'Smita Jatia',
          evidence: 'Smita Jatia, managing director, Hardcastle',
          resultIndex: 1,
        }),
      ],
      [
        {
          title: 'Smita Jatia - ai #technology #mcdonalds',
          url: 'https://www.linkedin.com/posts/smita-jatia_ai-technology-ugcPost-1-g-KM',
          snippet: 'Vice Chairperson at Westlife Foodworld',
        },
      ],
    );

    expect(extracted.linkedinUrl).toBe(
      'https://www.linkedin.com/in/smita-jatia',
    );
    expect(extracted.linkedinUrlDerivedFromPost).toBe(true);
  });

  it('should not take the author of a post that only mentions the person', async () => {
    const [extracted] = await runWith(
      [
        record({
          name: 'Smita Jatia',
          evidence: 'More power to you Smita Jatia',
          resultIndex: 1,
        }),
      ],
      [
        {
          title: 'More power to you Smita Jatia | Shraddha Yawalkar',
          url: 'https://www.linkedin.com/posts/shraddha-yawalkar-12ab_more-power-to-you-smita-jatia-123',
          snippet: 'Smita Jatia, MD, Hardcastle Restaurants',
        },
      ],
    );

    expect(extracted.linkedinUrl).toBe('');
    expect(extracted.linkedinUrlDerivedFromPost).toBe(false);
  });

  it('should drop a name the results do not contain', async () => {
    await expect(run([record({ name: 'Jane Invented' })])).resolves.toEqual([]);
  });

  it('should drop a single-word name', async () => {
    await expect(run([record({ name: 'Vikesh' })])).resolves.toEqual([]);
  });

  it('should keep a person once when the model lists them twice', async () => {
    await expect(
      run([record({}), record({ resultIndex: 1 })]),
    ).resolves.toHaveLength(1);
  });

  it('should keep a former holder of the role, flagged as not current', async () => {
    const [extracted] = await run([record({ isCurrentRole: false })]);

    expect(extracted.isCurrentRole).toBe(false);
  });

  it('should not call the model when there are no results', async () => {
    runGenerateObject.mockClear();

    await expect(
      new GoogleResultExtractionService(registry as never, {} as never).extract(
        {
          workspaceId: 'workspace-id',
          company: '99 Pancakes',
          roles: ['founder'],
          results: [],
        },
      ),
    ).resolves.toEqual([]);
    expect(runGenerateObject).not.toHaveBeenCalled();
  });

  it('should fail when no model registry is available', async () => {
    await expect(
      new GoogleResultExtractionService().extract({
        workspaceId: 'workspace-id',
        company: '99 Pancakes',
        roles: ['founder'],
        results,
      }),
    ).rejects.toThrow('No AI model registry');
  });
});
