import { generateText } from 'ai';

import { GtmWebSearchCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-web-search-company-enrichment.source';
import type { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import type { NativeToolBinderService } from 'src/engine/metadata-modules/ai/ai-models/services/native-tool-binder.service';
import { AI_SDK_OPENAI } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-sdk-package.const';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn((input: unknown) => input),
  },
  stepCountIs: jest.fn(() => () => false),
}));

const generateTextMock = generateText as jest.MockedFunction<
  typeof generateText
>;

describe('GtmWebSearchCompanyEnrichmentSource', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it('returns null when AI services are unavailable', async () => {
    const source = new GtmWebSearchCompanyEnrichmentSource();

    await expect(source.enrich({ domain: 'acme.io' })).resolves.toBeNull();
  });

  it('returns null when no model supports native web_search', async () => {
    const aiModelRegistryService = {
      getDefaultPerformanceModel: jest.fn(() => {
        throw new Error('no smart');
      }),
      getDefaultSpeedModel: jest.fn(() => {
        throw new Error('no fast');
      }),
      getAvailableModels: jest.fn().mockReturnValue([
        {
          modelId: 'nous/hy3',
          sdkPackage: '@ai-sdk/openai-compatible',
          model: { provider: 'mock' },
        },
      ]),
    } as unknown as AiModelRegistryService;

    const nativeToolBinderService = {
      bind: jest.fn(),
    } as unknown as NativeToolBinderService;

    const source = new GtmWebSearchCompanyEnrichmentSource(
      aiModelRegistryService,
      nativeToolBinderService,
    );

    await expect(source.enrich({ domain: 'acme.io' })).resolves.toBeNull();
    expect(nativeToolBinderService.bind).not.toHaveBeenCalled();
  });

  it('calls generateText with web_search tools and returns snapshot', async () => {
    generateTextMock.mockResolvedValue({
      output: {
        companyName: 'Acme Inc',
        websiteUrl: 'https://acme.io',
        summary: 'Acme builds workflow software.',
        productsOrServices: ['Workflow OS'],
        industry: 'Software',
        hq: 'Austin, US',
        employeeHint: '51-200',
        keyFacts: ['Founded 2018'],
        sourceUrls: ['https://acme.io/about'],
        notes: '',
      },
    } as Awaited<ReturnType<typeof generateText>>);

    const openaiModel = {
      modelId: 'openai/gpt-5-mini',
      sdkPackage: AI_SDK_OPENAI,
      model: { provider: 'openai-mock' },
      rawProvider: {},
    };

    const aiModelRegistryService = {
      getDefaultPerformanceModel: jest.fn().mockReturnValue(openaiModel),
      getDefaultSpeedModel: jest.fn().mockReturnValue(openaiModel),
      getAvailableModels: jest.fn().mockReturnValue([openaiModel]),
      resolveModelForAgentInWorkspace: jest.fn(),
    } as unknown as AiModelRegistryService;

    const nativeToolBinderService = {
      bind: jest.fn().mockReturnValue({
        web_search: { description: 'native web search' },
      }),
    } as unknown as NativeToolBinderService;

    const source = new GtmWebSearchCompanyEnrichmentSource(
      aiModelRegistryService,
      nativeToolBinderService,
    );

    const partial = await source.enrich({
      domain: 'acme.io',
      workspaceDisplayName: 'Acme Workspace',
      hints: { companyName: 'Acme' },
    });

    expect(nativeToolBinderService.bind).toHaveBeenCalledWith(openaiModel, {
      webSearch: true,
    });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: openaiModel.model,
        tools: expect.objectContaining({ web_search: expect.anything() }),
        system: expect.stringContaining('web_search'),
        prompt: expect.stringContaining('acme.io'),
      }),
    );
    expect(partial).toEqual({
      sourceId: 'web_search',
      webSearchCompany: expect.objectContaining({
        companyName: 'Acme Inc',
        websiteUrl: 'https://acme.io',
        summary: 'Acme builds workflow software.',
        productsOrServices: ['Workflow OS'],
        sourceUrls: ['https://acme.io/about'],
      }),
    });
  });
});
