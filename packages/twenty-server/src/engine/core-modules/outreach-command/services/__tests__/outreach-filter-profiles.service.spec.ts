import { generateObject } from 'ai';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import {
  concurrencyForFilterProfilesModel,
  formatFilterProfilesLlmError,
  OutreachFilterProfilesService,
  repairGeneratedJsonObjectText,
} from 'src/engine/core-modules/outreach-command/services/outreach-filter-profiles.service';
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

const waitUntil = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) {
      return;
    }

    await Promise.resolve();
  }

  throw new Error('Timed out waiting for parallel LLM calls to start');
};

const mockAiModelRegistry = (): AiModelRegistryService => {
  const defaultFastModel = {
    modelId: OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID,
    model: { provider: 'mock' },
  };

  return {
    getDefaultSpeedModel: jest.fn().mockReturnValue(defaultFastModel),
    getModel: jest.fn().mockReturnValue(defaultFastModel),
    resolveModelForAgentInWorkspace: jest.fn(),
  } as unknown as AiModelRegistryService;
};

describe('OutreachFilterProfilesService', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it('returns an error when no prompt is provided', async () => {
    const service = new OutreachFilterProfilesService(undefined);

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
    const service = new OutreachFilterProfilesService(undefined);

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

    const service = new OutreachFilterProfilesService(mockAiModelRegistry());

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
        maxOutputTokens: 2048,
        providerOptions: {
          openrouter: { reasoning: { effort: 'medium' } },
          nous: { reasoning: { effort: 'medium' } },
        },
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

  it('keeps only the more senior match when onlyOnePersonPerCompany is true', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        matches: true,
        reason: 'Decision maker in finance.',
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const cfo = {
      ...SALES_PROFILE,
      name: 'Priya Shah',
      title: 'CFO',
      headline: 'CFO at Acme',
      current_positions: [
        { role: 'CFO', company: 'Acme', company_id: '1441' },
      ],
    };
    const director = {
      ...SALES_PROFILE,
      name: 'Alex Kim',
      title: 'Finance Director',
      headline: 'Finance Director at Acme',
      current_positions: [
        { role: 'Finance Director', company: 'Acme', company_id: '1441' },
      ],
    };

    const service = new OutreachFilterProfilesService(mockAiModelRegistry());
    const result = await service.execute({
      input: {
        prompt: 'MD/CEO/CFO decision makers',
        onlyOnePersonPerCompany: true,
        profiles: [director, cfo],
      },
    });

    expect(result.success).toBe(true);
    expect(result.matchedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.people).toEqual([cfo]);
    expect(result.rejected).toEqual([director]);
    expect(result.assessments[0]?.matches).toBe(false);
    expect(result.assessments[0]?.reason).toContain(
      'A more senior person from the same company was kept',
    );
    expect(result.assessments[1]?.matches).toBe(true);
  });

  it('starts a batch of profile LLM calls before waiting for the first to finish', async () => {
    const started: number[] = [];
    const resolvers: Array<(value: Awaited<ReturnType<typeof generateObject>>) => void> =
      [];

    generateObjectMock.mockImplementation(() => {
      started.push(generateObjectMock.mock.calls.length);

      return new Promise((resolve) => {
        resolvers.push(resolve);
      });
    });

    const service = new OutreachFilterProfilesService(mockAiModelRegistry());
    const executePromise = service.execute({
      input: {
        prompt: 'senior engineers in fintech',
        profiles: [SALES_PROFILE, ENGINEER_PROFILE, SALES_PROFILE],
      },
    });

    await waitUntil(() => started.length === 2);

    expect(started).toEqual([1, 2]);
    expect(resolvers).toHaveLength(2);

    resolvers[0]?.({
      object: { matches: false, reason: 'sales' },
    } as Awaited<ReturnType<typeof generateObject>>);
    resolvers[1]?.({
      object: { matches: true, reason: 'engineer' },
    } as Awaited<ReturnType<typeof generateObject>>);

    await waitUntil(() => started.length === 3);

    resolvers[2]?.({
      object: { matches: false, reason: 'sales' },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await executePromise;

    expect(result.total).toBe(3);
    expect(result.matchedCount).toBe(1);
    expect(result.people).toEqual([ENGINEER_PROFILE]);
  });

  it('assesses ox-alpha profiles one at a time to avoid the shared-pool 429', async () => {
    const started: number[] = [];
    const resolvers: Array<(value: Awaited<ReturnType<typeof generateObject>>) => void> =
      [];
    const oxAlphaModel = {
      modelId: 'openrouter/stealth/ox-alpha',
      model: { provider: 'openrouter' },
    };
    const registry = {
      getDefaultSpeedModel: jest.fn().mockReturnValue(oxAlphaModel),
      getModel: jest.fn().mockReturnValue(oxAlphaModel),
      resolveModelForAgentInWorkspace: jest.fn(),
    } as unknown as AiModelRegistryService;

    generateObjectMock.mockImplementation(() => {
      started.push(generateObjectMock.mock.calls.length);

      return new Promise((resolve) => {
        resolvers.push(resolve);
      });
    });

    const service = new OutreachFilterProfilesService(registry);
    const executePromise = service.execute({
      input: {
        modelId: 'openrouter/stealth/ox-alpha',
        prompt: 'senior engineers in fintech',
        profiles: [SALES_PROFILE, ENGINEER_PROFILE],
      },
    });

    await waitUntil(() => started.length === 1);

    expect(started).toEqual([1]);
    expect(resolvers).toHaveLength(1);
    expect(generateObjectMock.mock.calls[0][0].providerOptions).toEqual({
      openrouter: { reasoning: { effort: 'low' } },
      nous: { reasoning: { effort: 'low' } },
    });

    resolvers[0]?.({
      object: { matches: false, reason: 'sales' },
    } as Awaited<ReturnType<typeof generateObject>>);

    await waitUntil(() => started.length === 2);

    resolvers[1]?.({
      object: { matches: true, reason: 'engineer' },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await executePromise;

    expect(result.total).toBe(2);
    expect(result.matchedCount).toBe(1);
    expect(result.people).toEqual([ENGINEER_PROFILE]);
  });

  it('fail-closes LLM errors so they do not enter people', async () => {
    generateObjectMock.mockRejectedValue(new Error('model timeout'));

    const service = new OutreachFilterProfilesService(mockAiModelRegistry());

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

  it('surfaces OpenRouter 429 metadata instead of only Provider returned error', () => {
    const error = Object.assign(new Error('Provider returned error'), {
      statusCode: 429,
      data: {
        error: {
          metadata: {
            raw: 'stealth/ox-alpha is temporarily rate-limited upstream. Please retry shortly.',
          },
        },
      },
    });

    expect(formatFilterProfilesLlmError(error)).toContain(
      'temporarily rate-limited upstream',
    );
    expect(concurrencyForFilterProfilesModel('openrouter/stealth/ox-alpha')).toBe(
      1,
    );
    expect(
      concurrencyForFilterProfilesModel(OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID),
    ).toBe(2);
    expect(
      repairGeneratedJsonObjectText({
        text: 'Sure.\n```json\n{"matches":true,"reason":"staff engineer"}\n```',
      }),
    ).toBe('{"matches":true,"reason":"staff engineer"}');
  });
});
