import { OutreachCompanyEnrichmentCollectorService } from 'src/engine/core-modules/outreach-command/services/outreach-company-enrichment-collector.service';
import type { OutreachCompanyEnrichmentSource } from 'src/engine/core-modules/outreach-command/utils/outreach-company-enrichment-source.types';

describe('OutreachCompanyEnrichmentCollectorService', () => {
  it('merges ordered source partials and passes prior hints', async () => {
    const enrichCalls: Array<{
      sourceId: string;
      hints?: { companyName?: string | null; linkedInUrl?: string | null };
    }> = [];

    const apolloSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'apollo',
      enrich: async () => {
        enrichCalls.push({ sourceId: 'apollo' });

        return {
          sourceId: 'apollo',
          apolloOrganization: {
            name: 'Acme Apollo',
            linkedin_url: 'https://www.linkedin.com/company/acme',
          },
        };
      },
    };

    const linkedInSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'linkedin_unipile_pool',
      enrich: async (input) => {
        enrichCalls.push({
          sourceId: 'linkedin_unipile_pool',
          hints: input.hints,
        });

        return {
          sourceId: 'linkedin_unipile_pool',
          linkedInSearchHit: {
            id: '123',
            name: 'Acme LinkedIn',
            profile_url: 'https://www.linkedin.com/company/acme',
            industry: 'Software',
            headcount: '51-200',
            location: 'US',
            summary: null,
          },
          linkedInAccountId: 'pool-account-1',
        };
      },
    };

    const collector = new OutreachCompanyEnrichmentCollectorService([
      apolloSource,
      linkedInSource,
    ]);

    const collected = await collector.collect({ domain: 'acme.io' });

    expect(collected.sourceIds).toEqual(['apollo', 'linkedin_unipile_pool']);
    expect(collected.apolloOrganization).toEqual(
      expect.objectContaining({ name: 'Acme Apollo' }),
    );
    expect(collected.linkedInSearchHit?.name).toBe('Acme LinkedIn');
    expect(collected.linkedInAccountId).toBe('pool-account-1');
    expect(enrichCalls[1]?.hints).toEqual({
      companyName: 'Acme Apollo',
      linkedInUrl: 'https://www.linkedin.com/company/acme',
    });
  });

  it('passes companies ES hits as hints into LinkedIn autocomplete', async () => {
    const enrichCalls: Array<{
      sourceId: string;
      hints?: { companyName?: string | null; linkedInUrl?: string | null };
    }> = [];

    const wikiSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'companies_index_wiki',
      enrich: async () => ({
        sourceId: 'companies_index_wiki',
        wikiCompany: {
          name: 'Arxena, Inc.',
          website: 'arxena.com',
          linkedin_url: 'linkedin.com/company/arxena',
        },
      }),
    };

    const linkedInSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'linkedin_unipile_pool',
      enrich: async (input) => {
        enrichCalls.push({
          sourceId: 'linkedin_unipile_pool',
          hints: input.hints,
        });

        return {
          sourceId: 'linkedin_unipile_pool',
          linkedInAccountId: 'pool-account-1',
        };
      },
    };

    const collector = new OutreachCompanyEnrichmentCollectorService([
      wikiSource,
      linkedInSource,
    ]);

    await collector.collect({ domain: 'arxena.com' });

    expect(enrichCalls[0]?.hints).toEqual({
      companyName: 'Arxena, Inc.',
      linkedInUrl: 'linkedin.com/company/arxena',
    });
  });

  it('continues when one source throws', async () => {
    const failingSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'apollo',
      enrich: async () => {
        throw new Error('apollo down');
      },
    };

    const wikiSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'companies_index_wiki',
      enrich: async () => ({
        sourceId: 'companies_index_wiki',
        wikiCompany: { name: 'Wiki Co', website: 'acme.io' },
      }),
    };

    const collector = new OutreachCompanyEnrichmentCollectorService([
      failingSource,
      wikiSource,
    ]);

    const collected = await collector.collect({ domain: 'acme.io' });

    expect(collected.sourceIds).toEqual(['companies_index_wiki']);
    expect(collected.wikiCompany?.name).toBe('Wiki Co');
  });

  it('keeps LinkedIn, Wikidata, and companies ES payloads as separate fields', async () => {
    const linkedInSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'linkedin_unipile_pool',
      enrich: async () => ({
        sourceId: 'linkedin_unipile_pool',
        linkedInSearchHit: {
          id: '1',
          name: 'Acme LinkedIn',
          profile_url: 'https://www.linkedin.com/company/acme',
        },
      }),
    };

    const wikidataSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'wikidata',
      enrich: async () => ({
        sourceId: 'wikidata',
        wikidataCompany: {
          name: 'Wikidata Co',
          website: 'https://acme.io',
          id: 'Q123',
        },
      }),
    };

    const indexWikiSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'companies_index_wiki',
      enrich: async () => ({
        sourceId: 'companies_index_wiki',
        wikiCompany: { name: 'Index Co', website: 'acme.io', id: 'acme' },
      }),
    };

    const collector = new OutreachCompanyEnrichmentCollectorService([
      linkedInSource,
      wikidataSource,
      indexWikiSource,
    ]);

    const collected = await collector.collect({ domain: 'acme.io' });

    expect(collected.sourceIds).toEqual([
      'linkedin_unipile_pool',
      'wikidata',
      'companies_index_wiki',
    ]);
    expect(collected.linkedInSearchHit?.name).toBe('Acme LinkedIn');
    expect(collected.wikidataCompany?.name).toBe('Wikidata Co');
    expect(collected.wikiCompany?.name).toBe('Index Co');
  });

  it('skips Wikidata when the companies index already returned a hit', async () => {
    const wikidataEnrich = jest.fn(async () => ({
      sourceId: 'wikidata' as const,
      wikidataCompany: { name: 'Wikidata Co', id: 'Q1' },
    }));

    const collector = new OutreachCompanyEnrichmentCollectorService([
      {
        sourceId: 'companies_index_wiki',
        enrich: async () => ({
          sourceId: 'companies_index_wiki',
          wikiCompany: { name: 'Index Co', website: 'acme.io' },
        }),
      },
      {
        sourceId: 'wikidata',
        enrich: wikidataEnrich,
      },
    ]);

    const collected = await collector.collect({ domain: 'acme.io' });

    expect(wikidataEnrich).not.toHaveBeenCalled();
    expect(collected.sourceIds).toEqual(['companies_index_wiki']);
    expect(collected.wikiCompany?.name).toBe('Index Co');
    expect(collected.wikidataCompany).toBeNull();
  });

  it('merges web_search website snapshot from a later source', async () => {
    const linkedInSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'linkedin_unipile_pool',
      enrich: async () => ({
        sourceId: 'linkedin_unipile_pool',
        linkedInSearchHit: {
          id: '1',
          name: 'Acme LinkedIn',
          profile_url: 'https://www.linkedin.com/company/acme',
        },
      }),
    };

    const webSearchSource: OutreachCompanyEnrichmentSource = {
      sourceId: 'web_search',
      enrich: async (input) => ({
        sourceId: 'web_search',
        webSearchCompany: {
          companyName: input.hints?.companyName ?? 'Acme Web',
          websiteUrl: `https://${input.domain}`,
          summary: 'Website summary',
          productsOrServices: [],
          industry: 'Software',
          hq: '',
          employeeHint: '',
          keyFacts: [],
          sourceUrls: [`https://${input.domain}`],
          notes: '',
        },
      }),
    };

    const collector = new OutreachCompanyEnrichmentCollectorService([
      linkedInSource,
      webSearchSource,
    ]);

    const collected = await collector.collect({ domain: 'acme.io' });

    expect(collected.sourceIds).toEqual([
      'linkedin_unipile_pool',
      'web_search',
    ]);
    expect(collected.webSearchCompany?.summary).toBe('Website summary');
    expect(collected.webSearchCompany?.companyName).toBe('Acme LinkedIn');
  });
});
