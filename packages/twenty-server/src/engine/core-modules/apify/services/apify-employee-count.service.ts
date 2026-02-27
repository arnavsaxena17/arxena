import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import { ApifyService } from './apify.service';

const LINKEDIN_EMPLOYEES_ACTOR_ID = 'harvestapi/linkedin-company-employees';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function normalizeLinkedInCompanyUrl(urlOrSlug: string): string {
  const trimmed = urlOrSlug.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://www.linkedin.com/company/${encodeURIComponent(trimmed)}`;
}

function extractCountFromLog(log: string): number | null {
  const match = log.match(/Found\s+(\d+)\s+profiles\s+total\s+for\s+input/);
  if (match) {
    const count = parseInt(match[1], 10);
    return Number.isNaN(count) ? null : count;
  }
  return null;
}

@Injectable()
export class ApifyEmployeeCountService {
  private readonly logger = new Logger(ApifyEmployeeCountService.name);

  constructor(
    private readonly apifyService: ApifyService,
    @InjectCacheStorage(CacheStorageNamespace.EngineApify)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  async getEmployeeCount(
    linkedinCompanyUrlOrSlug: string,
  ): Promise<number | null> {
    if (!linkedinCompanyUrlOrSlug?.trim()) {
      return null;
    }

    const normalizedUrl = normalizeLinkedInCompanyUrl(linkedinCompanyUrlOrSlug);
    const cacheKey = `employee-count:${normalizedUrl}`;

    const cached = await this.cacheStorage.get<number>(cacheKey);
    if (typeof cached === 'number') {
      this.logger.log(`Employee count cached for ${normalizedUrl}: ${cached}`);
      return cached;
    }

    this.logger.log(`Employee count not cached for ${normalizedUrl}, running actor`);

    if (!this.apifyService.isConfigured()) {
      this.logger.warn(
        'APIFY_API_TOKEN not configured, employee count lookup skipped',
      );
      return null;
    }

    const input = {
      companies: [normalizedUrl],
      maxItems: 1,
      profileScraperMode: 'Short ($4 per 1k)',
      companyBatchMode: 'all_at_once',
    };

    const runResult = await this.apifyService.runActor(
      LINKEDIN_EMPLOYEES_ACTOR_ID,
      input,
    );

    if (!runResult) {
      return null;
    }

    const log = await this.apifyService.getRunLog(runResult.runId);
    if (!log) {
      return null;
    }

    const count = extractCountFromLog(log);
    if (count !== null) {
      await this.cacheStorage.set(cacheKey, count, CACHE_TTL_MS);
    }

    return count;
  }
}
