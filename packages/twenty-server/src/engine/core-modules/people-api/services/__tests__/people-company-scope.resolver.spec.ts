import type { SerpCompanySearchService } from 'src/engine/core-modules/linkedin-company-search/services/linkedin-company-search.service';
import type { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';
import type { OrgChartService } from 'src/engine/core-modules/org-chart/services/org-chart.service';

import { PeopleCompanyScopeResolver } from '../people-company-scope.resolver';

describe('PeopleCompanyScopeResolver', () => {
  const companiesEsService = {
    isEnabled: jest.fn().mockReturnValue(true),
    searchCompanies: jest.fn(),
  };
  const orgChartService = {
    getCompanyAutocomplete: jest.fn(),
    resolveCompanyByDomain: jest.fn(),
  };
  const serpCompanySearchService = {
    resolveCompanyWebsiteDomain: jest.fn(),
    resolveLinkedinCompanyUrlFromDomain: jest.fn(),
  };

  const resolver = new PeopleCompanyScopeResolver(
    companiesEsService as unknown as CompaniesEsService,
    orgChartService as unknown as OrgChartService,
    serpCompanySearchService as unknown as SerpCompanySearchService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    companiesEsService.isEnabled.mockReturnValue(true);
  });

  it('should skip lookup when companyId is already provided', async () => {
    const result = await resolver.resolve({
      companyName: 'Stripe',
      companyId: 'stripe',
    });

    expect(result).toMatchObject({
      companyName: 'Stripe',
      companyId: 'stripe',
      linkedinUrl: 'https://www.linkedin.com/company/stripe/',
      resolvedVia: 'provided',
    });
    expect(companiesEsService.searchCompanies).not.toHaveBeenCalled();
    expect(orgChartService.resolveCompanyByDomain).not.toHaveBeenCalled();
    expect(
      serpCompanySearchService.resolveLinkedinCompanyUrlFromDomain,
    ).not.toHaveBeenCalled();
  });

  it('uses a provided company LinkedIn URL over a workspace UUID', async () => {
    const result = await resolver.resolve({
      companyName: 'Egon Zehnder',
      companyId: 'c811bdd7-0489-46b2-b7d7-3bab7c93e610',
      website: 'www.egonzehnder.com',
      linkedinCompanyUrl: 'https://www.linkedin.com/company/egon-zehnder/',
    });

    expect(result).toMatchObject({
      companyName: 'Egon Zehnder',
      companyId: 'egon-zehnder',
      website: 'www.egonzehnder.com',
      linkedinUrl: 'https://www.linkedin.com/company/egon-zehnder/',
      resolvedVia: 'provided',
    });
    expect(orgChartService.resolveCompanyByDomain).not.toHaveBeenCalled();
  });

  it('does not treat a workspace UUID as a LinkedIn company slug', async () => {
    orgChartService.resolveCompanyByDomain.mockResolvedValue({
      found: true,
      companyId: 'egon-zehnder',
      companyName: 'Egon Zehnder',
      source: 'orgcharts',
      hasOrgChart: true,
    });

    const result = await resolver.resolve({
      companyId: 'c811bdd7-0489-46b2-b7d7-3bab7c93e610',
      website: 'www.egonzehnder.com',
    });

    expect(orgChartService.resolveCompanyByDomain).toHaveBeenCalledWith(
      'www.egonzehnder.com',
      { authToken: undefined },
    );
    expect(result).toMatchObject({
      companyId: 'egon-zehnder',
      resolvedVia: 'provided',
    });
  });

  it('should map a provided domain through ES when the domain hit is strong', async () => {
    orgChartService.resolveCompanyByDomain.mockResolvedValue({
      found: true,
      companyId: 'stripe',
      companyName: 'Stripe',
      source: 'orgcharts',
      hasOrgChart: true,
    });

    const result = await resolver.resolve({
      website: 'stripe.com',
    });

    expect(orgChartService.resolveCompanyByDomain).toHaveBeenCalledWith(
      'stripe.com',
      { authToken: undefined },
    );
    expect(
      serpCompanySearchService.resolveLinkedinCompanyUrlFromDomain,
    ).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      companyId: 'stripe',
      website: 'stripe.com',
      resolvedVia: 'provided',
    });
  });

  it('should Google-resolve LinkedIn when domain ES only has a stem fallback', async () => {
    orgChartService.resolveCompanyByDomain.mockResolvedValue({
      found: true,
      companyId: 'stayvista',
      source: 'companies',
      hasOrgChart: false,
    });
    serpCompanySearchService.resolveLinkedinCompanyUrlFromDomain.mockResolvedValue(
      {
        linkedinCompanySlug: 'stay-vista',
        linkedinCompanyUrl: 'https://www.linkedin.com/company/stay-vista/',
        companyName: 'StayVista',
      },
    );

    const result = await resolver.resolve({
      website: 'stayvista.com',
      country: 'India',
    });

    expect(
      serpCompanySearchService.resolveLinkedinCompanyUrlFromDomain,
    ).toHaveBeenCalledWith({
      domain: 'stayvista.com',
      country: 'India',
    });
    expect(result).toEqual({
      companyName: 'StayVista',
      companyId: 'stay-vista',
      website: 'stayvista.com',
      linkedinUrl: 'https://www.linkedin.com/company/stay-vista/',
      resolvedVia: 'serp_linkedin',
    });
  });

  it('should keep the stem companyId when Google LinkedIn lookup fails', async () => {
    orgChartService.resolveCompanyByDomain.mockResolvedValue({
      found: true,
      companyId: 'stayvista',
      source: 'companies',
      hasOrgChart: false,
    });
    serpCompanySearchService.resolveLinkedinCompanyUrlFromDomain.mockRejectedValue(
      new Error('No LinkedIn company URL found in SERP results'),
    );

    const result = await resolver.resolve({
      website: 'stayvista.com',
    });

    expect(result).toEqual({
      companyName: undefined,
      companyId: 'stayvista',
      website: 'stayvista.com',
      linkedinUrl: 'https://www.linkedin.com/company/stayvista/',
      resolvedVia: 'provided',
    });
  });

  it('should use a direct companies ES name match', async () => {
    companiesEsService.searchCompanies.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'stripe',
          name: 'Stripe',
          website: 'stripe.com',
          linkedin_url: 'https://www.linkedin.com/company/stripe/',
        },
      ],
    });

    const result = await resolver.resolve({ companyName: 'Stripe' });

    expect(result).toEqual({
      companyName: 'Stripe',
      companyId: 'stripe',
      website: 'stripe.com',
      linkedinUrl: 'https://www.linkedin.com/company/stripe/',
      resolvedVia: 'companies_es',
    });
    expect(orgChartService.getCompanyAutocomplete).not.toHaveBeenCalled();
  });

  it('should fall through to autocomplete when ES has no direct hit', async () => {
    companiesEsService.searchCompanies.mockResolvedValue({
      total: 1,
      items: [{ id: 'apple-bank', name: 'Apple Bank' }],
    });
    orgChartService.getCompanyAutocomplete.mockResolvedValue([
      {
        name: 'Apple',
        meta: {
          id: 'apple',
          linkedin_slug: 'apple',
          website: 'apple.com',
          linkedin_url: 'https://www.linkedin.com/company/apple/',
        },
        count: 100,
      },
    ]);

    const result = await resolver.resolve({ companyName: 'Apple' });

    expect(result.resolvedVia).toBe('autocomplete');
    expect(result.companyId).toBe('apple');
    expect(result.website).toBe('apple.com');
  });

  it('should SERP-resolve a domain then map it to a LinkedIn company id', async () => {
    companiesEsService.searchCompanies.mockResolvedValue({
      total: 0,
      items: [],
    });
    orgChartService.getCompanyAutocomplete.mockResolvedValue([]);
    serpCompanySearchService.resolveCompanyWebsiteDomain.mockResolvedValue({
      domain: 'stayvista.com',
      companyName: 'StayVista',
      websiteUrl: 'https://stayvista.com/',
    });
    orgChartService.resolveCompanyByDomain.mockResolvedValue({
      found: true,
      companyId: 'stay-vista',
      companyName: 'StayVista',
    });

    const result = await resolver.resolve({
      companyName: 'StayVista',
      country: 'India',
    });

    expect(
      serpCompanySearchService.resolveCompanyWebsiteDomain,
    ).toHaveBeenCalledWith({
      companyName: 'StayVista',
      country: 'India',
    });
    expect(orgChartService.resolveCompanyByDomain).toHaveBeenCalledWith(
      'stayvista.com',
      { authToken: undefined },
    );
    expect(result).toEqual({
      companyName: 'StayVista',
      companyId: 'stay-vista',
      website: 'stayvista.com',
      linkedinUrl: 'https://www.linkedin.com/company/stay-vista/',
      resolvedVia: 'serp_domain',
    });
  });

  it('should keep the original name when SERP resolution fails', async () => {
    companiesEsService.searchCompanies.mockResolvedValue({
      total: 0,
      items: [],
    });
    orgChartService.getCompanyAutocomplete.mockResolvedValue([]);
    serpCompanySearchService.resolveCompanyWebsiteDomain.mockRejectedValue(
      new Error('No relevant company website found'),
    );

    const result = await resolver.resolve({ companyName: 'Unknown Co' });

    expect(result).toEqual({
      companyName: 'Unknown Co',
      resolvedVia: 'unresolved',
    });
  });
});
