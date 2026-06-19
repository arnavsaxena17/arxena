import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  resolvePricingCurrencyFromCountryCode,
  type SupportedPricingCurrency,
} from 'twenty-shared';

import { ClientGeoResolutionService } from 'src/engine/core-modules/geo/client-geo-resolution.service';

@Injectable()
export class PricingCurrencyService {
  constructor(
    private readonly clientGeoResolutionService: ClientGeoResolutionService,
  ) {}

  async getRequestPricingCurrency(
    req: Request,
  ): Promise<SupportedPricingCurrency> {
    const clientIp = this.clientGeoResolutionService.resolveTrustedClientIp(req);
    const countryHeader =
      await this.clientGeoResolutionService.resolvePricingCountry(req);

    const currency = countryHeader
      ? resolvePricingCurrencyFromCountryCode(countryHeader.countryCode)
      : 'USD';

    console.info('[Pricing geo]', {
      clientIp: clientIp ?? '(none)',
      countryCode: countryHeader?.countryCode ?? '(none)',
      countrySource: countryHeader?.source ?? '(none)',
      currency,
    });

    return currency;
  }
}
