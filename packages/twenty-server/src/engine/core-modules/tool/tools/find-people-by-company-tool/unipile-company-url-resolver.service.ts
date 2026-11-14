import { Injectable, Logger, Optional } from '@nestjs/common';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { isUnipileLinkedinAccountUnusableError } from 'src/engine/core-modules/arx-chat/utils/is-unipile-linkedin-account-unusable-error.util';
import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';
import { LinkedInSearchService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-search.service';
import { UnipileSearchAccountResolver } from 'src/domains/discovery/transport/linkedin-search/services/unipile-search-account.resolver';
import { isHarvestCompanyNameMatch } from 'src/domains/org-graph/org-chart/utils/harvest-company-name-match.util';

// Parameter lookups are account-agnostic -- the same company resolves to the
// same LinkedIn id on every connected account -- so the cache key is the name
// alone. That is what makes pool rotation safe here.
const COMPANY_URL_CACHE_PREFIX = 'unipile-company-url:v1';

// Ten, like the Harvest company search it stands in for: LinkedIn's typeahead
// puts a parent, a namesake or a regional unit above the company often enough
// that a match outside the first few is common for Indian legal names.
const COMPANY_PARAMETER_LIMIT = 10;

// One account per attempt. A failure is retried on a different pooled account,
// because an unusable LinkedIn account is the failure this can actually fix.
const MAX_ACCOUNT_ATTEMPTS = 3;

export type UnipileCompanyUrlResult = {
  linkedinUrl: string;
  // the name that matched, for logging and for the caller's own diagnostics
  matchedName: string;
  accountId: string;
};

/**
 * Resolves a company name to its LinkedIn company URL through Unipile's own
 * LinkedIn parameter search, which is a typeahead on an already-connected
 * account rather than a paid per-record lookup.
 *
 * This exists because Harvest cannot filter employers by name: it needs a
 * LinkedIn company URL, and the only other way to get one was Harvest's own
 * company search at $0.004 a returned record, up to five spellings per company.
 *
 * Matching is intentionally strict. The candidate must open the wanted name
 * with legal suffixes dropped (`isHarvestCompanyNameMatch`), and the first
 * ranked hit that passes wins. A looser word-overlap match would resolve
 * "Tata Steel" to the "Tata" holding company and quietly return a different
 * population -- the same failure mode as a wrong facet id.
 */
@Injectable()
export class UnipileCompanyUrlResolverService {
  private readonly logger = new Logger(UnipileCompanyUrlResolverService.name);

  constructor(
    // Optional so the service still runs where no Unipile wiring exists
    @Optional()
    private readonly linkedInSearchService?: LinkedInSearchService,
    @Optional()
    private readonly accountResolver?: UnipileSearchAccountResolver,
    @Optional()
    private readonly providerQueryCache?: ProviderQueryCacheService,
  ) {}

  isAvailable(): boolean {
    return (
      isDefined(this.linkedInSearchService) &&
      isDefined(this.accountResolver) &&
      this.accountResolver.isUnipileConfigured()
    );
  }

  async resolveCompanyLinkedinUrl(
    names: readonly string[] | null | undefined,
  ): Promise<UnipileCompanyUrlResult | null> {
    if (!this.isAvailable()) {
      return null;
    }

    // Case-insensitive: the same company arrives as "Tata Steel" and "tata
    // steel" across sources, and the cache key is lower-cased anyway.
    const byKey = new Map<string, string>();

    for (const name of names ?? []) {
      const trimmed = typeof name === 'string' ? name.trim() : '';

      if (!trimmed) {
        continue;
      }

      const key = trimmed.toLowerCase();

      if (!byKey.has(key)) {
        byKey.set(key, trimmed);
      }
    }

    const candidates = [...byKey.values()];

    if (candidates.length === 0) {
      return null;
    }

    const triedAccountIds = new Set<string>();

    for (let attempt = 0; attempt < MAX_ACCOUNT_ATTEMPTS; attempt += 1) {
      const account = await this.resolveAccount();

      if (!account) {
        return null;
      }

      // The pool handed back an account that already failed: there is no fresh
      // account left to rotate onto, so stop rather than retry the same one.
      if (triedAccountIds.has(account.accountId)) {
        return null;
      }

      triedAccountIds.add(account.accountId);

      const outcome = await this.searchWithAccount(
        account.accountId,
        candidates,
      );

      if (outcome.result) {
        return outcome.result;
      }

      // A usable account answered and simply had no match. LinkedIn's own data
      // does not change between our accounts, so another attempt cannot help.
      if (!outcome.accountUnusable) {
        return null;
      }
    }

    return null;
  }

  private async resolveAccount(): Promise<{ accountId: string } | null> {
    const resolver = this.accountResolver;

    if (!isDefined(resolver)) {
      return null;
    }

    try {
      const account = await resolver.resolve({ preferPool: true });

      return account ? { accountId: account.accountId } : null;
    } catch (error) {
      this.logger.warn(
        `Unipile company URL: no search account available: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async searchWithAccount(
    accountId: string,
    names: string[],
  ): Promise<{
    result: UnipileCompanyUrlResult | null;
    accountUnusable: boolean;
  }> {
    let lastError: unknown = null;

    for (const name of names) {
      let items: Array<{ id?: unknown; title?: unknown }>;

      try {
        items = await this.fetchCompanyParameters(accountId, name);
      } catch (error) {
        if (isUnipileLinkedinAccountUnusableError(error)) {
          this.logger.warn(
            `Unipile company URL: account ${accountId} unusable, rotating: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );

          return { result: null, accountUnusable: true };
        }

        // A per-name failure (bad query, one company the typeahead rejects) is
        // not a reason to rotate; try the next spelling instead.
        lastError = error;
        continue;
      }

      const match = this.pickMatch(name, items);

      if (match) {
        this.logger.log(
          `Unipile company URL: "${name}" resolved to "${match.title}" (${match.id}) account=${accountId}`,
        );

        return {
          result: {
            linkedinUrl: `https://www.linkedin.com/company/${match.id}/`,
            matchedName: name,
            accountId,
          },
          accountUnusable: false,
        };
      }
    }

    if (isDefined(lastError)) {
      this.logger.warn(
        `Unipile company URL: every spelling failed for ${JSON.stringify(names)}: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }

    return { result: null, accountUnusable: false };
  }

  private async fetchCompanyParameters(
    accountId: string,
    name: string,
  ): Promise<Array<{ id?: unknown; title?: unknown }>> {
    const searchService = this.linkedInSearchService;

    if (!isDefined(searchService)) {
      return [];
    }

    const run = async () => {
      const response = await searchService.getCompanyParameters(
        accountId,
        name,
        COMPANY_PARAMETER_LIMIT,
      );

      return (response?.items ?? []) as Array<{
        id?: unknown;
        title?: unknown;
      }>;
    };

    if (!isDefined(this.providerQueryCache)) {
      return await run();
    }

    // Negative results are cached too: a name the typeahead does not know stays
    // unknown for the window instead of being re-asked on every company.
    return await this.providerQueryCache.getOrFetch(
      COMPANY_URL_CACHE_PREFIX,
      { name: name.toLowerCase() },
      run,
    );
  }

  // The typeahead's own ranking decides the order; the first hit that passes
  // the strict name rule wins, so a parent or namesake above the real company
  // is skipped rather than trusted.
  private pickMatch(
    wanted: string,
    items: Array<{ id?: unknown; title?: unknown }>,
  ): { id: string; title: string } | null {
    for (const item of items) {
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const id = toLinkedinCompanyId(item.id);

      if (!title || !id) {
        continue;
      }

      if (isHarvestCompanyNameMatch(wanted, title)) {
        return { id, title };
      }
    }

    return null;
  }
}

// Unipile returns either the numeric LinkedIn company id or a URN carrying it.
// Both address a company page; anything else would build a URL that silently
// points somewhere unintended, so it is rejected.
const toLinkedinCompanyId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const urnMatch = /:(\d+)$/.exec(trimmed);

  if (trimmed.toLowerCase().startsWith('urn:') && urnMatch) {
    return urnMatch[1];
  }

  return /^[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : undefined;
};
