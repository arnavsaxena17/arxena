import {
  buildGtmWorkspaceProfileDraftFromDomain,
  pickBestWikiCompanyHit,
  pickFirstApolloOrganization,
} from 'src/engine/core-modules/gtm-command/utils/gtm-workspace-profile-draft.util';

describe('gtm-workspace-profile-draft.util', () => {
  it('builds draft ICP and search blurbs from a work domain', () => {
    const draft = buildGtmWorkspaceProfileDraftFromDomain({
      domain: 'acme.io',
      workspaceDisplayName: 'Acme Workspace',
      apolloOrganization: {
        name: 'Acme Inc',
        industry: 'SaaS',
        estimated_num_employees: 120,
        city: 'Austin',
        country: 'United States',
      },
    });

    expect(draft.companyName).toBe('Acme Inc');
    expect(draft.companyDomain).toBe('acme.io');
    expect(draft.industry).toBe('SaaS');
    expect(draft.icpSpec.industries).toEqual(['SaaS']);
    expect(draft.icpSpec.employeeRange).toBe('120+');
    expect(draft.icpSpec.geos).toEqual(['United States']);
    expect(draft.icpSpec.buyerTitles).toBeUndefined();
    expect(draft.icpBlurb).toContain('Ideal customers');
    expect(draft.icpBlurb).not.toContain('Buyers:');
    expect(draft.companySearchBlurb).toContain('ICP');
    expect(draft.companySearchBlurb).not.toContain('recruiting');
    expect(draft.peopleSearchBlurb).toContain('SaaS');
    expect(draft.peopleSearchBlurb).not.toContain('titles:');
    expect(draft.enrichmentJson.source).toBe('apollo');
    expect(draft.enrichmentJson.companyDetails).toEqual(
      expect.objectContaining({
        apolloOrganization: expect.objectContaining({ name: 'Acme Inc' }),
      }),
    );
  });

  it('prefers companies ES index over LinkedIn and Apollo', () => {
    const draft = buildGtmWorkspaceProfileDraftFromDomain({
      domain: 'acme.io',
      apolloOrganization: {
        name: 'Apollo Name',
        industry: 'Apollo Industry',
      },
      wikiCompany: {
        name: 'Wiki Name',
        industry: 'Wiki Industry',
        size: '51-200',
      },
      linkedInCompanyProfile: {
        name: 'LinkedIn Name',
        description: 'Full LinkedIn company description',
        employee_count: 420,
        industry: ['Computer Software'],
        locations: [
          { city: 'SF', country: 'United States', is_headquarter: true },
        ],
      },
    });

    expect(draft.companyName).toBe('Wiki Name');
    expect(draft.industry).toBe('Wiki Industry');
    expect(draft.employeeRange).toBe('51-200');
    expect(draft.summary).toContain('Full LinkedIn company description');
    expect(draft.enrichmentJson.source).toBe('companies_index_wiki');
  });

  it('falls back to domain heuristics without enrichment sources', () => {
    const draft = buildGtmWorkspaceProfileDraftFromDomain({
      domain: 'brightpath.com',
    });

    expect(draft.companyName).toBe('Brightpath');
    expect(draft.companyDomain).toBe('brightpath.com');
    expect(draft.enrichmentJson.source).toBe('domain_heuristic');
    expect(draft.icpSpec.employeeRange).toBe('');
    expect(draft.icpBlurb).not.toContain('50-500');
    expect(draft.icpBlurb.length).toBeGreaterThan(0);
    expect(draft.companySearchBlurb.length).toBeGreaterThan(0);
    expect(draft.peopleSearchBlurb.length).toBeGreaterThan(0);
  });

  it('prefers LLM multi-source summary over raw LinkedIn/wiki fields', () => {
    const draft = buildGtmWorkspaceProfileDraftFromDomain({
      domain: 'clariant.com',
      linkedInCompanyProfile: {
        name: 'LinkedIn Name',
        industry: ['Chemicals'],
      },
      wikidataCompany: {
        id: 'Q667505',
        name: 'Clariant',
        industry: 'Specialty chemicals',
      },
      wikiCompany: {
        name: 'Index Clariant',
        industry: 'Chemicals',
      },
      webSearchCompany: {
        companyName: 'Clariant Web',
        summary: 'Website summary should lose to LLM.',
        industry: 'Chemicals',
      },
      llmCompanyProfile: {
        companyName: 'Clariant AG',
        industry: 'Specialty Chemicals',
        summary: 'Global specialty chemicals company.',
        employeeRange: '10000+',
        hq: 'Muttenz, Switzerland',
      },
    });

    expect(draft.companyName).toBe('Clariant AG');
    expect(draft.industry).toBe('Specialty Chemicals');
    expect(draft.summary).toBe('Global specialty chemicals company.');
    expect(draft.employeeRange).toBe('10000+');
    expect(draft.hq).toBe('Muttenz, Switzerland');
    expect(draft.enrichmentJson.source).toBe('llm_multi_source_summary');
    expect(draft.enrichmentJson.companyDetails).toEqual(
      expect.objectContaining({
        wikidataCompany: expect.objectContaining({ id: 'Q667505' }),
        wikiCompany: expect.objectContaining({ name: 'Index Clariant' }),
        webSearchCompany: expect.objectContaining({
          companyName: 'Clariant Web',
        }),
      }),
    );
  });

  it('uses web search website snapshot when LinkedIn/LLM are missing', () => {
    const draft = buildGtmWorkspaceProfileDraftFromDomain({
      domain: 'acme.io',
      webSearchCompany: {
        companyName: 'Acme From Web',
        websiteUrl: 'https://acme.io',
        summary: 'Acme sells B2B workflow software.',
        industry: 'Software',
        hq: 'Austin, United States',
        employeeHint: '51-200',
        productsOrServices: ['Workflow OS'],
        keyFacts: [],
        sourceUrls: ['https://acme.io'],
        notes: '',
      },
    });

    expect(draft.companyName).toBe('Acme From Web');
    expect(draft.summary).toContain('workflow software');
    expect(draft.industry).toBe('Software');
    expect(draft.hq).toContain('Austin');
    expect(draft.enrichmentJson.source).toBe('web_search');
  });

  it('picks the first Apollo organization from search payload', () => {
    expect(
      pickFirstApolloOrganization({
        organizations: [{ name: 'One' }, { name: 'Two' }],
      }),
    ).toEqual({ name: 'One' });

    expect(
      pickFirstApolloOrganization({
        accounts: [{ name: 'Account' }],
      }),
    ).toEqual({ name: 'Account' });

    expect(pickFirstApolloOrganization({})).toBeNull();
  });

  it('picks wiki company matching website domain', () => {
    expect(
      pickBestWikiCompanyHit(
        [
          { name: 'Other', website: 'other.com' },
          { name: 'Acme', website: 'acme.io' },
        ],
        'acme.io',
      ),
    ).toEqual({ name: 'Acme', website: 'acme.io' });
  });
});
