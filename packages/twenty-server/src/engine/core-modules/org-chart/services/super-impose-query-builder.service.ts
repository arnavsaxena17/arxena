import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { OrgChartIntentService } from 'src/engine/core-modules/candidate-search/services/org-chart-intent.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';
import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import type {
  SuperImposeHarvestQueryParams,
  SuperImposeQueryPlan,
  SuperImposeResolvedCompany,
} from 'src/engine/core-modules/org-chart/types/super-impose.types';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import { hasOrgChartLinkedInLeadershipOnlyFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';
import {
  resolveHarvestFunctionIdsForFunctionRoot,
  resolveHarvestLocationForCountry,
} from 'src/engine/core-modules/org-chart/utils/super-impose-harvest-scope.util';
import { resolveSuperImposeCompanySearchNames } from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import {
  andMergeBooleanSearchClauses,
  extractJobTitleClauseFromGeneratedSearchParameters,
  extractKeywordsClauseFromGeneratedSearchParameters,
  extractLinkedInSearchClauseFromGeneratedSearchParameters,
} from 'src/engine/core-modules/org-chart/utils/super-impose-keyword-merge.util';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { pickBlankGradeManualBooleanQueryItem } from 'src/engine/core-modules/candidate-search/utils/pick-blank-grade-manual-boolean-query-item.util';

export type BuildSuperImposeQueryPlanInput = {
  resolvedCompanies: SuperImposeResolvedCompany[];
  salesNavigatorSearchUrls: string[];
  linkedinSearchKeywords?: string;
  businessDivisionRawQuery?: string;
  country?: string;
  functionRoot?: string;
  leadershipOnly?: boolean;
  candidateSource: 'harvest' | 'unipile';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  primaryCompanyName: string;
  linkedinUnipileAccountId?: string;
  apiToken?: string;
  linkedinLocationId?: string;
  linkedinLocationName?: string;
  linkedinCompanyParameterId?: string;
};

type MergedSearchParts = {
  keywords?: string;
  jobTitle?: string;
};

@Injectable()
export class SuperImposeQueryBuilderService {
  private readonly logger = new Logger(SuperImposeQueryBuilderService.name);

  constructor(
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly orgChartIntentService: OrgChartIntentService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
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
      hasMeaningfulOrgChartFunctionRootFilter(input.functionRoot) ||
      hasOrgChartLinkedInLeadershipOnlyFilter(input.leadershipOnly);
    const mode = hasScopeFilter ? 'function_grade' : 'entire_company';

    const mergedParts = await this.buildMergedSearchParts({
      ...input,
      searchType,
    });
    // Harvest / legacy single-clause consumers still need one combined string.
    const mergedSearchClause = andMergeBooleanSearchClauses([
      mergedParts.jobTitle,
      mergedParts.keywords,
    ]);

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
      mergedJobTitle: mergedParts.jobTitle,
      mergedKeywords: mergedParts.keywords,
      companySearchNames,
      resolvedCompanies: input.resolvedCompanies,
      salesNavigatorSearchUrls,
      harvestBatches,
      useLinkedinSearchForCompanies,
      sessionId,
      country: effectiveCountry,
      functionRoot: input.functionRoot,
      leadershipOnly: input.leadershipOnly,
      linkedinLocationId,
      linkedinLocationName,
      linkedinCompanyParameterId,
      apiToken: input.apiToken,
      linkedinUnipileAccountId: input.linkedinUnipileAccountId,
    };
  }

  private async buildMergedSearchParts(input: {
    functionRoot?: string;
    leadershipOnly?: boolean;
    linkedinSearchKeywords?: string;
    businessDivisionRawQuery?: string;
    primaryCompanyName: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    apiToken?: string;
  }): Promise<MergedSearchParts> {
    let functionRootKeywords: string | undefined;
    let functionRootJobTitle: string | undefined;

    if (hasMeaningfulOrgChartFunctionRootFilter(input.functionRoot)) {
      const manualTerms = await this.lookupManualFunctionRootSearchTerms(
        input.functionRoot!.trim(),
        input.searchType,
      );
      if (manualTerms) {
        functionRootKeywords = manualTerms.keywords;
        functionRootJobTitle = manualTerms.jobTitle;
      } else {
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
          const jobTitleClause =
            extractJobTitleClauseFromGeneratedSearchParameters(generated);
          const keywordsClause =
            extractKeywordsClauseFromGeneratedSearchParameters(generated);
          const fallbackClause =
            extractLinkedInSearchClauseFromGeneratedSearchParameters(generated);

          if (input.searchType === 'sales_navigator') {
            functionRootJobTitle =
              jobTitleClause || keywordsClause || fallbackClause;
          } else {
            functionRootKeywords = keywordsClause || fallbackClause;
            functionRootJobTitle = jobTitleClause;
          }
        } catch (error) {
          this.logger.warn(
            `Super impose function-root keyword generation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    let leadershipClause: string | undefined;
    if (input.leadershipOnly) {
      try {
        const generated =
          await this.pythonQueryGenerationService.generateSearchParameters(
            {
              grades: [{ name: 'leadership', exclude: false }],
              company_names: input.primaryCompanyName
                ? [input.primaryCompanyName]
                : [],
            },
            input.searchType,
            `Leadership search for ${input.primaryCompanyName}`,
          );
        leadershipClause =
          extractLinkedInSearchClauseFromGeneratedSearchParameters(generated);
      } catch (error) {
        this.logger.warn(
          `Super impose leadership keyword generation failed: ${
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

    return {
      jobTitle: functionRootJobTitle,
      keywords: andMergeBooleanSearchClauses([
        functionRootKeywords,
        leadershipClause,
        businessDivisionClause,
        input.linkedinSearchKeywords?.trim(),
      ]),
    };
  }

  // Blank-grade CSV: boolean_query → Sales Nav role.include; keywords → keywords.
  private async lookupManualFunctionRootSearchTerms(
    functionRoot: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): Promise<{ keywords?: string; jobTitle?: string } | null> {
    try {
      const manualResult =
        await this.titleTaxonomyRemoteService.getManualBooleanQueries({
          kind: 'std_function_root',
          label: functionRoot,
          stdGrade: '',
        });
      const manualRow = pickBlankGradeManualBooleanQueryItem(
        manualResult?.items,
      );
      const booleanQuery = manualRow?.boolean_query?.trim() || undefined;
      const keywordsColumn = manualRow?.keywords?.trim() || undefined;
      if (!booleanQuery && !keywordsColumn) {
        return null;
      }

      if (searchType === 'sales_navigator') {
        const jobTitle = booleanQuery ?? keywordsColumn;
        const keywords =
          booleanQuery &&
          keywordsColumn &&
          keywordsColumn !== booleanQuery
            ? keywordsColumn
            : undefined;
        this.logger.log(
          `Super impose: manual boolean for functionRoot="${functionRoot}" jobTitle="${jobTitle ?? ''}" keywords="${keywords ?? ''}"`,
        );
        return {
          ...(keywords ? { keywords } : {}),
          ...(jobTitle ? { jobTitle } : {}),
        };
      }

      this.logger.log(
        `Super impose: manual boolean for functionRoot="${functionRoot}" searchType=${searchType} keywords="${keywordsColumn ?? ''}" jobTitle="${booleanQuery ?? ''}"`,
      );
      return {
        ...(keywordsColumn ? { keywords: keywordsColumn } : {}),
        ...(booleanQuery ? { jobTitle: booleanQuery } : {}),
      };
    } catch (error) {
      this.logger.warn(
        `Super impose: manual boolean lookup for functionRoot="${functionRoot}" failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
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
