import { type Logger } from '@nestjs/common';

import { type OrgChartIntentService } from 'src/domains/org-graph/org-chart/services/org-chart-intent.service';
import { type OrgchartLinkedInQueryRouterService } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-query-router.service';
import { mergeFilters } from 'src/domains/org-graph/org-chart/build/utils/org-chart-filters-merge.util';
import { buildTitleTaxonomyResolvedIntent } from 'src/domains/org-graph/org-chart/utils/title-taxonomy-resolved-intent.util';
import { type WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

// Shared business-division path: Nest intent LLM -> merge UI defaults ->
// title-taxonomy enrichment (function_root / role) AND'd onto division
// keywords. Used by the full build and the estimate probe, so both reach
// LinkedIn with the same combined query.
export const resolveBusinessDivisionLinkedInContext = async (
  deps: {
    logger: Logger;
    workspaceQueryService: Pick<
      WorkspaceQueryService,
      'getWorkspaceIdFromToken' | 'initializeLLMClients'
    >;
    orgChartIntentService: Pick<
      OrgChartIntentService,
      'resolveBusinessDivision'
    >;
    orgchartLinkedInQueryRouterService: Pick<
      OrgchartLinkedInQueryRouterService,
      'enrichBusinessDivisionLinkedinKeywords'
    >;
  },
  args: {
    apiToken: string;
    businessDivisionRaw: string;
    primaryCompanyName: string;
    rawCountryFromOptions: string;
    rawFunctionFromOptions: string;
    requirement: string;
    sendEvent?: (event: string, data: unknown) => void | boolean;
    onBeforeParse?: () => void | Promise<void>;
    enrichSendEvent?: (
      event: string,
      data: Record<string, unknown>,
    ) => boolean | void;
  },
): Promise<{
  country: string;
  functionRoot: string;
  businessDivisionLinkedinKeywords: string;
  businessDivisionEffective: {
    effectiveCountry?: string;
    effectiveFunctionRoot?: string;
  };
}> => {
  await args.onBeforeParse?.();

  const workspaceId = await deps.workspaceQueryService.getWorkspaceIdFromToken(
    args.apiToken,
  );
  const { openAIclient: openaiClient } =
    await deps.workspaceQueryService.initializeLLMClients(workspaceId);

  const parsed = await deps.orgChartIntentService.resolveBusinessDivision(
    openaiClient,
    {
      companyName: args.primaryCompanyName,
      userRawText: args.businessDivisionRaw,
      defaultCountry: args.rawCountryFromOptions,
      defaultFunctionRoot: args.rawFunctionFromOptions,
    },
    args.sendEvent,
  );

  const merged = mergeFilters(
    parsed,
    args.rawCountryFromOptions,
    args.rawFunctionFromOptions,
  );

  if (!merged.businessDivisionKeywords) {
    throw new Error(
      'Business division intent did not produce business_division_keywords',
    );
  }

  const country =
    merged.effectiveCountryRaw === '' ||
    merged.effectiveCountryRaw.toLowerCase() === 'global'
      ? ''
      : merged.effectiveCountryRaw;
  const functionRoot = merged.effectiveFunctionRoot;

  const titleTaxonomyResolvedIntent = buildTitleTaxonomyResolvedIntent({
    companyName: args.primaryCompanyName,
    parsed,
    effectiveFunctionRoot: merged.effectiveFunctionRoot,
  });

  const businessDivisionLinkedinKeywords =
    await deps.orgchartLinkedInQueryRouterService.enrichBusinessDivisionLinkedinKeywords(
      {
        businessDivisionRaw: args.businessDivisionRaw,
        primaryCompanyName: args.primaryCompanyName,
        baseBusinessDivisionKeywords: merged.businessDivisionKeywords,
        titleTaxonomyResolvedIntent,
        sendEvent: args.enrichSendEvent,
      },
    );

  deps.logger.log(
    `Business division LinkedIn keywords for "${args.primaryCompanyName}": ${businessDivisionLinkedinKeywords}`,
  );

  return {
    country,
    functionRoot,
    businessDivisionLinkedinKeywords,
    businessDivisionEffective: {
      effectiveCountry: country === '' ? 'global' : country,
      effectiveFunctionRoot: functionRoot || undefined,
    },
  };
};
