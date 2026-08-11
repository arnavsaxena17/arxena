import { Injectable } from '@nestjs/common';

import { lookupCompanyByIp, lookupCountryByIp } from 'twenty-shared';

@Injectable()
export class IpInfoGeoService {
  lookupCountryByIp(clientIp: string): Promise<string | null> {
    return lookupCountryByIp(clientIp);
  }

  lookupCompanyByIp(clientIp: string): Promise<{
    org: string | null;
    hostname: string | null;
  }> {
    return lookupCompanyByIp(clientIp);
  }
}
