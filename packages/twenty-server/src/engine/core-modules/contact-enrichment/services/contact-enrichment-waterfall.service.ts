import { Injectable, Logger } from '@nestjs/common';

import type { ContactEnrichmentProvider } from '../interfaces/contact-enrichment-provider.interface';
import type {
    ContactAvailability,
    ContactEnrichmentOptions,
    ContactEnrichmentProviderName,
    ContactResult,
} from '../types/contact-enrichment.types';
import { ContactAvailabilityCacheService } from './contact-availability-cache.service';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class ContactEnrichmentWaterfallService {
  private readonly logger = new Logger(ContactEnrichmentWaterfallService.name);
  private providers: ContactEnrichmentProvider[] = [];
  private readonly providerOrder: ContactEnrichmentProviderName[] = [
    'arxena',
    'pdl',
    'contactout',
    'lusha',
    'apollo',
  ];

  constructor(
    private readonly cacheService: ContactAvailabilityCacheService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    // Providers will be set via setProviders() in module's onModuleInit
    this.logger.log('Contact enrichment waterfall service initialized');
  }

  /**
   * Set providers (called by module after all providers are instantiated).
   */
  setProviders(providers: ContactEnrichmentProvider[]): void {
    const enabledProviders = providers.filter((p) => p.isEnabled());
    this.providers = this.providerOrder
      .map((name) => enabledProviders.find((p) => p.getName() === name))
      .filter((p): p is ContactEnrichmentProvider => p !== undefined);

    this.logger.log(
      `Contact enrichment waterfall providers updated: ${this.providers.map((p) => p.getName()).join(', ')}`,
    );
  }

  /**
   * Check availability of email/phone for a LinkedIn URL using waterfall.
   */
  async checkAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability> {
    // Check cache first
    const cached = await this.cacheService.getAvailability(linkedinUrl);
    if (cached) {
      return cached;
    }

    // Try providers in order until one returns availability info
    for (const provider of this.providers) {
      try {
        await this.rateLimiter.waitForRateLimit(
          provider.getName() as ContactEnrichmentProviderName,
        );

        const availability = await provider.checkAvailability(linkedinUrl);
        
        // Accept availability if:
        // 1. Provider field exists (real availability data from providers with availability APIs)
        // 2. At least one contact type is unavailable (specific negative info)
        // Skip if both are true without provider field (fallback from providers without availability APIs)
        if (
          availability.provider ||
          !availability.emailAvailable ||
          !availability.phoneAvailable
        ) {
          // Cache and return
          await this.cacheService.setAvailability(linkedinUrl, availability);
          return availability;
        }
        // If both are true without provider field, continue to next provider
      } catch (error) {
        this.logger.warn(
          `Provider ${provider.getName()} availability check failed for ${linkedinUrl}`,
          error as Error,
        );
        // Continue to next provider
      }
    }

    // If no provider returned specific info, return default
    const defaultAvailability: ContactAvailability = {
      emailAvailable: false,
      phoneAvailable: false,
    };
    await this.cacheService.setAvailability(linkedinUrl, defaultAvailability);
    return defaultAvailability;
  }

  /**
   * Fetch contacts using the provider waterfall. Pass optional `apolloPersonId` +
   * `companyDomain` in `options` so the Apollo step can call `people/match` with
   * id+domain and optionally the profile `linkedinUrl`.
   */
  async getCachedFetchContactsResult(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult | null> {
    const cached = await this.cacheService.getContactResultForFetch(
      linkedinUrl,
      options,
    );

    if (!cached) {
      return null;
    }

    return {
      emails: options?.wantEmail !== false ? cached.emails : [],
      phones: options?.wantPhone !== false ? cached.phones : [],
      source: cached.source,
      ...(cached.linkedinUrl ? { linkedinUrl: cached.linkedinUrl } : {}),
    };
  }

  async fetchContacts(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult> {
    const apolloId = options?.apolloPersonId?.trim();
    const apolloDomain = options?.companyDomain?.trim();
    const hasLinkedin = Boolean(linkedinUrl?.trim());
    const hasApolloKey = Boolean(apolloId && apolloDomain);
    // Apollo-only: no other provider can use id+domain; avoid noisy failures.
    const providerChain =
      !hasLinkedin && hasApolloKey
        ? this.providers.filter((p) => p.getName() === 'apollo')
        : this.providers;

    // Check cache first (key includes Apollo fields when present)
    const cached = await this.getCachedFetchContactsResult(linkedinUrl, options);
    if (cached) return cached;

    for (const provider of providerChain) {
      try {
        await this.rateLimiter.waitForRateLimit(
          provider.getName() as ContactEnrichmentProviderName,
        );

        const result = await provider.fetchContacts(linkedinUrl, options);

        if (result.emails.length > 0 || result.phones.length > 0) {
          await this.cacheService.setContactResultForFetch(
            linkedinUrl,
            result,
            options,
          );
          return result;
        }
      } catch (error) {
        this.logger.warn(
          `Provider ${provider.getName()} fetch failed for ${linkedinUrl || `apollo:${apolloId ?? ''}`}`,
          error as Error,
        );
      }
    }

    const emptyResult: ContactResult = {
      emails: [],
      phones: [],
      source: 'none',
    };
    await this.cacheService.setContactResultForFetch(
      linkedinUrl,
      emptyResult,
      options,
    );
    return emptyResult;
  }
}
