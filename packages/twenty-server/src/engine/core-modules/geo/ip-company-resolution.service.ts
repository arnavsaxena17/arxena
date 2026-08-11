import { Injectable } from '@nestjs/common';

import { isPrivateOrLocalClientIp } from 'twenty-shared';

import { IpInfoGeoService } from 'src/engine/core-modules/geo/ip-info-geo.service';
import { RapidApiIpResolverService } from 'src/engine/core-modules/geo/rapid-api-ip-resolver.service';

export type IpCompanyResolution = {
  /** Resolved organization / company name, when available. */
  companyName: string | null;
  /** Best-guess primary web domain for the company, when available. */
  domain: string | null;
  /** Autonomous System Number (e.g. "AS15169"). */
  asn: string | null;
  /** ASN owner / netblock org from the registry (usually the ISP or the company). */
  asnOwner: string | null;
  /** Reverse-DNS hostname, when present (often reveals the company directly). */
  rdnsHostname: string | null;
  /**
   * Confidence in the companyName resolution:
   * - "high"   → a named org resolved (ipinfo org OR rdns hostname embeds a
   *              company domain OR asnOwner is a single named org, not an ISP)
   * - "medium" → asnOwner present but looks like a consumer ISP / broadband
   * - "low"    → only an ASN number resolved, no usable org name
   * - "none"   → nothing resolved
   */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Which signal produced the companyName. */
  source:
    | 'ipinfo_org'
    | 'rdns'
    | 'asn_owner'
    | 'ripe_org'
    | 'rapidapi_ipapi'
    | 'rapidapi_ip2location'
    | null;
};

const LOOKUP_TIMEOUT_MS = 3_000;
const RIPE_STAT_BASE = 'https://stat.ripe.net/data';

type AsnInfo = {
  asn: string | null;
  asnOwner: string | null;
  /** Org website when RIPE provides one. */
  website: string | null;
};

@Injectable()
export class IpCompanyResolutionService {
  constructor(
    private readonly ipInfoGeoService: IpInfoGeoService,
    private readonly rapidApiIpResolverService: RapidApiIpResolverService,
  ) {}

  /**
   * Resolve an IP to a company/organization via a waterfall of free /
   * already-licensed signals, in priority order:
   *   1. ipinfo `org` + `hostname`  (free tier returns these for most IPs)
   *   2. reverse DNS                 (Node dns.reverse)
   *   3. RIPE stat API IP→ASN→org    (free, JSON)
   *   4. RapidAPI ip-api.com         (free Basic tier; must be subscribed)
   *   5. RapidAPI ip2location1       (free Basic tier; must be subscribed)
   *
   * Each layer only runs if the prior one returned no usable company name.
   * The RapidAPI layer extends SMB / residential-ISP coverage beyond RIPE.
   *
   * Accuracy is bounded by the free stack: large enterprises with their own
   * netblock or disciplined rDNS resolve well; SMB / residential IPs usually
   * only yield the consumer ISP. A MaxMind GeoIP2 ISP/Org DB would extend
   * coverage further but requires a paid license, so it is intentionally
   * out of scope here.
   */
  async resolveCompanyByIp(clientIp: string): Promise<IpCompanyResolution> {
    const empty: IpCompanyResolution = {
      companyName: null,
      domain: null,
      asn: null,
      asnOwner: null,
      rdnsHostname: null,
      confidence: 'none',
      source: null,
    };

    const normalizedIp = (clientIp ?? '').trim();
    if (!normalizedIp || isPrivateOrLocalClientIp(normalizedIp)) {
      return empty;
    }

    // 1. ipinfo org (preferred when present — cleanest company label)
    const ipInfo = await this.ipInfoGeoService.lookupCompanyByIp(normalizedIp);
    if (ipInfo.org) {
      return {
        companyName: ipInfo.org,
        domain: ipInfo.hostname ?? null,
        asn: this.asnFromOrg(ipInfo.org),
        asnOwner: ipInfo.org,
        rdnsHostname: ipInfo.hostname ?? null,
        confidence: 'high',
        source: 'ipinfo_org',
      };
    }

    // 2. rDNS hostname embeds a recognizable company domain
    const rdnsHostname = await this.lookupRdns(normalizedIp);
    if (rdnsHostname && this.looksCorporate(rdnsHostname, null)) {
      const domainFromRdns = this.domainFromHostname(rdnsHostname);
      return {
        companyName: domainFromRdns ?? rdnsHostname,
        domain: domainFromRdns,
        asn: null,
        asnOwner: null,
        rdnsHostname,
        confidence: 'high',
        source: 'rdns',
      };
    }

    // 3. RIPE ASN owner
    const asnInfo = await this.lookupAsnViaRipe(normalizedIp);
    if (asnInfo?.asnOwner) {
      const owner = asnInfo.asnOwner;
      const isIsp = this.looksLikeResidentialIsp(owner);
      return {
        companyName: owner,
        domain: asnInfo.website ?? this.domainFromOrgName(owner),
        asn: asnInfo.asn,
        asnOwner: owner,
        rdnsHostname: rdnsHostname ?? null,
        confidence: isIsp ? 'medium' : 'high',
        source: asnInfo.website ? 'ripe_org' : 'asn_owner',
      };
    }

    // 4 + 5. RapidAPI waterfall (ip-api.com → ip2location1)
    const rapid = await this.rapidApiIpResolverService.resolve(normalizedIp);
    if (rapid.companyName) {
      const isIsp = this.looksLikeResidentialIsp(rapid.companyName);
      return {
        companyName: rapid.companyName,
        domain: rapid.domain,
        asn: rapid.asn,
        asnOwner: rapid.asnOwner,
        rdnsHostname: rdnsHostname ?? null,
        confidence: isIsp ? 'medium' : 'high',
        source: rapid.source,
      };
    }

    // ASN only, no usable org name
    if (asnInfo?.asn) {
      return {
        companyName: null,
        domain: null,
        asn: asnInfo.asn,
        asnOwner: null,
        rdnsHostname: rdnsHostname ?? null,
        confidence: 'low',
        source: null,
      };
    }

    return empty;
  }

  private asnFromOrg(org: string): string | null {
    const match = org.match(/AS\d+/i);
    return match ? match[0].toUpperCase() : null;
  }

  private async lookupRdns(ip: string): Promise<string | null> {
    try {
      const dns = await import('node:dns/promises');
      const records = await Promise.race([
        dns.reverse(ip),
        new Promise<string[]>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), LOOKUP_TIMEOUT_MS),
        ),
      ]);
      if (records && records.length > 0) {
        return records[0] ?? null;
      }
      return null;
    } catch (error) {
      console.warn('[IpCompanyResolutionService] rdns lookup failed', {
        ip,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * RIPE stat: network-info gives the ASN(s) for an IP, as-overview gives the
   * registered holder name + website. Both are free, JSON, no license.
   */
  private async lookupAsnViaRipe(ip: string): Promise<AsnInfo> {
    const fallback: AsnInfo = { asn: null, asnOwner: null, website: null };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

      const netRes = await fetch(
        `${RIPE_STAT_BASE}/network-info/data.json?resource=${encodeURIComponent(ip)}`,
        { signal: controller.signal },
      );
      if (!netRes.ok) {
        clearTimeout(timeoutId);
        return fallback;
      }
      const netJson = (await netRes.json()) as {
        data?: { asns?: number[] };
      };
      const asns = netJson.data?.asns;
      if (!asns || asns.length === 0) {
        clearTimeout(timeoutId);
        return fallback;
      }
      const asn = `AS${asns[0]}`;

      const overviewRes = await fetch(
        `${RIPE_STAT_BASE}/as-overview/data.json?resource=${encodeURIComponent(asn)}`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (!overviewRes.ok) {
        return { asn, asnOwner: null, website: null };
      }
      const overviewJson = (await overviewRes.json()) as {
        data?: { holder?: string; website?: string };
      };
      const data = overviewJson.data;
      return {
        asn,
        asnOwner: data?.holder ?? null,
        website: data?.website ?? null,
      };
    } catch (error) {
      console.warn('[IpCompanyResolutionService] ripe asn lookup failed', {
        ip,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
  }

  private domainFromHostname(hostname: string): string | null {
    const parts = hostname.toLowerCase().split('.');
    if (parts.length < 2) {
      return null;
    }
    // Return registrable domain (last two labels), skipping obvious mail/cdn prefixes.
    return parts.slice(-2).join('.');
  }

  private domainFromOrgName(orgName: string | null): string | null {
    if (!orgName) {
      return null;
    }
    // Crude fallback: no reliable domain without a real DB; RIPE website is preferred.
    return null;
  }

  private looksCorporate(
    hostname: string,
    asnOwner: string | null,
  ): boolean {
    const h = hostname.toLowerCase();
    const ispMarkers = [
      'cable',
      'dsl',
      'broadband',
      'residential',
      'hsd',
      'static',
      'dyn',
      'pool',
      'customer',
      'subscriber',
    ];
    if (ispMarkers.some((m) => h.includes(m))) {
      return false;
    }
    if (asnOwner && this.looksLikeResidentialIsp(asnOwner)) {
      // rDNS on a residential ISP netblock is almost never the company itself.
      return false;
    }
    return true;
  }

  private looksLikeResidentialIsp(owner: string): boolean {
    const o = owner.toLowerCase();
    const markers = [
      'comcast',
      'cox ',
      'spectrum',
      'charter',
      'verizon',
      'at&t',
      'att ',
      'centurylink',
      'frontier',
      'bharat sanchar',
      'bsnl',
      'jio',
      'airtel',
      'reliance',
      'vodafone',
      't-mobile',
      'deutsche telekom',
      'orange ',
      'bt plc',
      'british telecom',
      'telefonica',
      'router',
      'broadband',
      'cable',
      'dsl',
      'fiber',
      'mobile',
      'wireless',
      'communications',
    ];
    return markers.some((m) => o.includes(m));
  }
}
