import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import type {
  OutreachCompanyEnrichmentPartial,
  OutreachCompanyEnrichmentSource,
  OutreachCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/outreach-command/utils/outreach-company-enrichment-source.types';
import { pickBestWikiCompanyHit } from 'src/engine/core-modules/outreach-command/utils/outreach-workspace-profile-draft.util';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';

// Companies ES index: free_company_dataset first, then std_company_data_scores
@Injectable()
export class OutreachCompaniesIndexWikiEnrichmentSource
  implements OutreachCompanyEnrichmentSource
{
  readonly sourceId = 'companies_index_wiki' as const;
  private readonly logger = new Logger(
    OutreachCompaniesIndexWikiEnrichmentSource.name,
  );

  constructor(
    @Optional()
    private readonly companiesEsService?: CompaniesEsService,
  ) {}

  async enrich(
    input: OutreachCompanyEnrichmentSourceInput,
  ): Promise<OutreachCompanyEnrichmentPartial | null> {
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
