import { generateObject } from 'ai';

import { GtmCompanyProfileSummarizerService } from 'src/engine/core-modules/gtm-command/services/gtm-company-profile-summarizer.service';
import type { GtmCollectedCompanyEnrichment } from 'src/engine/core-modules/gtm-command/utils/gtm-company-enrichment-source.types';
import type { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

const generateObjectMock = generateObject as jest.MockedFunction<
  typeof generateObject
>;

describe('GtmCompanyProfileSummarizerService', () => {
  const enrichment: GtmCollectedCompanyEnrichment = {
    apolloOrganization: null,
    wikiCompany: { name: 'Index Co', website: 'acme.io' },
    wikidataCompany: { id: 'Q1', name: 'Wikidata Co' },
    linkedInSearchHit: {
      id: '1',
      name: 'LinkedIn Co',
      profile_url: 'https://www.linkedin.com/company/acme',
    },
    linkedInCompanyProfile: null,
    webSearchCompany: {
      companyName: 'Acme Web',
      websiteUrl: 'https://acme.io',
      summary: 'Acme sells workflow software from its website.',
      productsOrServices: ['Workflow OS'],
      industry: 'Software',
      hq: 'Austin, US',
      employeeHint: '51-200',
      keyFacts: ['Founded 2018'],
      sourceUrls: ['https://acme.io'],
      notes: '',
    },
    sourceIds: [
      'linkedin_unipile_pool',
      'wikidata',
      'companies_index_wiki',
      'web_search',
    ],
  };

  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it('returns null when AI model registry is unavailable', async () => {
    const summarizer = new GtmCompanyProfileSummarizerService(undefined);

    await expect(
      summarizer.summarizeFromEnrichmentSources({
        domain: 'acme.io',
        enrichment,
      }),
    ).resolves.toBeNull();
  });

  it('uses generateObject with the resolved model and returns the object', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        companyName: 'Acme Inc',
        industry: 'Software',
        summary: 'Acme builds workflow software.',
        employeeRange: '51-200',
        hq: 'Austin, United States',
        notes: '',
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const defaultFastModel = {
      modelId: 'nous/tencent/hy3:free',
      model: { provider: 'mock' },
    };

    const aiModelRegistryService = {
      getDefaultSpeedModel: jest.fn().mockReturnValue(defaultFastModel),
      getModel: jest.fn().mockReturnValue(defaultFastModel),
      resolveModelForAgentInWorkspace: jest.fn(),
    } as unknown as AiModelRegistryService;

    const summarizer = new GtmCompanyProfileSummarizerService(
      aiModelRegistryService,
    );

    const result = await summarizer.summarizeFromEnrichmentSources({
      domain: 'acme.io',
      workspaceDisplayName: 'Acme Workspace',
      enrichment,
    });

    expect(aiModelRegistryService.getModel).toHaveBeenCalledWith(
      'nous/tencent/hy3:free',
    );
    expect(result).toEqual({
      companyName: 'Acme Inc',
      industry: 'Software',
      summary: 'Acme builds workflow software.',
      employeeRange: '51-200',
      hq: 'Austin, United States',
      notes: '',
    });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(generateObjectMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: { provider: 'mock' },
        system: expect.stringContaining('LinkedIn / Unipile'),
        prompt: expect.stringContaining('## Wikidata'),
      }),
    );
    expect(generateObjectMock.mock.calls[0][0].prompt).toContain(
      '## Companies ES index (free_company_dataset)',
    );
    expect(generateObjectMock.mock.calls[0][0].prompt).toContain(
      '## Web search / website content',
    );
  });

  it('honors an explicit modelId override via the registry', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        companyName: 'Acme Inc',
        industry: 'Software',
        summary: 'Summary',
        employeeRange: '',
        hq: '',
        notes: '',
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const aiModelRegistryService = {
      getDefaultSpeedModel: jest.fn().mockReturnValue({
        modelId: 'nous/tencent/hy3:free',
        model: { provider: 'default-mock' },
      }),
      getModel: jest.fn().mockReturnValue({
        modelId: 'anthropic/claude-sonnet-4',
        model: { provider: 'anthropic-mock' },
      }),
      resolveModelForAgentInWorkspace: jest.fn(),
    } as unknown as AiModelRegistryService;

    const summarizer = new GtmCompanyProfileSummarizerService(
      aiModelRegistryService,
    );

    await summarizer.summarizeFromEnrichmentSources({
      domain: 'acme.io',
      enrichment,
      modelId: 'anthropic/claude-sonnet-4',
    });

    expect(aiModelRegistryService.getModel).toHaveBeenCalledWith(
      'anthropic/claude-sonnet-4',
    );
    expect(generateObjectMock.mock.calls[0][0].model).toEqual({
      provider: 'anthropic-mock',
    });
  });
});
