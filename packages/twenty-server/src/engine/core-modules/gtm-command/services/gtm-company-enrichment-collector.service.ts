import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import type {
  GtmCollectedCompanyEnrichment,
  GtmCompanyEnrichmentSource,
  GtmCompanyEnrichmentSourceId,
  GtmCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/gtm-command/utils/gtm-company-enrichment-source.types';

export const GTM_COMPANY_ENRICHMENT_SOURCES = Symbol(
  'GTM_COMPANY_ENRICHMENT_SOURCES',
);

// Runs registered company enrichment sources in order, merging partials.
// Add a new Nest provider implementing GtmCompanyEnrichmentSource and include
// it in the GTM_COMPANY_ENRICHMENT_SOURCES factory array to extend.
@Injectable()
export class GtmCompanyEnrichmentCollectorService {
  private readonly logger = new Logger(
    GtmCompanyEnrichmentCollectorService.name,
  );

  constructor(
    @Optional()
    @Inject(GTM_COMPANY_ENRICHMENT_SOURCES)
    private readonly sources: GtmCompanyEnrichmentSource[] | null,
  ) {}

  async collect(
    input: GtmCompanyEnrichmentSourceInput,
  ): Promise<GtmCollectedCompanyEnrichment> {
    const collected: GtmCollectedCompanyEnrichment = {
      apolloOrganization: null,
      wikiCompany: null,
      wikidataCompany: null,
      linkedInSearchHit: null,
      linkedInCompanyProfile: null,
      webSearchCompany: null,
      sourceIds: [],
    };

    const enrichmentSources = this.sources ?? [];

    for (const source of enrichmentSources) {
      try {
        const hints = {
          companyName:
            collected.wikiCompany?.name ??
            collected.linkedInCompanyProfile?.name ??
            collected.linkedInSearchHit?.name ??
            collected.wikidataCompany?.name ??
            (typeof collected.apolloOrganization?.name === 'string'
              ? collected.apolloOrganization.name
              : null) ??
            input.workspaceDisplayName ??
            null,
          linkedInUrl:
            collected.wikiCompany?.linkedin_url ??
            collected.linkedInSearchHit?.profile_url ??
            collected.wikidataCompany?.linkedin_url ??
            (typeof collected.apolloOrganization?.linkedin_url === 'string'
              ? collected.apolloOrganization.linkedin_url
              : null) ??
            null,
        };

        const partial = await source.enrich({
          ...input,
          hints,
        });

        if (!partial) {
          continue;
        }

        collected.sourceIds.push(partial.sourceId as GtmCompanyEnrichmentSourceId);

        if (partial.apolloOrganization) {
          collected.apolloOrganization = partial.apolloOrganization;
        }

        if (partial.wikiCompany) {
          collected.wikiCompany = partial.wikiCompany;
        }

        if (partial.wikidataCompany) {
          collected.wikidataCompany = partial.wikidataCompany;
        }

        if (partial.linkedInSearchHit) {
          collected.linkedInSearchHit = partial.linkedInSearchHit;
        }

        if (partial.linkedInCompanyProfile) {
          collected.linkedInCompanyProfile = partial.linkedInCompanyProfile;
        }

        if (partial.webSearchCompany) {
          collected.webSearchCompany = partial.webSearchCompany;
        }

        if (isNonEmptyString(partial.linkedInAccountId)) {
          collected.linkedInAccountId = partial.linkedInAccountId;
        }
      } catch (error) {
        this.logger.warn(
          `Company enrichment source "${source.sourceId}" failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `GTM company enrichment sources used=[${collected.sourceIds.join(', ')}] domain=${input.domain}`,
    );

    return collected;
  }
}
