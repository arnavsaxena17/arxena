import { Injectable } from '@nestjs/common';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { mapBrightDataPersonToSearchItem } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-search.service';
import { matchesBrightDataCompanyName } from 'src/engine/core-modules/org-chart/utils/match-bright-data-company-name.util';

export type OrgChartBrightDataPeopleInput = {
  workspaceId: string;
  companyName: string;
  // e.g. "marketing leadership"
  roleQuery: string;
  mode?: 'ludicrous' | 'smart' | 'instant';
  limit?: number;
  maxBudgetUsd?: number;
};

export type OrgChartBrightDataPeopleResult = {
  mode: 'ludicrous' | 'smart' | 'instant';
  companyName: string;
  people: Array<Record<string, unknown>>;
  // Rows Bright Data returned for another company with a similar name
  rejectedByCompanyName: number;
  spentUsd: number;
};

@Injectable()
export class OrgChartBrightDataPeopleService {
  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
  ) {}

  async findPeopleAtCompany(
    input: OrgChartBrightDataPeopleInput,
  ): Promise<OrgChartBrightDataPeopleResult> {
    const mode = input.mode ?? 'ludicrous';
    const limit = Math.min(Math.max(1, input.limit ?? 25), 500);
    const request = `${input.roleQuery.trim()} at ${input.companyName.trim()}`;

    const documents =
      mode === 'ludicrous'
        ? (
            await this.brightDataLudicrousSearchService.searchNaturalLanguage({
              workspaceId: input.workspaceId,
              entity: 'people',
              rawQuery: request,
              maxBudgetUsd: input.maxBudgetUsd ?? 0.5,
              targetCount: limit,
            })
          ).result
        : await this.brightDataBusinessSearchService.search({
            entity: 'people',
            mode,
            query: request.slice(0, 200),
            limit,
          });

    const matched = documents.documents.filter((document) =>
      matchesBrightDataCompanyName(
        input.companyName,
        document.data.current_company_name,
      ),
    );

    return {
      mode,
      companyName: input.companyName,
      people: matched.map((document) =>
        mapBrightDataPersonToSearchItem(document),
      ),
      rejectedByCompanyName: documents.documents.length - matched.length,
      spentUsd:
        'spentUsd' in documents ? documents.spentUsd : documents.costUsd,
    };
  }
}
