import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import type { ContactEnrichmentProviderName } from '../types/contact-enrichment.types';

type RateLimitConfig = {
  requestsPerMinute: number;
};

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly rateLimits = new Map<
    ContactEnrichmentProviderName,
    RateLimitConfig
  >();
  private readonly requestTimestamps = new Map<
    ContactEnrichmentProviderName,
    number[]
  >();

  constructor(private readonly environmentService: EnvironmentService) {
    // Initialize rate limits from environment or defaults
    this.initializeRateLimits();
  }

  private initializeRateLimits(): void {
    // Default rate limits based on provider docs
    const defaults: Record<ContactEnrichmentProviderName, RateLimitConfig> = {
      arxena: { requestsPerMinute: 1000 }, // ES queries - high limit
      pdl: {
        requestsPerMinute:
          parseInt(
            (this.environmentService.get(
              'CONTACT_ENRICHMENT_RATE_LIMIT_PDL',
            ) as string | undefined) ?? '60',
            10,
          ) || 60, // Default 60/min for free, can be 1000/min for paid
      },
      contactout: {
        requestsPerMinute:
          parseInt(
            (this.environmentService.get(
              'CONTACT_ENRICHMENT_RATE_LIMIT_CONTACTOUT',
            ) as string | undefined) ?? '150',
            10,
          ) || 150, // Contact checker: 150/min
      },
      lusha: {
        requestsPerMinute:
          parseInt(
            (this.environmentService.get(
              'CONTACT_ENRICHMENT_RATE_LIMIT_LUSHA',
            ) as string | undefined) ?? '1500',
            10,
          ) || 1500, // 25/sec = 1500/min
      },
      apollo: {
        requestsPerMinute:
          parseInt(
            (this.environmentService.get(
              'CONTACT_ENRICHMENT_RATE_LIMIT_APOLLO',
            ) as string | undefined) ?? '60',
            10,
          ) || 60, // Varies by plan
      },
    };

    for (const [provider, config] of Object.entries(defaults)) {
      this.rateLimits.set(provider as ContactEnrichmentProviderName, config);
    }
  }

  /**
   * Wait if necessary to respect rate limits for a provider.
   * Returns a promise that resolves when it's safe to make the request.
   */
  async waitForRateLimit(provider: ContactEnrichmentProviderName): Promise<void> {
    const limit = this.rateLimits.get(provider);
    if (!limit) {
      return; // No limit configured
    }

    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Get or initialize request timestamps for this provider
    let timestamps = this.requestTimestamps.get(provider) ?? [];
    
    // Remove timestamps outside the 1-minute window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // If we're at the limit, wait until the oldest request expires
    if (timestamps.length >= limit.requestsPerMinute) {
      const oldestTimestamp = timestamps[0];
      const waitTime = oldestTimestamp + 60000 - now + 100; // Add 100ms buffer
      
      if (waitTime > 0) {
        this.logger.debug(
          `Rate limit reached for ${provider}, waiting ${waitTime}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        
        // Recalculate after waiting
        const newNow = Date.now();
        const newWindowStart = newNow - 60000;
        timestamps = timestamps.filter((ts) => ts > newWindowStart);
      }
    }

    // Record this request
    timestamps.push(Date.now());
    this.requestTimestamps.set(provider, timestamps);
  }

  /**
   * Get the current rate limit configuration for a provider.
   */
  getRateLimit(provider: ContactEnrichmentProviderName): RateLimitConfig | null {
    return this.rateLimits.get(provider) ?? null;
  }
}
