import type { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import type { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';

import { PeopleLocationScopeResolver } from '../people-location-scope.resolver';

describe('PeopleLocationScopeResolver', () => {
  const linkedinParameterResolver = {
    resolveLocationName: jest.fn(),
  };
  const linkedinUnipileEstimateAccountService = {
    resolveSharedSalesNavigatorPoolAccountId: jest.fn(),
  };

  const resolver = new PeopleLocationScopeResolver(
    linkedinParameterResolver as unknown as LinkedinParameterResolver,
    linkedinUnipileEstimateAccountService as unknown as LinkedinUnipileEstimateAccountService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should omit empty location', async () => {
    const result = await resolver.resolve({});

    expect(result).toEqual({ resolvedVia: 'omitted' });
    expect(linkedinParameterResolver.resolveLocationName).not.toHaveBeenCalled();
  });

  it('should skip LinkedIn facet lookup for index and keep the raw string', async () => {
    const result = await resolver.resolve({
      location: 'India',
      dataSource: 'index',
    });

    expect(result).toEqual({
      raw: 'India',
      linkedinLocationName: 'India',
      resolvedVia: 'unresolved',
    });
    expect(linkedinParameterResolver.resolveLocationName).not.toHaveBeenCalled();
  });

  it('should resolve a location name through LinkedIn using an explicit account', async () => {
    linkedinParameterResolver.resolveLocationName.mockResolvedValue({
      id: '102713980',
      title: 'India',
    });

    const result = await resolver.resolve({
      location: 'Bangalore',
      dataSource: 'apollo',
      accountId: 'acct-1',
    });

    expect(linkedinParameterResolver.resolveLocationName).toHaveBeenCalledWith(
      'Bangalore',
      'acct-1',
    );
    expect(result).toEqual({
      raw: 'Bangalore',
      linkedinLocationId: '102713980',
      linkedinLocationName: 'India',
      resolvedVia: 'linkedin',
    });
  });

  it('should use the Sales Nav pool account when harvest has no explicit account', async () => {
    linkedinUnipileEstimateAccountService.resolveSharedSalesNavigatorPoolAccountId.mockResolvedValue(
      'pool-acct',
    );
    linkedinParameterResolver.resolveLocationName.mockResolvedValue({
      id: '90000084',
      title: 'Bengaluru Area',
    });

    const result = await resolver.resolve({
      country: 'Bengaluru',
      dataSource: 'harvest',
    });

    expect(
      linkedinUnipileEstimateAccountService.resolveSharedSalesNavigatorPoolAccountId,
    ).toHaveBeenCalled();
    expect(linkedinParameterResolver.resolveLocationName).toHaveBeenCalledWith(
      'Bengaluru',
      'pool-acct',
    );
    expect(result.linkedinLocationId).toBe('90000084');
    expect(result.linkedinLocationName).toBe('Bengaluru Area');
    expect(result.resolvedVia).toBe('linkedin');
  });

  it('should fall back to the raw string when LinkedIn has no match', async () => {
    linkedinParameterResolver.resolveLocationName.mockResolvedValue(null);

    const result = await resolver.resolve({
      location: 'Narnia',
      dataSource: 'apollo',
      accountId: 'acct-1',
    });

    expect(result).toEqual({
      raw: 'Narnia',
      linkedinLocationName: 'Narnia',
      resolvedVia: 'unresolved',
    });
  });
});
