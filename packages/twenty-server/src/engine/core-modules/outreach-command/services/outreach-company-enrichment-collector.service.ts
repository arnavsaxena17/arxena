import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import type {
  OutreachCollectedCompanyEnrichment,
  OutreachCompanyEnrichmentSource,
  OutreachCompanyEnrichmentSourceId,
  OutreachCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/outreach-command/utils/outreach-company-enrichment-source.types';

export const OUTREACH_COMPANY_ENRICHMENT_SOURCES = Symbol(
  'OUTREACH_COMPANY_ENRICHMENT_SOURCES',
);

// Runs registered company enrichment sources in order, merging partials.
// Add a new Nest provider implementing OutreachCompanyEnrichmentSource and include
// it in the OUTREACH_COMPANY_ENRICHMENT_SOURCES factory array to extend.
@Injectable()
export class OutreachCompanyEnrichmentCollectorService {
  private readonly logger = new Logger(
    OutreachCompanyEnrichmentCollectorService.name,
  );

  constructor(
    @Optional()
    @Inject(OUTREACH_COMPANY_ENRICHMENT_SOURCES)
    private readonly sources: OutreachCompanyEnrichmentSource[] | null,
  ) {}

  async collect(
    input: OutreachCompanyEnrichmentSourceInput,
  ): Promise<OutreachCollectedCompanyEnrichment> {
    const collected: OutreachCollectedCompanyEnrichment = {
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
      if (
        source.sourceId === 'wikidata' &&
        isDefined(collected.wikiCompany)
      ) {
        this.logger.log(
          `Skipping Wikidata enrich for ${input.domain}: companies index already returned a hit`,
        );
        continue;
      }

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

        collected.sourceIds.push(partial.sourceId as OutreachCompanyEnrichmentSourceId);

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
