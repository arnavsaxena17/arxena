import { Request } from 'express';

import { ClientGeoResolutionService } from '../client-geo-resolution.service';
import { IpInfoGeoService } from '../ip-info-geo.service';

describe('ClientGeoResolutionService', () => {
  const ipInfoGeoService = {
    lookupCountryByIp: jest.fn(),
  } as unknown as IpInfoGeoService;

  const service = new ClientGeoResolutionService(ipInfoGeoService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolvePricingCountry prefers CDN headers over ipinfo', async () => {
    const req = {
      headers: {
        'cloudfront-viewer-country': 'IN',
      },
    } as unknown as Request;

    const result = await service.resolvePricingCountry(req);

    expect(result).toEqual({
      source: 'cloudfront-viewer-country',
      countryCode: 'IN',
    });
    expect(ipInfoGeoService.lookupCountryByIp).not.toHaveBeenCalled();
    console.log('[ClientGeoResolutionService.test] CDN header preferred');
  });

  it('resolvePricingCountry uses verified client hint when CDN and server IP lookup fail', async () => {
    const req = {
      headers: {
        'x-client-geo-ip': '203.0.113.10',
        'x-client-geo-country': 'IN',
      },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    (ipInfoGeoService.lookupCountryByIp as jest.Mock).mockImplementation(
      async (ip: string) => (ip === '203.0.113.10' ? 'IN' : null),
    );

    const result = await service.resolvePricingCountry(req);

    expect(result).toEqual({
      source: 'client_hint',
      countryCode: 'IN',
    });
    console.log('[ClientGeoResolutionService.test] verified client hint used');
  });
});
