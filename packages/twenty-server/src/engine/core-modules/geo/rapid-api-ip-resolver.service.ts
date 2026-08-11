import { Injectable, Logger } from '@nestjs/common';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export type RapidApiResolution = {
  companyName: string | null;
  domain: string | null;
  asn: string | null;
  asnOwner: string | null;
  source: 'rapidapi_ipapi' | 'rapidapi_ip2location' | null;
};

const IP_API_HOST = 'ip-api-com.p.rapidapi.com';
const IP2LOCATION_HOST = 'ip2location1.p.rapidapi.com';
const LOOKUP_TIMEOUT_MS = 3_000;

/**
 * Resolves an IP to a company via RapidAPI-marketplace IP endpoints, used as a
 * fallback layer in the IP→company waterfall. Tries ip-api.com first, then
 * ip2location1. Requires the caller to be subscribed to each endpoint on
 * RapidAPI (free Basic tiers exist); an unsubscribed endpoint returns null and
 * the next source is tried.
 *
 * The RapidAPI key is read from RAPIDAPI_KEY (already present in server .env).
 * This service consumes RapidAPI directly per their "Consume APIs using AI"
 * pattern: X-RapidAPI-Key + X-RapidAPI-Host headers, no SDK.
 */
@Injectable()
export class RapidApiIpResolverService {
  private readonly logger = new Logger(RapidApiIpResolverService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  async resolve(ip: string): Promise<RapidApiResolution> {
    const key = this.twentyConfigService.get('RAPIDAPI_KEY');
    if (!key) {
      return this.empty();
    }

    const ipApi = await this.tryIpApi(ip, key);
    if (ipApi.companyName) {
      return { ...ipApi, source: 'rapidapi_ipapi' };
    }

    const ip2 = await this.tryIp2Location(ip, key);
    if (ip2.companyName) {
      return { ...ip2, source: 'rapidapi_ip2location' };
    }

    return this.empty();
  }

  private empty(): RapidApiResolution {
    return {
      companyName: null,
      domain: null,
      asn: null,
      asnOwner: null,
      source: null,
    };
  }

  private async tryIpApi(
    ip: string,
    key: string,
  ): Promise<RapidApiResolution> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      const res = await fetch(`https://${IP_API_HOST}/json/${ip}`, {
        headers: {
          'X-RapidAPI-Key': key,
          'X-RapidAPI-Host': IP_API_HOST,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return this.empty();
      }
      const data = (await res.json()) as {
        status?: string;
        isp?: string;
        org?: string;
        as?: string;
      };
      if (data.status !== 'success') {
        return this.empty();
      }
      const org = data.org?.trim() || data.isp?.trim() || null;
      return {
        companyName: org,
        domain: null,
        asn: this.asnFrom(data.as),
        asnOwner: org,
        source: null,
      };
    } catch (error) {
      this.logger.warn('[RapidApiIpResolverService] ip-api failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.empty();
    }
  }

  private async tryIp2Location(
    ip: string,
    key: string,
  ): Promise<RapidApiResolution> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      const res = await fetch(`https://${IP2LOCATION_HOST}/?ip=${ip}`, {
        headers: {
          'X-RapidAPI-Key': key,
          'X-RapidAPI-Host': IP2LOCATION_HOST,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return this.empty();
      }
      const data = (await res.json()) as {
        isp?: string;
        domain?: string;
        asn?: string;
        as?: string;
      };
      const org = data.isp?.trim() || null;
      return {
        companyName: org,
        domain: data.domain?.trim() || null,
        asn: data.asn?.trim() || this.asnFrom(data.as),
        asnOwner: org,
        source: null,
      };
    } catch (error) {
      this.logger.warn('[RapidApiIpResolverService] ip2location failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.empty();
    }
  }

  private asnFrom(asField?: string): string | null {
    if (!asField) {
      return null;
    }
    const match = asField.match(/AS\d+/i);
    return match ? match[0].toUpperCase() : null;
  }
}
