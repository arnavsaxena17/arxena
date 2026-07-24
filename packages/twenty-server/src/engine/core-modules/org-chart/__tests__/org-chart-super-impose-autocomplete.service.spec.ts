import { Test } from '@nestjs/testing';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { OrgChartSuperImposeAutocompleteService } from 'src/engine/core-modules/org-chart/services/org-chart-super-impose-autocomplete.service';

describe('OrgChartSuperImposeAutocompleteService', () => {
  let service: OrgChartSuperImposeAutocompleteService;
  let environmentService: { get: jest.Mock };
  let linkedInSearchService: {
    getSearchParameters: jest.Mock;
    searchCompanies: jest.Mock;
    searchCompaniesSalesNavigator: jest.Mock;
  };
  let linkedinUnipileEstimateAccountService: {
    withEstimateLinkedinSession: jest.Mock;
  };

  beforeEach(async () => {
    environmentService = {
      get: jest.fn().mockReturnValue('linkedin_parameters'),
    };
    linkedInSearchService = {
      getSearchParameters: jest.fn(),
      searchCompanies: jest.fn(),
      searchCompaniesSalesNavigator: jest.fn(),
    };
    linkedinUnipileEstimateAccountService = {
      withEstimateLinkedinSession: jest.fn(
        async (
          _apiToken: string,
          _explicitAccountId: string | undefined,
          run: (session: {
            accountId: string;
            inferredSearchType: 'classic';
            salesNavigatorAvailable: boolean;
            recruiterAvailable: boolean;
          }) => Promise<unknown>,
        ) =>
          run({
            accountId: 'pool-account-id',
            inferredSearchType: 'classic',
            salesNavigatorAvailable: false,
            recruiterAvailable: false,
          }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartSuperImposeAutocompleteService,
        { provide: EnvironmentService, useValue: environmentService },
        { provide: LinkedInSearchService, useValue: linkedInSearchService },
        {
          provide: LinkedinUnipileEstimateAccountService,
          useValue: linkedinUnipileEstimateAccountService,
        },
      ],
    }).compile();

    service = moduleRef.get(OrgChartSuperImposeAutocompleteService);
  });

  it('uses parameter search when env is linkedin_parameters', async () => {
    console.log('OrgChartSuperImposeAutocompleteService: parameter company search');
    linkedInSearchService.getSearchParameters.mockResolvedValue({
      items: [
        { id: '1441', title: 'Acme', picture_url: 'https://logo.test/acme.png' },
      ],
    });

    const items = await service.searchCompanies({
      apiToken: 'token',
      keywords: 'acme',
      searchType: 'classic',
    });

    expect(
      linkedinUnipileEstimateAccountService.withEstimateLinkedinSession,
    ).toHaveBeenCalled();
    expect(linkedInSearchService.getSearchParameters).toHaveBeenCalledWith(
      'COMPANY',
      'pool-account-id',
      { keywords: 'acme', limit: 10 },
    );
    expect(items[0]).toMatchObject({
      id: '1441',
      title: 'Acme',
      pictureUrl: 'https://logo.test/acme.png',
      slug: '1441',
      profileUrl: 'https://www.linkedin.com/company/1441/',
    });
    expect(linkedInSearchService.searchCompanies).not.toHaveBeenCalled();
  });

  it('uses estimate pool session for location autocomplete', async () => {
    console.log('OrgChartSuperImposeAutocompleteService: location search');
    linkedInSearchService.getSearchParameters.mockResolvedValue({
      items: [{ id: '102713980', title: 'San Francisco Bay Area' }],
    });

    const items = await service.searchLocations({
      apiToken: 'token',
      keywords: 'san francisco',
      limit: 5,
    });

    expect(
      linkedinUnipileEstimateAccountService.withEstimateLinkedinSession,
    ).toHaveBeenCalled();
    expect(linkedInSearchService.getSearchParameters).toHaveBeenCalledWith(
      'LOCATION',
      'pool-account-id',
      { keywords: 'san francisco', limit: 5 },
    );
    expect(items[0]).toMatchObject({
      id: '102713980',
      title: 'San Francisco Bay Area',
    });
  });

  it('uses company search for sales_navigator when env is linkedin_company_search', async () => {
    console.log('OrgChartSuperImposeAutocompleteService: sales nav company search');
    environmentService.get.mockReturnValue('linkedin_company_search');
    linkedInSearchService.searchCompaniesSalesNavigator.mockResolvedValue({
      items: [
        {
          type: 'COMPANY',
          id: '999',
          name: 'Acme Sales',
          profile_url: 'https://www.linkedin.com/company/acme-sales/',
          logo: 'https://logo.test/acme-sales.png',
          industry: 'Software',
          location: 'San Francisco',
          headcount: '1K-5K',
        },
      ],
    });

    const items = await service.searchCompanies({
      apiToken: 'token',
      keywords: 'acme',
      searchType: 'sales_navigator',
    });

    expect(
      linkedinUnipileEstimateAccountService.withEstimateLinkedinSession,
    ).toHaveBeenCalled();
    expect(linkedInSearchService.searchCompaniesSalesNavigator).toHaveBeenCalledWith(
      { keywords: 'acme' },
      'pool-account-id',
      { limit: 10 },
    );
    expect(items[0]).toMatchObject({
      id: '999',
      title: 'Acme Sales',
      slug: 'acme-sales',
      pictureUrl: 'https://logo.test/acme-sales.png',
      profileUrl: 'https://www.linkedin.com/company/acme-sales/',
      industry: 'Software',
      locationLabel: 'San Francisco',
      headcount: '1K-5K',
    });
  });

  it('falls back to parameters for recruiter even when env is linkedin_company_search', async () => {
    console.log('OrgChartSuperImposeAutocompleteService: recruiter fallback');
    environmentService.get.mockReturnValue('linkedin_company_search');
    linkedInSearchService.getSearchParameters.mockResolvedValue({
      items: [{ id: '55', title: 'Recruiter Co' }],
    });

    await service.searchCompanies({
      apiToken: 'token',
      keywords: 'co',
      searchType: 'recruiter',
    });

    expect(linkedInSearchService.getSearchParameters).toHaveBeenCalledWith(
      'COMPANY',
      'pool-account-id',
      { keywords: 'co', limit: 10 },
    );
    expect(linkedInSearchService.searchCompanies).not.toHaveBeenCalled();
    expect(linkedInSearchService.searchCompaniesSalesNavigator).not.toHaveBeenCalled();
  });

  it('falls back to parameters when company search throws', async () => {
    console.log('OrgChartSuperImposeAutocompleteService: company search fallback');
    environmentService.get.mockReturnValue('linkedin_company_search');
    linkedInSearchService.searchCompanies.mockRejectedValue(new Error('rate limited'));
    linkedInSearchService.getSearchParameters.mockResolvedValue({
      items: [{ id: '77', title: 'Fallback Co' }],
    });

    const items = await service.searchCompanies({
      apiToken: 'token',
      keywords: 'fallback',
      searchType: 'classic',
    });

    expect(linkedInSearchService.getSearchParameters).toHaveBeenCalled();
    expect(items[0]?.title).toBe('Fallback Co');
  });
});
