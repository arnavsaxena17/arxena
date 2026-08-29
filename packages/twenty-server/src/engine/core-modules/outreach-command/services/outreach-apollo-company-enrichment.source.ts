import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import type {
  OutreachCompanyEnrichmentPartial,
  OutreachCompanyEnrichmentSource,
  OutreachCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/outreach-command/utils/outreach-company-enrichment-source.types';
import { pickFirstApolloOrganization } from 'src/engine/core-modules/outreach-command/utils/outreach-workspace-profile-draft.util';

@Injectable()
export class OutreachApolloCompanyEnrichmentSource
  implements OutreachCompanyEnrichmentSource
{
  readonly sourceId = 'apollo' as const;
  private readonly logger = new Logger(OutreachApolloCompanyEnrichmentSource.name);

  constructor(
    @Optional()
    private readonly apolloIoRestService?: ApolloIoRestService,
  ) {}

  async enrich(
    input: OutreachCompanyEnrichmentSourceInput,
  ): Promise<OutreachCompanyEnrichmentPartial | null> {
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
