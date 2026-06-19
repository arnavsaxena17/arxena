import { Injectable } from '@nestjs/common';

import { lookupCountryByIp } from 'src/engine/core-modules/geo/utils/lookup-country-by-ip.util';

@Injectable()
export class IpInfoGeoService {
  lookupCountryByIp(clientIp: string): Promise<string | null> {
    return lookupCountryByIp(clientIp);
  }
}
