import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import type {
  GtmCompanyEnrichmentPartial,
  GtmCompanyEnrichmentSource,
  GtmCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/gtm-command/utils/gtm-company-enrichment-source.types';
import type { GtmWikiCompanyHit } from 'src/engine/core-modules/gtm-command/utils/gtm-workspace-profile-draft.util';
import { WikidataCompanySearchService } from 'src/engine/core-modules/wikidata/services/wikidata-company-search.service';
import type { WikidataCompanyProfile } from 'src/engine/core-modules/wikidata/types/wikidata-company.types';

// Require at least an official-website host match (see scoreWikidataCompanyCandidate)
const MIN_WIKIDATA_MATCH_SCORE = 50;

export const mapWikidataProfileToWikiCompanyHit = (
  profile: WikidataCompanyProfile,
): GtmWikiCompanyHit => ({
  id: profile.wikidataId,
  name: profile.companyName,
  website: profile.website ?? profile.companyDomain,
  industry: profile.industry ?? undefined,
  country: profile.headquarters?.country ?? profile.country ?? undefined,
  locality: profile.headquarters?.city ?? undefined,
  size:
    profile.employeeCount !== null && profile.employeeCount !== undefined
      ? String(profile.employeeCount)
      : undefined,
  founded:
    profile.foundedYear !== null && profile.foundedYear !== undefined
      ? String(profile.foundedYear)
      : undefined,
});

// Public Wikidata.org enrichment via official website (P856) domain lookup
@Injectable()
export class GtmWikidataCompanyEnrichmentSource
  implements GtmCompanyEnrichmentSource
{
  readonly sourceId = 'wikidata' as const;
  private readonly logger = new Logger(GtmWikidataCompanyEnrichmentSource.name);

  constructor(
    @Optional()
    private readonly wikidataCompanySearchService?: WikidataCompanySearchService,
  ) {}

  async enrich(
    input: GtmCompanyEnrichmentSourceInput,
  ): Promise<GtmCompanyEnrichmentPartial | null> {
    if (!isDefined(this.wikidataCompanySearchService)) {
      return null;
    }

    try {
      const result = await this.wikidataCompanySearchService.searchByDomain(
        input.domain,
      );
      const bestMatch = result.companies[0];

      if (
        !isDefined(bestMatch) ||
        bestMatch.matchScore < MIN_WIKIDATA_MATCH_SCORE
      ) {
        return null;
      }

      return {
        sourceId: this.sourceId,
        wikidataCompany: mapWikidataProfileToWikiCompanyHit(bestMatch),
      };
    } catch (error) {
      this.logger.warn(
        `Wikidata enrich failed for domain ${input.domain}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
