import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import type {
  GtmCompanyEnrichmentPartial,
  GtmCompanyEnrichmentSource,
  GtmCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/gtm-command/utils/gtm-company-enrichment-source.types';
import { pickBestWikiCompanyHit } from 'src/engine/core-modules/gtm-command/utils/gtm-workspace-profile-draft.util';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';

// Companies ES index: free_company_dataset first, then std_company_data_scores
@Injectable()
export class GtmCompaniesIndexWikiEnrichmentSource
  implements GtmCompanyEnrichmentSource
{
  readonly sourceId = 'companies_index_wiki' as const;
  private readonly logger = new Logger(
    GtmCompaniesIndexWikiEnrichmentSource.name,
  );

  constructor(
    @Optional()
    private readonly companiesEsService?: CompaniesEsService,
  ) {}

  async enrich(
    input: GtmCompanyEnrichmentSourceInput,
  ): Promise<GtmCompanyEnrichmentPartial | null> {
    if (
      !isDefined(this.companiesEsService) ||
      !this.companiesEsService.isEnabled()
    ) {
      return null;
    }

    try {
      const result = await this.companiesEsService.searchCompanies({
        website: input.domain,
        limit: 5,
      });
      const wikiCompany = pickBestWikiCompanyHit(result.items, input.domain);

      if (!wikiCompany) {
        return null;
      }

      return {
        sourceId: this.sourceId,
        wikiCompany,
      };
    } catch (error) {
      this.logger.warn(
        `Companies index wiki lookup failed for domain ${input.domain}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
