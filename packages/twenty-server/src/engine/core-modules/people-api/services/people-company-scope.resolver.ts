import { Injectable, Logger } from '@nestjs/common';

import { isValidUuid } from 'twenty-shared/utils';

import { SerpCompanySearchService } from 'src/engine/core-modules/linkedin-company-search/services/linkedin-company-search.service';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';
import {
  OrgChartService,
  type ResolveCompanyByDomainResult,
} from 'src/engine/core-modules/org-chart/services/org-chart.service';
import {
  extractLinkedinCompanySlugFromUrl,
  normalizeLinkedinCompanyUrl,
} from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';

import {
  isDirectCompanyNameMatch,
  scoreCompanyNameMatch,
} from '../utils/score-company-name-match.util';

export type PeopleCompanyScopeResolvedVia =
  | 'provided'
  | 'companies_es'
  | 'autocomplete'
  | 'serp_domain'
  | 'serp_linkedin'
  | 'unresolved';

export type PeopleCompanyScope = {
  companyName?: string;
  companyId?: string;
  website?: string;
  linkedinUrl?: string;
  resolvedVia: PeopleCompanyScopeResolvedVia;
};

export type ResolvePeopleCompanyScopeInput = {
  companyName?: string;
  companyId?: string;
  website?: string;
  linkedinCompanyUrl?: string;
  country?: string;
  authToken?: string;
};

type RankedCompanyCandidate = {
  companyName?: string;
  companyId?: string;
  website?: string;
  linkedinUrl?: string;
  score: number;
};

@Injectable()
export class PeopleCompanyScopeResolver {
  private readonly logger = new Logger(PeopleCompanyScopeResolver.name);

  constructor(
    private readonly companiesEsService: CompaniesEsService,
    private readonly orgChartService: OrgChartService,
    private readonly serpCompanySearchService: SerpCompanySearchService,
  ) {}

  async resolve(
    input: ResolvePeopleCompanyScopeInput,
  ): Promise<PeopleCompanyScope> {
    const companyId = input.companyId?.trim() || undefined;
    const website = input.website?.trim() || undefined;
    const companyName = input.companyName?.trim() || undefined;
    const linkedinSlug = this.linkedinSlugFromProvided(input);

    if (linkedinSlug) {
      return {
        companyName,
        companyId: linkedinSlug,
        website,
        linkedinUrl: normalizeLinkedinCompanyUrl(linkedinSlug) ?? undefined,
        resolvedVia: 'provided',
      };
    }

    if (website) {
      return this.resolveFromProvidedWebsite({
        website,
        companyName,
        country: input.country,
        authToken: input.authToken,
      });
    }

    if (companyId && !isValidUuid(companyId)) {
      return {
        companyName,
        companyId,
        website,
        linkedinUrl: normalizeLinkedinCompanyUrl(companyId) ?? undefined,
        resolvedVia: 'provided',
      };
    }

    if (!companyName) {
      return { resolvedVia: 'unresolved' };
    }

    const fromEs = await this.resolveFromCompaniesIndex(companyName);
    if (fromEs) {
      return this.withLinkedInIdFromDomain({
        ...fromEs,
        resolvedVia: 'companies_es',
        country: input.country,
        authToken: input.authToken,
      });
    }

    const fromAutocomplete = await this.resolveFromAutocomplete(
      companyName,
      input.authToken,
    );
    if (fromAutocomplete) {
      return this.withLinkedInIdFromDomain({
        ...fromAutocomplete,
        resolvedVia: 'autocomplete',
        country: input.country,
        authToken: input.authToken,
      });
    }

    return this.resolveFromSerpDomain({
      companyName,
      country: input.country,
      authToken: input.authToken,
    });
  }

  private linkedinSlugFromProvided(
    input: ResolvePeopleCompanyScopeInput,
  ): string | undefined {
    const fromUrl = extractLinkedinCompanySlugFromUrl(
      input.linkedinCompanyUrl?.trim() ?? '',
    );
    if (fromUrl && !isValidUuid(fromUrl)) {
      return fromUrl;
    }

    const companyId = input.companyId?.trim();
    if (!companyId || isValidUuid(companyId)) {
      return undefined;
    }

    return (
      extractLinkedinCompanySlugFromUrl(companyId) ??
      (companyId.includes('/') ? undefined : companyId)
    );
  }

  private async resolveFromCompaniesIndex(
    companyName: string,
  ): Promise<Omit<PeopleCompanyScope, 'resolvedVia'> | null> {
    if (!this.companiesEsService.isEnabled()) {
      return null;
    }

    try {
      const result = await this.companiesEsService.searchCompanies({
        companyName,
        limit: 8,
      });
      const ranked = result.items
        .map((item) =>
          this.rankCandidate(companyName, {
            companyName: item.name,
            companyId: item.id,
            website: item.website,
            linkedinUrl: item.linkedin_url,
          }),
        )
        .filter(
          (candidate): candidate is RankedCompanyCandidate =>
            candidate !== null,
        )
        .sort((left, right) => right.score - left.score);

      const best = ranked[0];
      if (!best || !this.isDirectHit(companyName, best)) {
        return null;
      }

      this.logger.log(
        `People company scope ES hit name="${companyName}" id=${best.companyId ?? ''} score=${best.score}`,
      );

      return {
        companyName: best.companyName || companyName,
        companyId: best.companyId,
        website: best.website,
        linkedinUrl: best.linkedinUrl,
      };
    } catch (error) {
      this.logger.warn(
        `People company scope ES lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async resolveFromAutocomplete(
    companyName: string,
    authToken?: string,
  ): Promise<Omit<PeopleCompanyScope, 'resolvedVia'> | null> {
    try {
      const results = await this.orgChartService.getCompanyAutocomplete(
        companyName,
        authToken,
      );
      const ranked = results
        .map((item) =>
          this.rankCandidate(companyName, {
            companyName: item.name,
            companyId: item.meta.linkedin_slug || item.meta.id,
            website: item.meta.website,
            linkedinUrl: item.meta.linkedin_url,
          }),
        )
        .filter(
          (candidate): candidate is RankedCompanyCandidate =>
            candidate !== null,
        )
        .sort((left, right) => right.score - left.score);

      const best = ranked[0];
      if (!best || !this.isDirectHit(companyName, best)) {
        return null;
      }

      this.logger.log(
        `People company scope autocomplete hit name="${companyName}" id=${best.companyId ?? ''} score=${best.score}`,
      );

      return {
        companyName: best.companyName || companyName,
        companyId: best.companyId,
        website: best.website,
        linkedinUrl: best.linkedinUrl,
      };
    } catch (error) {
      this.logger.warn(
        `People company scope autocomplete failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async resolveFromSerpDomain(input: {
    companyName: string;
    country?: string;
    authToken?: string;
  }): Promise<PeopleCompanyScope> {
    try {
      const serp =
        await this.serpCompanySearchService.resolveCompanyWebsiteDomain({
          companyName: input.companyName,
          country: input.country,
        });
      const domain = serp.domain?.trim();
      if (!domain) {
        return {
          companyName: input.companyName,
          resolvedVia: 'unresolved',
        };
      }

      this.logger.log(
        `People company scope SERP domain name="${input.companyName}" domain=${domain}`,
      );

      const fromDomain = await this.resolveLinkedInFromDomain({
        website: domain,
        country: input.country,
        authToken: input.authToken,
      });

      return {
        companyName:
          fromDomain?.companyName || serp.companyName || input.companyName,
        companyId: fromDomain?.companyId,
        website: domain,
        linkedinUrl:
          fromDomain?.linkedinUrl ??
          (fromDomain?.companyId
            ? (normalizeLinkedinCompanyUrl(fromDomain.companyId) ?? undefined)
            : undefined),
        resolvedVia: fromDomain?.usedSerpLinkedin
          ? 'serp_linkedin'
          : 'serp_domain',
      };
    } catch (error) {
      this.logger.warn(
        `People company scope SERP domain failed for "${input.companyName}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        companyName: input.companyName,
        resolvedVia: 'unresolved',
      };
    }
  }

  private async withLinkedInIdFromDomain(
    scope: Omit<PeopleCompanyScope, 'resolvedVia'> & {
      resolvedVia: Exclude<PeopleCompanyScopeResolvedVia, 'unresolved'>;
      country?: string;
      authToken?: string;
    },
  ): Promise<PeopleCompanyScope> {
    if (scope.companyId || !scope.website) {
      return {
        companyName: scope.companyName,
        companyId: scope.companyId,
        website: scope.website,
        linkedinUrl:
          scope.linkedinUrl ??
          (scope.companyId
            ? (normalizeLinkedinCompanyUrl(scope.companyId) ?? undefined)
            : undefined),
        resolvedVia: scope.resolvedVia,
      };
    }

    const fromDomain = await this.resolveLinkedInFromDomain({
      website: scope.website,
      country: scope.country,
      authToken: scope.authToken,
    });

    return {
      companyName: fromDomain?.companyName || scope.companyName,
      companyId: fromDomain?.companyId ?? scope.companyId,
      website: scope.website,
      linkedinUrl:
        fromDomain?.linkedinUrl ??
        scope.linkedinUrl ??
        (fromDomain?.companyId
          ? (normalizeLinkedinCompanyUrl(fromDomain.companyId) ?? undefined)
          : undefined),
      resolvedVia: scope.resolvedVia,
    };
  }

  private async resolveFromProvidedWebsite(input: {
    website: string;
    companyName?: string;
    country?: string;
    authToken?: string;
  }): Promise<PeopleCompanyScope> {
    const fromDomain = await this.resolveLinkedInFromDomain({
      website: input.website,
      country: input.country,
      authToken: input.authToken,
    });

    return {
      companyName: fromDomain?.companyName || input.companyName,
      companyId: fromDomain?.companyId,
      website: input.website,
      linkedinUrl:
        fromDomain?.linkedinUrl ??
        (fromDomain?.companyId
          ? (normalizeLinkedinCompanyUrl(fromDomain.companyId) ?? undefined)
          : undefined),
      resolvedVia: fromDomain?.usedSerpLinkedin
        ? 'serp_linkedin'
        : 'provided',
    };
  }

  private isStrongDomainCompanyHit(
    resolved: ResolveCompanyByDomainResult,
  ): boolean {
    if (!resolved.found || !resolved.companyId?.trim()) {
      return false;
    }

    if (
      resolved.source === 'orgcharts' ||
      resolved.source === 'alias' ||
      resolved.source === 'autocomplete'
    ) {
      return true;
    }

    // Stem fallback has no stored company name; a real index hit does.
    return !!resolved.companyName?.trim();
  }

  private async resolveLinkedInFromSerpDomain(input: {
    website: string;
    country?: string;
  }): Promise<{
    companyId?: string;
    companyName?: string;
    linkedinUrl?: string;
  } | null> {
    try {
      const serp =
        await this.serpCompanySearchService.resolveLinkedinCompanyUrlFromDomain(
          {
            domain: input.website,
            country: input.country,
          },
        );
      const slug = serp.linkedinCompanySlug?.trim();
      if (!slug) {
        return null;
      }

      this.logger.log(
        `People company scope SERP LinkedIn for domain=${input.website} slug=${slug}`,
      );

      return {
        companyId: slug,
        companyName: serp.companyName,
        linkedinUrl:
          serp.linkedinCompanyUrl ||
          normalizeLinkedinCompanyUrl(slug) ||
          undefined,
      };
    } catch (error) {
      this.logger.warn(
        `People company scope domain SERP LinkedIn failed for ${input.website}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async resolveLinkedInFromDomain(input: {
    website: string;
    country?: string;
    authToken?: string;
  }): Promise<{
    companyId?: string;
    companyName?: string;
    linkedinUrl?: string;
    usedSerpLinkedin: boolean;
  } | null> {
    let fromIndex: {
      companyId?: string;
      companyName?: string;
      linkedinUrl?: string;
    } | null = null;

    try {
      const resolved = await this.orgChartService.resolveCompanyByDomain(
        input.website,
        { authToken: input.authToken },
      );
      if (resolved.found && resolved.companyId?.trim()) {
        fromIndex = {
          companyId: resolved.companyId.trim(),
          companyName: resolved.companyName,
          linkedinUrl:
            normalizeLinkedinCompanyUrl(resolved.companyId) ?? undefined,
        };

        if (this.isStrongDomainCompanyHit(resolved)) {
          return {
            ...fromIndex,
            usedSerpLinkedin: false,
          };
        }
      }
    } catch (error) {
      this.logger.warn(
        `People company scope domain→LinkedIn failed for ${input.website}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const fromSerp = await this.resolveLinkedInFromSerpDomain({
      website: input.website,
      country: input.country,
    });
    if (fromSerp?.companyId) {
      return {
        ...fromSerp,
        usedSerpLinkedin: true,
      };
    }

    if (fromIndex) {
      return {
        ...fromIndex,
        usedSerpLinkedin: false,
      };
    }

    return null;
  }

  private rankCandidate(
    targetName: string,
    candidate: {
      companyName?: string;
      companyId?: string;
      website?: string;
      linkedinUrl?: string;
    },
  ): RankedCompanyCandidate | null {
    const slug =
      extractLinkedinCompanySlugFromUrl(candidate.linkedinUrl ?? '') ??
      candidate.companyId?.trim() ??
      undefined;
    const name = candidate.companyName?.trim() || '';
    if (!name && !slug) {
      return null;
    }

    const score = scoreCompanyNameMatch(targetName, name, slug);
    if (score <= 0) {
      return null;
    }

    const linkedinUrl =
      candidate.linkedinUrl?.trim() ||
      (slug ? (normalizeLinkedinCompanyUrl(slug) ?? undefined) : undefined);

    return {
      companyName: name || undefined,
      companyId: slug,
      website: candidate.website?.trim() || undefined,
      linkedinUrl,
      score,
    };
  }

  private isDirectHit(
    targetName: string,
    candidate: RankedCompanyCandidate,
  ): boolean {
    return isDirectCompanyNameMatch(
      targetName,
      candidate.companyName ?? '',
      candidate.companyId,
    );
  }
}
