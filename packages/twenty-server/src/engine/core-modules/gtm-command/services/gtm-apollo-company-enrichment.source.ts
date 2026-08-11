import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import type {
  GtmCompanyEnrichmentPartial,
  GtmCompanyEnrichmentSource,
  GtmCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/gtm-command/utils/gtm-company-enrichment-source.types';
import { pickFirstApolloOrganization } from 'src/engine/core-modules/gtm-command/utils/gtm-workspace-profile-draft.util';

@Injectable()
export class GtmApolloCompanyEnrichmentSource
  implements GtmCompanyEnrichmentSource
{
  readonly sourceId = 'apollo' as const;
  private readonly logger = new Logger(GtmApolloCompanyEnrichmentSource.name);

  constructor(
    @Optional()
    private readonly apolloIoRestService?: ApolloIoRestService,
  ) {}

  async enrich(
    input: GtmCompanyEnrichmentSourceInput,
  ): Promise<GtmCompanyEnrichmentPartial | null> {
    if (!isDefined(this.apolloIoRestService)) {
      return null;
    }

    try {
      const searchResult = await this.apolloIoRestService.organizationsSearch({
        q_organization_domains_list: [input.domain],
        per_page: 1,
        page: 1,
      });
      const apolloOrganization = pickFirstApolloOrganization(searchResult);

      if (!apolloOrganization) {
        return null;
      }

      return {
        sourceId: this.sourceId,
        apolloOrganization,
      };
    } catch (error) {
      this.logger.warn(
        `Apollo enrich failed for domain ${input.domain}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
