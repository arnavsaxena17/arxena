import { Test } from '@nestjs/testing';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { DefaultAiCatalogService } from 'src/engine/metadata-modules/ai/ai-models/services/default-ai-catalog.service';
import { ProviderConfigService } from 'src/engine/metadata-modules/ai/ai-models/services/provider-config.service';
import { type AiProvidersConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-providers-config.type';

describe('ProviderConfigService', () => {
  const catalog: AiProvidersConfig = {
    openrouter: {
      npm: '@ai-sdk/openai-compatible',
      name: 'openrouter',
      label: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '{{OPENROUTER_API_KEY}}',
      models: [
        {
          name: 'deepseek/deepseek-v4-flash-0731',
          label: 'DeepSeek V4 Flash',
          inputCostPerMillionTokens: 0,
          outputCostPerMillionTokens: 0,
          contextWindowTokens: 262144,
          maxOutputTokens: 8192,
        },
      ],
    },
  };

  const createService = async ({
    aiProviders = {},
    openrouterApiKey = 'sk-openrouter-test',
  }: {
    aiProviders?: AiProvidersConfig;
    openrouterApiKey?: string;
  } = {}) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProviderConfigService,
        {
          provide: DefaultAiCatalogService,
          useValue: {
            getDefaultAiCatalog: () => catalog,
          },
        },
        {
          provide: TwentyConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'AI_PROVIDERS') {
                return aiProviders;
              }

              if (key === 'OPENROUTER_API_KEY') {
                return openrouterApiKey;
              }

              throw new Error(`Unknown config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    return moduleRef.get(ProviderConfigService);
  };

  it('should resolve catalog apiKey templates', async () => {
    const service = await createService();

    expect(service.getResolvedProviders().openrouter?.apiKey).toBe('sk-openrouter-test');
  });

  it('should resolve catalog-declared templates in AI_PROVIDERS overrides', async () => {
    const service = await createService({
      aiProviders: {
        openrouter: {
          npm: '@ai-sdk/openai-compatible',
          name: 'openrouter',
          label: 'OpenRouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: '{{OPENROUTER_API_KEY}}',
          models: catalog.openrouter?.models,
        },
      },
    });

    expect(service.getResolvedProviders().openrouter?.apiKey).toBe('sk-openrouter-test');
  });

  it('should not resolve non-catalog templates from AI_PROVIDERS', async () => {
    const service = await createService({
      aiProviders: {
        custom: {
          npm: '@ai-sdk/openai-compatible',
          name: 'custom',
          label: 'Custom',
          baseUrl: 'https://example.com/v1',
          apiKey: '{{DATABASE_URL}}',
          models: [],
        },
      },
    });

    expect(service.getResolvedProviders().custom?.apiKey).toBe(
      '{{DATABASE_URL}}',
    );
  });

  it('should deep-merge custom provider fields onto catalog', async () => {
    const service = await createService({
      aiProviders: {
        openrouter: {
          npm: '@ai-sdk/openai-compatible',
          name: 'openrouter',
          label: 'OpenRouter Override',
          baseUrl: 'https://custom-openrouter.example/v1',
          models: [
            {
              name: 'deepseek/deepseek-v4-flash-0731',
              label: 'DeepSeek Override',
              inputCostPerMillionTokens: 0,
              outputCostPerMillionTokens: 0,
              contextWindowTokens: 1,
              maxOutputTokens: 1,
            },
          ],
        },
      },
    });

    const resolved = service.getResolvedProviders().openrouter;

    expect(resolved?.label).toBe('OpenRouter Override');
    expect(resolved?.baseUrl).toBe('https://custom-openrouter.example/v1');
    expect(resolved?.apiKey).toBe('sk-openrouter-test');
    expect(resolved?.models?.[0]?.label).toBe('DeepSeek Override');
  });
});
