import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { OrgChartIntentService } from 'src/engine/core-modules/candidate-search/services/org-chart-intent.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';
import type {
    SuperImposeHarvestQueryParams,
    SuperImposeQueryPlan,
    SuperImposeResolvedCompany,
} from 'src/engine/core-modules/org-chart/types/super-impose.types';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import {
    resolveHarvestFunctionIdsForFunctionRoot,
    resolveHarvestLocationForCountry,
} from 'src/engine/core-modules/org-chart/utils/super-impose-harvest-scope.util';
import { resolveSuperImposeCompanySearchNames } from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import {
    andMergeBooleanSearchClauses,
    wrapJobTitleAsOrClause,
} from 'src/engine/core-modules/org-chart/utils/super-impose-keyword-merge.util';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type BuildSuperImposeQueryPlanInput = {
  resolvedCompanies: SuperImposeResolvedCompany[];
  salesNavigatorSearchUrls: string[];
  linkedinSearchKeywords?: string;
  businessDivisionRawQuery?: string;
  country?: string;
  functionRoot?: string;
  candidateSource: 'harvest' | 'unipile';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  primaryCompanyName: string;
  linkedinUnipileAccountId?: string;
  apiToken?: string;
  linkedinLocationId?: string;
  linkedinLocationName?: string;
  linkedinCompanyParameterId?: string;
};

@Injectable()
export class SuperImposeQueryBuilderService {
  private readonly logger = new Logger(SuperImposeQueryBuilderService.name);

  constructor(
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly orgChartIntentService: OrgChartIntentService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async buildQueryPlan(
    input: BuildSuperImposeQueryPlanInput,
  ): Promise<SuperImposeQueryPlan> {
    const searchType = input.searchType ?? 'sales_navigator';
    const sessionId = randomUUID();
    const linkedinLocationId = input.linkedinLocationId?.trim() || undefined;
    const linkedinLocationName = input.linkedinLocationName?.trim() || undefined;
    const linkedinCompanyParameterId =
      input.linkedinCompanyParameterId?.trim() || undefined;
    const effectiveCountry =
      input.country?.trim() && input.country.trim().toLowerCase() !== 'global'
        ? input.country.trim()
        : linkedinLocationName;
    const hasScopeFilter =
      (effectiveCountry?.trim() &&
        effectiveCountry.trim().toLowerCase() !== 'global') ||
      !!linkedinLocationId ||
      hasMeaningfulOrgChartFunctionRootFilter(input.functionRoot);
    const mode = hasScopeFilter ? 'function_grade' : 'entire_company';

    const mergedSearchClause = await this.buildMergedSearchClause({
      ...input,
      searchType,
    });

    const companyUrls = input.resolvedCompanies.map((company) => company.linkedinUrl);
    const companySearchNames = resolveSuperImposeCompanySearchNames(
      input.resolvedCompanies,
    );
    const salesNavigatorSearchUrls = input.salesNavigatorSearchUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    const harvestBatches: SuperImposeHarvestQueryParams[] = [];
    const harvestFunctionIds = resolveHarvestFunctionIdsForFunctionRoot(
      input.functionRoot,
    );
    const harvestLocation = resolveHarvestLocationForCountry(effectiveCountry);
    const harvestGeoIds = linkedinLocationId;
    const userSearchClause =
      harvestFunctionIds && mergedSearchClause
        ? this.stripFunctionTermsFromClause(mergedSearchClause, input.functionRoot)
        : mergedSearchClause;

    for (const salesNavUrl of salesNavigatorSearchUrls) {
      harvestBatches.push({
        salesNavUrl,
        sessionId,
        page: 1,
      });
    }

    if (companyUrls.length > 0 && salesNavigatorSearchUrls.length === 0) {
      const batchSize = 50;
      for (let index = 0; index < companyUrls.length; index += batchSize) {
        const batch = companyUrls.slice(index, index + batchSize);
        harvestBatches.push({
          currentCompanies: batch.join(','),
          search: userSearchClause,
          locations: harvestLocation,
          geoIds: harvestGeoIds,
          functionIds: harvestFunctionIds,
          sessionId,
          page: 1,
        });
      }
    }

    const useLinkedinSearchForCompanies =
      companyUrls.length > 0 &&
      salesNavigatorSearchUrls.length === 0 &&
      (!!mergedSearchClause || hasScopeFilter) &&
      input.candidateSource === 'unipile';

    return {
      mode,
      candidateSource: input.candidateSource,
      searchType,
      mergedSearchClause,
      companySearchNames,
      resolvedCompanies: input.resolvedCompanies,
      salesNavigatorSearchUrls,
      harvestBatches,
      useLinkedinSearchForCompanies,
      sessionId,
      country: effectiveCountry,
      functionRoot: input.functionRoot,
      linkedinLocationId,
      linkedinLocationName,
      linkedinCompanyParameterId,
      apiToken: input.apiToken,
      linkedinUnipileAccountId: input.linkedinUnipileAccountId,
    };
  }

  private async buildMergedSearchClause(input: {
    functionRoot?: string;
    linkedinSearchKeywords?: string;
    businessDivisionRawQuery?: string;
    primaryCompanyName: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    apiToken?: string;
  }): Promise<string | undefined> {
    let functionRootClause: string | undefined;
    if (hasMeaningfulOrgChartFunctionRootFilter(input.functionRoot)) {
      try {
        const generated =
          await this.pythonQueryGenerationService.generateSearchParameters(
            {
              function_root: [
                { name: input.functionRoot!.trim(), exclude: false },
              ],
              company_names: input.primaryCompanyName
                ? [input.primaryCompanyName]
                : [],
            },
            input.searchType,
            `Function root search for ${input.primaryCompanyName}`,
          );
        const classicKeywords =
          generated.classicPeopleSearch?.keywords?.trim() ||
          undefined;
        const strategyKeywords =
          generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters
            ?.keywords;
        const salesNavKeywords =
          typeof strategyKeywords === 'string'
            ? strategyKeywords.trim()
            : undefined;
        const classicPeopleSearch = generated.classicPeopleSearch as
          | { job_title?: string }
          | undefined;
        const jobTitleClause = wrapJobTitleAsOrClause(
          classicPeopleSearch?.job_title ??
            generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters
              ?.role?.include?.[0] ??
            null,
        );
        functionRootClause =
          classicKeywords || salesNavKeywords || jobTitleClause;
      } catch (error) {
        this.logger.warn(
          `Super impose function-root keyword generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    let businessDivisionClause: string | undefined;
    if (input.businessDivisionRawQuery?.trim() && input.apiToken?.trim()) {
      try {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(
            input.apiToken.trim(),
          );
        const { openAIclient: openaiClient } =
          await this.workspaceQueryService.initializeLLMClients(workspaceId);
        const parsed = await this.orgChartIntentService.resolveBusinessDivision(
          openaiClient,
          {
            companyName: input.primaryCompanyName,
            userRawText: input.businessDivisionRawQuery.trim(),
            defaultCountry: '',
            defaultFunctionRoot: input.functionRoot ?? '',
          },
        );
        businessDivisionClause =
          parsed.business_division_keywords?.trim() || undefined;
      } catch (error) {
        this.logger.warn(
          `Super impose business division keyword resolution failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return andMergeBooleanSearchClauses([
      functionRootClause,
      businessDivisionClause,
      input.linkedinSearchKeywords?.trim(),
    ]);
  }

  private stripFunctionTermsFromClause(
    clause: string,
    functionRoot?: string,
  ): string | undefined {
    const trimmed = clause.trim();
    if (!trimmed || !hasMeaningfulOrgChartFunctionRootFilter(functionRoot)) {
      return trimmed || undefined;
    }

    const parts = trimmed.split(/\s+AND\s+/i);
    if (parts.length <= 1) {
      return undefined;
    }

    return parts.slice(1).join(' AND ').trim() || undefined;
  }
}
