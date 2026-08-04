import { Injectable, Logger } from '@nestjs/common';

import { BrightDataResidentialProxyService } from 'src/engine/core-modules/bright-data/services/bright-data-residential-proxy.service';
import { BrightDataUnlockerService } from 'src/engine/core-modules/bright-data/services/bright-data-unlocker.service';
import type {
  BuiltWithBatchResult,
  BuiltWithDomainResult,
} from 'src/engine/core-modules/builtwith/types/builtwith.types';
import { normalizeBuiltWithDomain } from 'src/engine/core-modules/builtwith/utils/normalize-builtwith-domain.util';
import {
  isBuiltWithChallengeOrEmptyPage,
  isBuiltWithNotFoundPage,
  parseBuiltWithDetailedTechnologies,
  parseBuiltWithProfileMeta,
  parseBuiltWithProfilePage,
} from 'src/engine/core-modules/builtwith/utils/parse-builtwith-html.util';

const BASE_URL = 'https://builtwith.com';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

export type BuiltWithFetchDomainOptions = {
  includeDetailed?: boolean;
  includeProfile?: boolean;
  concurrency?: number;
};

@Injectable()
export class BuiltWithService {
  private readonly logger = new Logger(BuiltWithService.name);

  constructor(
    private readonly brightDataUnlockerService: BrightDataUnlockerService,
    private readonly brightDataResidentialProxyService: BrightDataResidentialProxyService,
  ) {}

  private get userAgent(): string {
    return process.env.BUILTWITH_USER_AGENT || DEFAULT_USER_AGENT;
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BUILTWITH_REQUEST_TIMEOUT_MS ?? 90_000);
  }

  private get defaultConcurrency(): number {
    return Math.max(1, Number(process.env.BUILTWITH_FETCH_CONCURRENCY ?? 3));
  }

  buildProfileUrl(domain: string): string {
    return `${BASE_URL}/${normalizeBuiltWithDomain(domain)}`;
  }

  buildDetailedUrl(domain: string): string {
    return `${BASE_URL}/detailed/${normalizeBuiltWithDomain(domain)}`;
  }

  async fetchText(url: string): Promise<string> {
    const headers = {
      'user-agent': this.userAgent,
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      dnt: '1',
      'upgrade-insecure-requests': '1',
    };

    // Prefer residential for BuiltWith: Unlocker often gets the PoW/captcha shell
    // on profile pages, while residential returns full detailed HTML.
    if (this.brightDataResidentialProxyService.isConfigured()) {
      try {
        const response =
          await this.brightDataResidentialProxyService.fetchText(url, {
            headers,
            timeoutMs: this.requestTimeoutMs,
            validateStatus: (status) => status >= 200 && status < 500,
          });

        if (
          response.status < 400 &&
          !isBuiltWithChallengeOrEmptyPage(response.data)
        ) {
          return response.data;
        }

        this.logger.warn(
          `Residential proxy returned status=${response.status} challenge=${isBuiltWithChallengeOrEmptyPage(response.data)} for ${url}; trying Unlocker.`,
        );
      } catch (error) {
        this.logger.warn(
          `Residential proxy fetch failed for ${url}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (this.brightDataUnlockerService.isConfigured()) {
      try {
        const response = await this.brightDataUnlockerService.requestRaw({
          url,
          render: true,
        });

        if (response.statusCode >= 400) {
          throw new Error(`HTTP ${response.statusCode} fetching ${url}`);
        }

        if (isBuiltWithChallengeOrEmptyPage(response.body)) {
          this.logger.warn(
            `Bright Data Unlocker returned challenge/empty content for ${url}; falling back.`,
          );
        } else {
          return response.body;
        }
      } catch (error) {
        this.logger.warn(
          `Bright Data Unlocker fetch failed for ${url}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchDomain(
    domainInput: string,
    options: BuiltWithFetchDomainOptions = {},
  ): Promise<BuiltWithDomainResult> {
    const domain = normalizeBuiltWithDomain(domainInput);
    const includeDetailed = options.includeDetailed !== false;
    const includeProfile = options.includeProfile === true;
    const profileUrl = this.buildProfileUrl(domain);
    const detailedUrl = this.buildDetailedUrl(domain);
    const errors: string[] = [];
    const fetchedAt = new Date().toISOString();

    let profileHtml: string | null = null;
    let detailedHtml: string | null = null;
    let categories: BuiltWithDomainResult['categories'] = [];
    let detailedTechnologies: BuiltWithDomainResult['detailedTechnologies'] =
      [];
    let title: string | null = null;
    let meta = parseBuiltWithProfileMeta('');

    // Detailed page is currently less captcha-gated than the profile page.
    if (includeDetailed) {
      try {
        detailedHtml = await this.fetchText(detailedUrl);

        if (isBuiltWithChallengeOrEmptyPage(detailedHtml)) {
          errors.push(
            `Detailed page returned challenge/empty content for ${domain}`,
          );
          detailedHtml = null;
        } else if (isBuiltWithNotFoundPage(detailedHtml)) {
          errors.push(`BuiltWith detailed page not found for "${domain}"`);
          detailedHtml = null;
        } else {
          detailedTechnologies =
            parseBuiltWithDetailedTechnologies(detailedHtml);
          meta = parseBuiltWithProfileMeta(detailedHtml, detailedHtml);
          title =
            detailedHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ||
            null;
        }
      } catch (error) {
        errors.push(
          `Detailed page fetch failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (includeProfile) {
      try {
        profileHtml = await this.fetchText(profileUrl);

        if (isBuiltWithChallengeOrEmptyPage(profileHtml)) {
          errors.push(
            `Profile page returned challenge/empty content for ${domain}`,
          );
          profileHtml = null;
        } else if (isBuiltWithNotFoundPage(profileHtml)) {
          errors.push(`BuiltWith profile not found for "${domain}"`);
          profileHtml = null;
        } else {
          const profile = parseBuiltWithProfilePage(profileHtml);

          title = profile.title ?? title;
          categories = profile.categories;
          meta = {
            ...profile.meta,
            technologySpend:
              profile.meta.technologySpend ?? meta.technologySpend,
          };
        }
      } catch (error) {
        errors.push(
          `Profile page fetch failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (!profileHtml && !detailedHtml) {
      throw new Error(
        `BuiltWith fetch failed for "${domain}": ${errors.join('; ') || 'no pages returned'}`,
      );
    }

    this.logger.log(
      `BuiltWith fetched ${domain}: ${categories.reduce((sum, category) => sum + category.technologies.length, 0)} profile techs, ${detailedTechnologies.length} detailed rows`,
    );

    return {
      domain,
      profileUrl,
      detailedUrl,
      title,
      meta,
      categories,
      detailedTechnologies,
      fetchedAt,
      errors,
    };
  }

  async fetchDomains(
    domains: string[],
    options: BuiltWithFetchDomainOptions = {},
  ): Promise<BuiltWithBatchResult> {
    const normalizedDomains = [
      ...new Set(domains.map((domain) => normalizeBuiltWithDomain(domain))),
    ];
    const concurrency = Math.max(
      1,
      options.concurrency ?? this.defaultConcurrency,
    );
    const results: BuiltWithDomainResult[] = [];
    let nextIndex = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, normalizedDomains.length) },
      async () => {
        while (nextIndex < normalizedDomains.length) {
          const currentIndex = nextIndex;

          nextIndex += 1;
          const domain = normalizedDomains[currentIndex];

          try {
            const result = await this.fetchDomain(domain, options);

            results[currentIndex] = result;
          } catch (error) {
            results[currentIndex] = {
              domain,
              profileUrl: this.buildProfileUrl(domain),
              detailedUrl: this.buildDetailedUrl(domain),
              title: null,
              meta: {
                liveTechnologiesCount: null,
                lastTechnologyDetected: null,
                siteAgeLabel: null,
                topSiteRank: null,
                aiIndex: { score: null, label: null },
                technologySpend: null,
              },
              categories: [],
              detailedTechnologies: [],
              fetchedAt: new Date().toISOString(),
              errors: [
                error instanceof Error ? error.message : String(error),
              ],
            };
          }
        }
      },
    );

    await Promise.all(workers);

    return {
      fetchedAt: new Date().toISOString(),
      domains: normalizedDomains,
      results,
    };
  }
}
