import defaultAiProviders from 'src/engine/metadata-modules/ai/ai-models/ai-providers.json';
import { aiProvidersConfigSchema } from 'src/engine/metadata-modules/ai/ai-models/types/ai-providers-config.schema';
import { type AiProvidersConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-providers-config.type';
import { buildCompositeModelId } from 'src/engine/metadata-modules/ai/ai-models/utils/composite-model-id.util';
import { normalizeAiProviders } from 'src/engine/metadata-modules/ai/ai-models/utils/normalize-ai-providers.util';

const PROVIDERS = normalizeAiProviders(defaultAiProviders as AiProvidersConfig);

const EXPECTED_PROVIDER_NAMES = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'mistral',
];

describe('ai-providers.json integrity', () => {
  it('should pass Zod schema validation', () => {
    expect(() =>
      aiProvidersConfigSchema.parse(defaultAiProviders),
    ).not.toThrow();
  });

  it('should have at least one model per expected provider', () => {
    EXPECTED_PROVIDER_NAMES.forEach((providerName) => {
      const config = PROVIDERS[providerName];

      expect(config).toBeDefined();
      expect((config?.models?.length ?? 0) > 0).toBe(true);
    });
  });

  it('should have all required fields for each model', () => {
    Object.values(PROVIDERS).forEach((config) => {
      (config.models ?? []).forEach((model) => {
        expect(model.name).toBeDefined();
        expect(model.label).toBeDefined();
        expect(model.inputCostPerMillionTokens).toBeDefined();
        expect(model.outputCostPerMillionTokens).toBeDefined();
        expect(model.contextWindowTokens).toBeGreaterThan(0);
        expect(model.maxOutputTokens).toBeGreaterThan(0);
      });
    });
  });

  it('should have unique composite model IDs across all providers', () => {
    const allCompositeIds: string[] = [];

    Object.entries(PROVIDERS).forEach(([key, config]) => {
      (config.models ?? []).forEach((model) => {
        allCompositeIds.push(buildCompositeModelId(key, model.name));
      });
    });

    expect(new Set(allCompositeIds).size).toBe(allCompositeIds.length);
  });

  it('should have at least one non-deprecated model per expected provider', () => {
    EXPECTED_PROVIDER_NAMES.forEach((providerName) => {
      const config = PROVIDERS[providerName];
      const hasActiveModel = (config?.models ?? []).some(
        (model) => !model.isDeprecated,
      );

      expect(hasActiveModel).toBe(true);
    });
  });

  it('should set source to catalog for all models after normalization', () => {
    Object.values(PROVIDERS).forEach((config) => {
      (config.models ?? []).forEach((model) => {
        expect(model.source).toBe('catalog');
      });
    });
  });

  it('should use the current OpenRouter API host', () => {
    expect(PROVIDERS.openrouter?.baseUrl).toBe(
      'https://openrouter.ai/api/v1',
    );
  });

  it('should not expose OpenRouter Hy3 (use Nous Research free instead)', () => {
    const openRouterModels = PROVIDERS.openrouter?.models ?? [];

    expect(
      openRouterModels.some((model) => model.name.startsWith('tencent/hy3')),
    ).toBe(false);
  });

  it('should use the current Nous inference API host with free Hy3', () => {
    expect(PROVIDERS.nous?.baseUrl).toBe(
      'https://inference-api.nousresearch.com/v1',
    );
    expect(PROVIDERS.nous?.label).toBe('Nous Research');

    const nousModels = PROVIDERS.nous?.models ?? [];
    const hy3Free = nousModels.find(
      (model) => model.name === 'tencent/hy3:free',
    );

    expect(hy3Free).toBeDefined();
    expect(hy3Free?.label).toBe('Nous Research HY3');
  });

  it('should enable structured outputs for OpenRouter and Nous', () => {
    expect(PROVIDERS.openrouter?.supportsStructuredOutputs).toBe(true);
    expect(PROVIDERS.nous?.supportsStructuredOutputs).toBe(true);
  });

  it('should include OpenRouter Ox Alpha', () => {
    const oxAlpha = PROVIDERS.openrouter?.models?.find(
      (model) => model.name === 'stealth/ox-alpha',
    );

    expect(oxAlpha).toBeDefined();
    expect(oxAlpha?.label).toBe('Ox Alpha');
    expect(oxAlpha?.supportsReasoning).toBe(true);
  });
});
