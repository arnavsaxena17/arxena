import { Injectable } from '@nestjs/common';

import { lookupCountryByIp } from 'twenty-shared';

@Injectable()
export class IpInfoGeoService {
  lookupCountryByIp(clientIp: string): Promise<string | null> {
    return lookupCountryByIp(clientIp);
  }
}
