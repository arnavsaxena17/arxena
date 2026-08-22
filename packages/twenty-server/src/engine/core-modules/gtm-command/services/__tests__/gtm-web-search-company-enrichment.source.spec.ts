import { generateObject, generateText } from 'ai';

import { GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/gtm-command/constants/gtm-company-enrichment-model.const';
import { GtmWebSearchCompanyEnrichmentSource } from 'src/engine/core-modules/gtm-command/services/gtm-web-search-company-enrichment.source';
import type { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import type { NativeToolBinderService } from 'src/engine/metadata-modules/ai/ai-models/services/native-tool-binder.service';
import { AI_SDK_OPENAI } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-sdk-package.const';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  generateObject: jest.fn(),
  Output: {
    object: jest.fn((input: unknown) => input),
  },
  stepCountIs: jest.fn(() => () => false),
}));

const generateTextMock = generateText as jest.MockedFunction<
  typeof generateText
>;
const generateObjectMock = generateObject as jest.MockedFunction<
  typeof generateObject
>;

const snapshotOutput = {
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
};

describe('GtmWebSearchCompanyEnrichmentSource', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    generateObjectMock.mockReset();
  });

  it('returns null when AI services are unavailable', async () => {
    const source = new GtmWebSearchCompanyEnrichmentSource();

    await expect(source.enrich({ domain: 'acme.io' })).resolves.toBeNull();
  });

  it('uses hy3:free with generateObject when native web_search is unavailable', async () => {
    generateObjectMock.mockResolvedValue({
      object: snapshotOutput,
    } as Awaited<ReturnType<typeof generateObject>>);

    const hy3Model = {
      modelId: GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID,
      sdkPackage: '@ai-sdk/openai-compatible',
      model: { provider: 'hy3-mock' },
    };

    const aiModelRegistryService = {
      getModel: jest.fn().mockReturnValue(hy3Model),
      getDefaultSpeedModel: jest.fn(),
      resolveModelForAgentInWorkspace: jest.fn(),
    } as unknown as AiModelRegistryService;

    const nativeToolBinderService = {
      bind: jest.fn().mockReturnValue({}),
    } as unknown as NativeToolBinderService;

    const source = new GtmWebSearchCompanyEnrichmentSource(
      aiModelRegistryService,
      nativeToolBinderService,
    );

    const partial = await source.enrich({ domain: 'acme.io' });

    expect(aiModelRegistryService.getModel).toHaveBeenCalledWith(
      GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID,
    );
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(partial?.webSearchCompany?.companyName).toBe('Acme Inc');
  });

  it('calls generateText with web_search tools when the model supports them', async () => {
    generateTextMock.mockResolvedValue({
      output: snapshotOutput,
    } as Awaited<ReturnType<typeof generateText>>);

    const openaiModel = {
      modelId: 'openai/gpt-5-mini',
      sdkPackage: AI_SDK_OPENAI,
      model: { provider: 'openai-mock' },
      rawProvider: {},
    };

    const aiModelRegistryService = {
      getModel: jest.fn().mockReturnValue(undefined),
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
    expect(partial).toEqual({
      sourceId: 'web_search',
      webSearchCompany: expect.objectContaining({
        companyName: 'Acme Inc',
        websiteUrl: 'https://acme.io',
      }),
    });
  });
});
