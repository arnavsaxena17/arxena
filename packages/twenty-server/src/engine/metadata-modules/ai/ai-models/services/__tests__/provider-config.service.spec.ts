import { Test } from '@nestjs/testing';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { DefaultAiCatalogService } from 'src/engine/metadata-modules/ai/ai-models/services/default-ai-catalog.service';
import { ProviderConfigService } from 'src/engine/metadata-modules/ai/ai-models/services/provider-config.service';
import { type AiProvidersConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-providers-config.type';

describe('ProviderConfigService', () => {
  const catalog: AiProvidersConfig = {
    nous: {
      npm: '@ai-sdk/openai-compatible',
      name: 'nous',
      label: 'Nous Research',
      baseUrl: 'https://inference-api.nousresearch.com/v1',
      apiKey: '{{NOUS_API_KEY}}',
      models: [
        {
          name: 'tencent/hy3:free',
          label: 'Nous Research HY3',
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
    nousApiKey = 'sk-nous-test',
  }: {
    aiProviders?: AiProvidersConfig;
    nousApiKey?: string;
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

              if (key === 'NOUS_API_KEY') {
                return nousApiKey;
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

    expect(service.getResolvedProviders().nous?.apiKey).toBe('sk-nous-test');
  });

  it('should resolve catalog-declared templates in AI_PROVIDERS overrides', async () => {
    const service = await createService({
      aiProviders: {
        nous: {
          npm: '@ai-sdk/openai-compatible',
          name: 'nous',
          label: 'Nous Research',
          baseUrl: 'https://inference-api.nousresearch.com/v1',
          apiKey: '{{NOUS_API_KEY}}',
          models: catalog.nous?.models,
        },
      },
    });

    expect(service.getResolvedProviders().nous?.apiKey).toBe('sk-nous-test');
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
        nous: {
          npm: '@ai-sdk/openai-compatible',
          name: 'nous',
          label: 'Nous Override',
          baseUrl: 'https://custom-nous.example/v1',
          models: [
            {
              name: 'tencent/hy3:free',
              label: 'HY3 Override',
              inputCostPerMillionTokens: 0,
              outputCostPerMillionTokens: 0,
              contextWindowTokens: 1,
              maxOutputTokens: 1,
            },
          ],
        },
      },
    });

    const resolved = service.getResolvedProviders().nous;

    expect(resolved?.label).toBe('Nous Override');
    expect(resolved?.baseUrl).toBe('https://custom-nous.example/v1');
    expect(resolved?.apiKey).toBe('sk-nous-test');
    expect(resolved?.models?.[0]?.label).toBe('HY3 Override');
  });
});
