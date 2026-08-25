import { generateObject } from 'ai';

import { GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/gtm-command/constants/gtm-company-enrichment-model.const';
import { GtmFilterProfilesService } from 'src/engine/core-modules/gtm-command/services/gtm-filter-profiles.service';
import type { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

const generateObjectMock = generateObject as jest.MockedFunction<
  typeof generateObject
>;

const SALES_PROFILE = {
  name: 'Arapa Hara',
  firstName: 'Arapa',
  lastName: 'Hara',
  title: 'Head of Sales',
  headline: 'Head of Sales at Acme',
  company: 'Acme',
  location: 'San Francisco',
};

const ENGINEER_PROFILE = {
  name: 'Jordan Lee',
  firstName: 'Jordan',
  lastName: 'Lee',
  title: 'Staff Software Engineer',
  headline: 'Staff Software Engineer at FinBank',
  company: 'FinBank',
  location: 'New York',
};

const mockAiModelRegistry = (): AiModelRegistryService => {
  const defaultFastModel = {
    modelId: GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID,
    model: { provider: 'mock' },
  };

  return {
    getDefaultSpeedModel: jest.fn().mockReturnValue(defaultFastModel),
    getModel: jest.fn().mockReturnValue(defaultFastModel),
    resolveModelForAgentInWorkspace: jest.fn(),
  } as unknown as AiModelRegistryService;
};

describe('GtmFilterProfilesService', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it('returns an error when no prompt is provided', async () => {
    const service = new GtmFilterProfilesService(undefined);

    await expect(
      service.execute({
        input: { profiles: [SALES_PROFILE] },
      }),
    ).resolves.toMatchObject({
      success: false,
      total: 0,
      people: [],
      error: expect.stringContaining('prompt'),
    });
  });

  it('returns an error when no profiles are provided', async () => {
    const service = new GtmFilterProfilesService(undefined);

    await expect(
      service.execute({
        input: { prompt: 'senior engineers in fintech' },
      }),
    ).resolves.toMatchObject({
      success: false,
      total: 0,
      people: [],
      error: expect.stringContaining('profiles'),
    });
  });

  it('keeps original matching records on people and rejects the rest', async () => {
    generateObjectMock
      .mockResolvedValueOnce({
        object: {
          matches: false,
          reason: 'Head of Sales is GTM, not engineering.',
        },
      } as Awaited<ReturnType<typeof generateObject>>)
      .mockResolvedValueOnce({
        object: {
          matches: true,
          reason: 'Staff engineer at FinBank matches senior fintech criteria.',
        },
      } as Awaited<ReturnType<typeof generateObject>>);

    const service = new GtmFilterProfilesService(mockAiModelRegistry());

    const result = await service.execute({
      input: {
        prompt: 'senior engineers in fintech',
        profiles: [SALES_PROFILE, ENGINEER_PROFILE],
      },
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(generateObjectMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: { provider: 'mock' },
        system: expect.stringContaining('filter criteria'),
        prompt: expect.stringContaining('senior engineers in fintech'),
      }),
    );
    expect(generateObjectMock.mock.calls[0][0].prompt).toContain(
      'Head of Sales',
    );
    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    expect(result.matchedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.people).toEqual([ENGINEER_PROFILE]);
    expect(result.people[0]).toBe(ENGINEER_PROFILE);
    expect(result.rejected).toEqual([SALES_PROFILE]);
    expect(result.assessments[0]?.matches).toBe(false);
    expect(result.assessments[1]?.matches).toBe(true);
    expect(result.assessments[1]?.name).toBe('Jordan Lee');
  });

  it('fail-closes LLM errors so they do not enter people', async () => {
    generateObjectMock.mockRejectedValue(new Error('model timeout'));

    const service = new GtmFilterProfilesService(mockAiModelRegistry());

    const result = await service.execute({
      input: {
        prompt: 'senior engineers in fintech',
        profiles: [ENGINEER_PROFILE],
      },
    });

    expect(result.success).toBe(true);
    expect(result.people).toEqual([]);
    expect(result.rejected).toEqual([ENGINEER_PROFILE]);
    expect(result.assessments[0]?.matches).toBe(false);
    expect(result.assessments[0]?.error).toContain('model timeout');
  });
});
