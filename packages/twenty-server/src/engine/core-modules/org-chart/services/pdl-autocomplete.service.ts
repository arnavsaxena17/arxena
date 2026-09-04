import { createHash } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import {
  PDL_AUTOCOMPLETE_FALLBACK_KEY_ENV_NAME,
  PDL_AUTOCOMPLETE_SHARED_KEY_ENV_NAMES,
  PDL_AUTOCOMPLETE_TWENTY_FRONT_KEY_ENV_NAME,
  PdlAutocompleteKeySlot,
  resolvePdlAutocompleteKeyPool,
} from '../utils/pdl-autocomplete-key-pool.util';

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

export type PdlCompanyAutocompleteOptions = {
  includeTwentyFrontReservedKey?: boolean;
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

  isConfigured(includeTwentyFrontReservedKey = false): boolean {
    return this.getKeyPool(includeTwentyFrontReservedKey).length > 0;
  }

  async isCoolingDown(includeTwentyFrontReservedKey = false): Promise<boolean> {
    const keyPool = this.getKeyPool(includeTwentyFrontReservedKey);
    if (keyPool.length === 0) {
      return false;
    }

    const coolingFlags = await Promise.all(
      keyPool.map((slot) => this.isKeyCoolingDown(slot)),
    );

    return coolingFlags.every((isCoolingDown) => isCoolingDown === true);
  }

  async getCompanyAutocomplete(
    inputText: string,
    options?: PdlCompanyAutocompleteOptions,
  ): Promise<CompanyAutocompleteItem[]> {
    const includeTwentyFrontReservedKey =
      options?.includeTwentyFrontReservedKey === true;
    const keyPool = this.getKeyPool(includeTwentyFrontReservedKey);

    if (keyPool.length === 0) {
      this.logger.warn(
        'PDL API keys not configured, company autocomplete disabled',
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
    if (cached && cached.length > 0) {
      return cached;
    }

    const params = new URLSearchParams({
      field: 'company',
      text: inputText.trim(),
      size: '10',
    });
    const url = `${this.pdlAutocompleteUrl}?${params.toString()}`;

    for (const slot of keyPool) {
      if (await this.isKeyCoolingDown(slot)) {
        continue;
      }

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Api-Key': slot.value,
            Accept: 'application/json',
          },
        });

        if (response.status === 429) {
          await this.markKeyCoolingDown(slot);
          this.logger.warn(
            `PDL autocomplete returned 429 for ${slot.name}; cooling down for ${RATE_LIMIT_COOLDOWN_MS / 1000}s and trying next key`,
          );
          continue;
        }

        if (!response.ok) {
          this.logger.warn(
            `PDL autocomplete returned ${response.status} for ${slot.name}`,
          );
          continue;
        }

        const responseJson = await response.json();
        const results = this.mapAutocompleteResponse(
          responseJson as PdlAutocompleteResponse,
        );

        if (results.length > 0) {
          await this.cacheStorage.set(cacheKey, results, CACHE_TTL_MS);
        }
        return results;
      } catch (error) {
        this.logger.error(
          `PDL company autocomplete failed for ${slot.name}`,
          error,
        );
      }
    }

    return [];
  }

  private getKeyPool(
    includeTwentyFrontReservedKey: boolean,
  ): PdlAutocompleteKeySlot[] {
    const keysByName: Record<string, string | undefined> = {
      [PDL_AUTOCOMPLETE_FALLBACK_KEY_ENV_NAME]:
        this.environmentService.get('PDL_API_KEY'),
      [PDL_AUTOCOMPLETE_TWENTY_FRONT_KEY_ENV_NAME]:
        this.environmentService.get('JAWAHAR_PDL_API_KEY'),
    };

    for (const name of PDL_AUTOCOMPLETE_SHARED_KEY_ENV_NAMES) {
      keysByName[name] = this.environmentService.get(name);
    }

    return resolvePdlAutocompleteKeyPool({
      keysByName,
      includeTwentyFrontReservedKey,
    });
  }

  private buildCacheKey(inputText: string): string {
    return `pdl-autocomplete:${inputText.trim().toLowerCase()}`;
  }

  private buildRateLimitCacheKey(slot: PdlAutocompleteKeySlot): string {
    const fingerprint = createHash('sha256')
      .update(slot.value)
      .digest('hex')
      .slice(0, 12);

    return `pdl-autocomplete:rate-limited:${fingerprint}`;
  }

  private async isKeyCoolingDown(
    slot: PdlAutocompleteKeySlot,
  ): Promise<boolean> {
    const rateLimited = await this.cacheStorage.get<boolean>(
      this.buildRateLimitCacheKey(slot),
    );

    return rateLimited === true;
  }

  private async markKeyCoolingDown(
    slot: PdlAutocompleteKeySlot,
  ): Promise<void> {
    await this.cacheStorage.set(
      this.buildRateLimitCacheKey(slot),
      true,
      RATE_LIMIT_COOLDOWN_MS,
    );
  }

  private mapAutocompleteResponse(
    json: PdlAutocompleteResponse,
  ): CompanyAutocompleteItem[] {
    const data = json?.data ?? [];

    return data
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
  }
}
