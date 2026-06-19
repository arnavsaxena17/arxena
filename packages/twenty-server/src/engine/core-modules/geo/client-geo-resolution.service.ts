import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  CLIENT_GEO_COUNTRY_HEADER,
  CLIENT_GEO_IP_HEADER,
  isPrivateOrLocalClientIp,
} from 'twenty-shared';

import { resolveLinkedinSyncClientIp } from 'src/engine/core-modules/arx-chat/utils/resolve-linkedin-sync-client-ip.util';
import { normalizeLinkedinConnectionCountry } from 'src/engine/core-modules/arx-chat/utils/build-unipile-linkedin-cookie-connect-body.util';
import { IpInfoGeoService } from 'src/engine/core-modules/geo/ip-info-geo.service';
import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';

type CountryHeaderMatch = {
  source: string;
  countryCode: string;
};

@Injectable()
export class ClientGeoResolutionService {
  constructor(private readonly ipInfoGeoService: IpInfoGeoService) {}

  resolveTrustedClientIp(req: Request): string | null {
    return OrgChartClientIpService.extractClientIpFromRequest(req);
  }

  resolveLinkedinSyncIp(args: {
    serverIp?: string | null;
    extensionIp?: string | null;
  }): string | undefined {
    return resolveLinkedinSyncClientIp(args);
  }

  async resolveLinkedinSessionCountry(ip?: string | null): Promise<string | undefined> {
    if (!ip) {
      return undefined;
    }

    const country = await this.ipInfoGeoService.lookupCountryByIp(ip);
    return country ?? undefined;
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

  private getClientCountryHintFromRequest(req: Request): string | null {
    const raw = req.headers[CLIENT_GEO_COUNTRY_HEADER];
    const normalized =
      typeof raw === 'string'
        ? raw.trim().toUpperCase()
        : Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string'
          ? raw[0].trim().toUpperCase()
          : '';
    if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
      return null;
    }
    return normalized;
  }

  private getClientIpHintFromRequest(req: Request): string | null {
    const raw = req.headers[CLIENT_GEO_IP_HEADER];
    const normalized =
      typeof raw === 'string'
        ? raw.trim()
        : Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string'
          ? raw[0].trim()
          : '';
    if (!normalized || isPrivateOrLocalClientIp(normalized)) {
      return null;
    }
    return normalized;
  }

  async resolvePricingCountry(
    req: Request,
  ): Promise<CountryHeaderMatch | null> {
    const cdnCountry = this.getCountryCodeFromRequest(req);
    if (cdnCountry) {
      return cdnCountry;
    }

    const trustedIp = this.resolveTrustedClientIp(req);
    if (trustedIp && !isPrivateOrLocalClientIp(trustedIp)) {
      const countryCodeFromIp =
        await this.ipInfoGeoService.lookupCountryByIp(trustedIp);
      if (countryCodeFromIp) {
        return {
          source: 'ipinfo',
          countryCode: countryCodeFromIp,
        };
      }
    }

    const clientCountryHint = this.getClientCountryHintFromRequest(req);
    const clientIpHint = this.getClientIpHintFromRequest(req);
    if (clientCountryHint && clientIpHint) {
      const verifiedCountry =
        await this.ipInfoGeoService.lookupCountryByIp(clientIpHint);
      if (verifiedCountry === clientCountryHint) {
        return {
          source: 'client_hint',
          countryCode: clientCountryHint,
        };
      }
    }

    return null;
  }

  normalizeLinkedinCountry(
    value?: string | null,
  ): string | undefined {
    return normalizeLinkedinConnectionCountry(value ?? undefined);
  }
}
