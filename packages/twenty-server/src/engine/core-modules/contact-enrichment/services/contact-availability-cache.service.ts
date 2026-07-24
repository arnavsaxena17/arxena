import { Inject, Injectable, Logger } from '@nestjs/common';

import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import type {
    ContactAvailability,
    ContactEnrichmentOptions,
    ContactResult,
} from '../types/contact-enrichment.types';

type CachedAvailability = {
  emailAvailable: boolean;
  phoneAvailable: boolean;
  cachedAt: number;
  provider?: string;
};

type CachedContactResult = {
  emails: string[];
  phones: string[];
  source: string;
  linkedinUrl?: string;
  fullName?: string;
  cachedAt: number;
};

@Injectable()
export class ContactAvailabilityCacheService {
  private readonly logger = new Logger(ContactAvailabilityCacheService.name);
  private readonly availabilityTtl = 72 * 60 * 60 * 1000; // 72 hours in milliseconds
  private readonly contactResultTtl = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(
    @Inject(CacheStorageNamespace.EngineContactEnrichment)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  /**
   * Normalize LinkedIn URL for cache key (strip protocol and www).
   */
  private normalizeLinkedInUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Get cache key for a LinkedIn URL.
   */
  private getAvailabilityKey(linkedinUrl: string): string {
    return `availability:${this.normalizeLinkedInUrl(linkedinUrl)}`;
  }

  /**
   * Get cache key for contact result.
   */
  private getContactResultKey(linkedinUrl: string): string {
    return `result:${this.normalizeLinkedInUrl(linkedinUrl)}`;
  }

  /**
   * Contact-result cache key when fetch may use LinkedIn, Apollo id+domain, or both.
   */
  getContactResultCacheKey(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): string {
    const apolloId = options?.apolloPersonId?.trim();
    const apolloDom = options?.companyDomain?.trim().toLowerCase();
    const li = linkedinUrl?.trim();
    if (!li && apolloId && apolloDom) {
      return `result:apollo-only:${apolloId}:${apolloDom}`;
    }
    if (li && apolloId && apolloDom) {
      return `result:${this.normalizeLinkedInUrl(li)}:apollo:${apolloId}:${apolloDom}`;
    }
    if (li) {
      return this.getContactResultKey(li);
    }
    return 'result:empty';
  }

  /**
   * Get cached availability for a LinkedIn URL.
   */
  async getAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability | null> {
    try {
      const key = this.getAvailabilityKey(linkedinUrl);
      const cached = await this.cacheStorage.get<CachedAvailability>(key);
      
      if (cached) {
        // Check if cache is still valid
        const age = Date.now() - cached.cachedAt;
        if (age < this.availabilityTtl) {
          return {
            emailAvailable: cached.emailAvailable,
            phoneAvailable: cached.phoneAvailable,
            provider: cached.provider,
          };
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get cached availability for ${linkedinUrl}`,
        error as Error,
      );
      return null;
    }
  }

  /**
   * Cache availability for a LinkedIn URL.
   */
  async setAvailability(
    linkedinUrl: string,
    availability: ContactAvailability,
  ): Promise<void> {
    try {
      const key = this.getAvailabilityKey(linkedinUrl);
      const cached: CachedAvailability = {
        ...availability,
        cachedAt: Date.now(),
      };
      
      await this.cacheStorage.set(key, cached, this.availabilityTtl);
    } catch (error) {
      this.logger.error(
        `Failed to cache availability for ${linkedinUrl}`,
        error as Error,
      );
    }
  }

  /**
   * Get cached contact result (LinkedIn-only key; see {@link getContactResultForFetch}).
   */
  async getContactResult(linkedinUrl: string): Promise<ContactResult | null> {
    try {
      const key = this.getContactResultKey(linkedinUrl);
      const cached = await this.cacheStorage.get<CachedContactResult>(key);
      
      if (cached) {
        // Check if cache is still valid
        const age = Date.now() - cached.cachedAt;
        if (age < this.contactResultTtl) {
          return {
            emails: cached.emails,
            phones: cached.phones,
            source: cached.source,
            ...(cached.linkedinUrl ? { linkedinUrl: cached.linkedinUrl } : {}),
            ...(cached.fullName ? { fullName: cached.fullName } : {}),
          };
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get cached contact result for ${linkedinUrl}`,
        error as Error,
      );
      return null;
    }
  }

  /**
   * Get cached contact result for a fetch that may include Apollo id + domain in options.
   */
  async getContactResultForFetch(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult | null> {
    try {
      const key = this.getContactResultCacheKey(linkedinUrl, options);
      const cached = await this.cacheStorage.get<CachedContactResult>(key);

      if (cached) {
        const age = Date.now() - cached.cachedAt;
        if (age < this.contactResultTtl) {
          return {
            emails: cached.emails,
            phones: cached.phones,
            source: cached.source,
            ...(cached.linkedinUrl ? { linkedinUrl: cached.linkedinUrl } : {}),
            ...(cached.fullName ? { fullName: cached.fullName } : {}),
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get cached contact result for fetch key`,
        error as Error,
      );
      return null;
    }
  }

  /**
   * Cache contact result for a LinkedIn URL.
   */
  async setContactResult(
    linkedinUrl: string,
    result: ContactResult,
  ): Promise<void> {
    try {
      const key = this.getContactResultKey(linkedinUrl);
      const cached: CachedContactResult = {
        ...result,
        cachedAt: Date.now(),
      };
      
      await this.cacheStorage.set(key, cached, this.contactResultTtl);
    } catch (error) {
      this.logger.error(
        `Failed to cache contact result for ${linkedinUrl}`,
        error as Error,
      );
    }
  }

  /**
   * Cache contact result for a fetch that may include Apollo id + domain in options.
   */
  async setContactResultForFetch(
    linkedinUrl: string,
    result: ContactResult,
    options?: ContactEnrichmentOptions,
  ): Promise<void> {
    try {
      const key = this.getContactResultCacheKey(linkedinUrl, options);
      const cached: CachedContactResult = {
        ...result,
        cachedAt: Date.now(),
      };

      await this.cacheStorage.set(key, cached, this.contactResultTtl);
    } catch (error) {
      this.logger.error(
        `Failed to cache contact result for fetch key`,
        error as Error,
      );
    }
  }
}
