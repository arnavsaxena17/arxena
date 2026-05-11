import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
    resolvePricingCurrencyFromCountryCode,
    type SupportedPricingCurrency,
} from 'twenty-shared';

import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';

const IPINFO_API_BASE = 'https://ipinfo.io';
const DEFAULT_IPINFO_TOKEN = '49074596a34362';

type CountryHeaderMatch = {
  source: string;
  countryCode: string;
};

type IpInfoLookupResponse = {
  country?: string;
};

@Injectable()
export class PricingCurrencyService {
  async getRequestPricingCurrency(
    req: Request,
  ): Promise<SupportedPricingCurrency> {
    const clientIp = OrgChartClientIpService.extractClientIpFromRequest(req);

    let countryHeader = this.getCountryCodeFromRequest(req);
    if (!countryHeader && clientIp) {
      const countryCodeFromIp =
        await this.resolveCountryCodeFromClientIp(clientIp);
      if (countryCodeFromIp) {
        countryHeader = {
          source: 'ipinfo',
          countryCode: countryCodeFromIp,
        };
      }
    }

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

  private getCountryCodeFromRequest(req: Request): CountryHeaderMatch | null {
    const headersToTry = [
      'cloudfront-viewer-country',
      'cf-ipcountry',
      'x-vercel-ip-country',
      'x-country-code',
    ];

    for (const headerName of headersToTry) {
      const value = req.headers[headerName];
      const normalized =
        typeof value === 'string'
          ? value.trim()
          : Array.isArray(value) && value.length > 0 && typeof value[0] === 'string'
            ? value[0].trim()
            : '';
      if (normalized) {
        return {
          source: headerName,
          countryCode: normalized,
        };
      }
    }

    return null;
  }

  private async resolveCountryCodeFromClientIp(
    clientIp: string,
  ): Promise<string | null> {
    const normalizedIp = clientIp.trim();
    if (!normalizedIp || this.isPrivateOrLocalIp(normalizedIp)) {
      return null;
    }

    const token = process.env.IPINFO_TOKEN?.trim() || DEFAULT_IPINFO_TOKEN;
    const url = `${IPINFO_API_BASE}/${encodeURIComponent(normalizedIp)}?token=${encodeURIComponent(token)}`;

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        console.warn('[Pricing geo] ipinfo lookup failed', {
          clientIp: normalizedIp,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as IpInfoLookupResponse;
      const countryCode = data.country?.trim().toUpperCase();
      return countryCode || null;
    } catch (error) {
      console.warn('[Pricing geo] ipinfo lookup error', {
        clientIp: normalizedIp,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private isPrivateOrLocalIp(ip: string): boolean {
    if (
      ip === '::1' ||
      ip.startsWith('fe80:') ||
      ip.startsWith('fc') ||
      ip.startsWith('fd')
    ) {
      return true;
    }
    if (ip.includes(':')) {
      return false;
    }
    if (ip.startsWith('127.') || ip.startsWith('10.')) {
      return true;
    }
    if (ip.startsWith('192.168.')) {
      return true;
    }
    const secondOctet = Number(ip.split('.')[1]);
    if (ip.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
    return false;
  }
}
