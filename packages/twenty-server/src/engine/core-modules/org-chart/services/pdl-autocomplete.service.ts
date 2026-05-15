import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

export type CompanyAutocompleteItem = {
  name: string;
  meta: {
    id: string;
    linkedin_slug?: string;
    website?: string;
    industry?: string;
    location_name?: string;
    linkedin_url?: string;
    employee_count?: number;
  };
  count: number;
};

type PdlAutocompleteResponse = {
  data?: Array<{
    name?: string;
    id?: string;
    linkedin_id?: string;
    website?: string;
    linkedin_slug?: string;
    count?: number;
    meta?: {
      id?: string;
      linkedin_slug?: string;
      website?: string;
      industry?: string;
      location_name?: string;
    };
  }>;
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const PDL_RATE_LIMIT_CACHE_KEY = 'pdl-autocomplete:rate-limited';

@Injectable()
export class PdlAutocompleteService {
  private readonly logger = new Logger(PdlAutocompleteService.name);
  private readonly pdlAutocompleteUrl =
    'https://api.peopledatalabs.com/v5/autocomplete';

  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  isConfigured(): boolean {
    const key = this.environmentService.get('PDL_API_KEY');
    return typeof key === 'string' && key.length > 0;
  }

  private getApiKey(): string | undefined {
    const key = this.environmentService.get('PDL_API_KEY');
    return typeof key === 'string' && key.length > 0 ? key : undefined;
  }

  private buildCacheKey(inputText: string): string {
    return `pdl-autocomplete:${inputText.trim().toLowerCase()}`;
  }

  async getCompanyAutocomplete(
    inputText: string,
  ): Promise<CompanyAutocompleteItem[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        'PDL_API_KEY not configured, company autocomplete disabled',
      );
      return [];
    }

    if (!inputText?.trim()) {
      return [];
    }

    const cacheKey = this.buildCacheKey(inputText);
    const cached = await this.cacheStorage.get<CompanyAutocompleteItem[]>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const rateLimited = await this.cacheStorage.get<boolean>(
      PDL_RATE_LIMIT_CACHE_KEY,
    );
    if (rateLimited) {
      return [];
    }

    const params = new URLSearchParams({
      field: 'company',
      text: inputText.trim(),
      size: '10',
    });

    try {
      const url = `${this.pdlAutocompleteUrl}?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        await this.cacheStorage.set(
          PDL_RATE_LIMIT_CACHE_KEY,
          true,
          RATE_LIMIT_COOLDOWN_MS,
        );
        this.logger.warn(
          `PDL autocomplete returned 429 for company search; cooling down for ${RATE_LIMIT_COOLDOWN_MS / 1000}s`,
        );
        return [];
      }

      if (!response.ok) {
        this.logger.warn(
          `PDL autocomplete returned ${response.status} for company search`,
        );
        return [];
      }
      const responseJson = await response.json();
      const json = responseJson as PdlAutocompleteResponse;
      const data = json?.data ?? [];
      const results = data
        .filter((item) => (item?.count ?? 0) >= 5)
        .map((item) => {
          const meta = item?.meta;
          const linkedinSlug =
            meta?.linkedin_slug ?? item?.linkedin_slug ?? undefined;
          return {
            name: item?.name ?? '',
            meta: {
              id:
                linkedinSlug ??
                meta?.id ??
                item?.id ??
                item?.linkedin_id ??
                item?.name ??
                '',
              linkedin_slug: linkedinSlug,
              website: meta?.website ?? item?.website,
              industry: meta?.industry,
              location_name: meta?.location_name,
            },
            count: item?.count ?? 0,
          };
        });

      await this.cacheStorage.set(cacheKey, results, CACHE_TTL_MS);
      return results;
    } catch (error) {
      this.logger.error('PDL company autocomplete failed', error);
      return [];
    }
  }
}
