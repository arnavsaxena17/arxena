import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import {
  buildHarvestSearchQuery,
  compactHarvestSearchItem,
  HARVEST_COST_PER_RECORD_USD,
  type HarvestSearchKind,
} from 'src/engine/core-modules/org-chart/utils/harvest-search-params.util';
import {
  mapLinkedinQuerySetToHarvestParameters,
  type HarvestQuerySetCategory,
} from 'src/engine/core-modules/org-chart/utils/map-linkedin-query-set-to-harvest-parameters.util';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';

type HarvestSearchBody = {
  searchParameters?: Record<string, unknown>;
  page?: number;
  limit?: number;
};

// Harvest runs LinkedIn Sales Navigator lead and account searches on its own
// accounts, so no LinkedIn seat is needed. It bills per record returned.
@Controller('harvest-search')
@UseGuards(JwtAuthGuard, NoPermissionGuard)
export class HarvestSearchController {
  private readonly logger = new Logger(HarvestSearchController.name);

  constructor(private readonly harvestLinkedinService: HarvestLinkedinService) {}

  @Post('leads')
  async searchLeads(@Body() body: HarvestSearchBody) {
    return this.search('leads', body);
  }

  @Post('accounts')
  async searchAccounts(@Body() body: HarvestSearchBody) {
    return this.search('accounts', body);
  }

  // Generated query set (names) -> Harvest parameters. Titles and locations
  // stay text; employers become LinkedIn company URLs.
  @Post('query-set/parameters')
  async buildQuerySetParameters(
    @Body()
    body: {
      querySet: SearchQuerySet;
      category?: HarvestQuerySetCategory;
    },
  ) {
    this.assertConfigured();

    if (!Array.isArray(body?.querySet?.search_query_set)) {
      throw new HttpException(
        'querySet.search_query_set is required (the final_query_set from generate)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const category: HarvestQuerySetCategory =
      body.category === 'companies' ? 'companies' : 'people';
    const queries = mapLinkedinQuerySetToHarvestParameters({
      querySet: body.querySet,
      category,
    });

    const companyUrls = new Map<string, string | null>();
    for (const companyName of new Set(
      queries.flatMap((query) => query.companyNames),
    )) {
      try {
        const match =
          await this.harvestLinkedinService.findCompanyLinkedinUrl(companyName);
        companyUrls.set(companyName, match?.linkedinUrl ?? null);
      } catch (error) {
        this.logger.warn(
          `Harvest company lookup failed for "${companyName}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        companyUrls.set(companyName, null);
      }
    }

    return {
      provider: 'harvest',
      category,
      tool: category === 'companies' ? 'search_harvest_accounts' : 'search_harvest_leads',
      queries: queries.map(({ companyNames, ...query }) => {
        const resolved = companyNames.flatMap(
          (name) => companyUrls.get(name) ?? [],
        );
        const unresolvedCompanies = companyNames.filter(
          (name) => !companyUrls.get(name),
        );

        return {
          ...query,
          searchParameters: {
            ...query.searchParameters,
            ...(resolved.length > 0 ? { currentCompanies: resolved } : {}),
          },
          ...(unresolvedCompanies.length > 0 ? { unresolvedCompanies } : {}),
        };
      }),
    };
  }

  private async search(kind: HarvestSearchKind, body: HarvestSearchBody) {
    this.assertConfigured();

    const { query, ignored } = buildHarvestSearchQuery(
      kind,
      body?.searchParameters,
    );

    // An empty filter set would page through LinkedIn at our cost
    if (Object.keys(query).length === 0) {
      throw new HttpException(
        `searchParameters has no Harvest ${kind === 'leads' ? 'lead' : 'account'} filter${
          ignored.length > 0 ? ` (ignored: ${ignored.join(', ')})` : ''
        }`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result =
        await this.harvestLinkedinService.searchSalesNavigatorCollection({
          kind,
          query,
          page: body.page,
          limit: body.limit,
        });
      const costUsd =
        Math.round(result.items.length * HARVEST_COST_PER_RECORD_USD * 1000) /
        1000;

      return {
        items: result.items.map((item) => compactHarvestSearchItem(kind, item)),
        records: result.items.length,
        costUsd,
        paging: {
          firstPage: result.firstPage,
          lastPage: result.lastPage,
          nextPage: result.nextPage,
          totalElements: result.totalElements,
          totalPages: result.totalPages,
        },
        ...(ignored.length > 0 ? { ignoredParameters: ignored } : {}),
      };
    } catch (error) {
      this.logger.error(`Harvest ${kind} search failed`, error);
      throw new HttpException(
        error instanceof Error ? error.message : `Harvest ${kind} search failed`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private assertConfigured(): void {
    if (!this.harvestLinkedinService.isConfigured()) {
      throw new HttpException(
        'Harvest is not configured (HARVEST_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
