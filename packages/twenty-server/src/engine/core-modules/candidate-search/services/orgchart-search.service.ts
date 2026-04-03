import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { TransformedCandidateForTable } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import { OrgChartCacheService } from 'src/engine/core-modules/org-chart/services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from 'src/engine/core-modules/org-chart/services/orgchart-cancel-registry.service';
import { PythonOrgChartService } from 'src/engine/core-modules/org-chart/services/python-org-chart.service';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import {
  normalizeCountry,
  normalizeFunctionRoot,
} from 'src/engine/core-modules/org-chart/utils/orgchart-normalization.util';
import { OrgChartData } from 'twenty-shared';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  ClassicPeopleSearchStrategyResult,
  ParsedJobDescription,
} from '../types/candidate-search-request.type';
import { mergeBusinessDivisionFilters } from '../utils/business-division-merge.util';
import type { PeopleSearchStrategyResult } from '../utils/extract-strategies.util';
import { extractStrategiesFromGeneratedParams } from '../utils/extract-strategies.util';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../utils/linkedin-query-generation-mapper.util';
import { createMinimalParsedJobDescription } from '../utils/parsed-job-description.util';
import { constructSearchParamKey } from '../utils/search-parameter.utils';
import { BusinessDivisionOrgChartParserService } from './business-division-org-chart-parser.service';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import type { PythonQueryInput } from './python-query-generation.service';
import { PythonQueryGenerationService } from './python-query-generation.service';
import { RequirementAnalyzerService } from './requirement-analyzer.service';
import { SearchExecutionService } from './search-execution.service';

type OrgChartCandidateInput = TransformedCandidateForTable | Record<string, unknown>;

type StandardizedOrgChartPerson = {
  full_name: string;
  job_title: string;
  job_company_linkedin_url: string;
  job_company_id: string;
  job_company_name: string;
  industry: string;
  country: string;
  job_company_website: string;
  linkedin_url: string;
  facebook_url: string;
  twitter_url: string;
  gender: string;
  location_country: string;
  location_region: string;
  location_locality: string;
  location_metro: string;
  location_name: string;
  inferred_salary: string;
  inferred_years_experience: string;
  emails: string;
  phone_numbers: string;
  profile_picture_url: string;
  id: string;
};

type SearchExecutionResult = {
  itemCount: number;
  searchResults: unknown;
  transformedCandidates?: unknown[];
  searchMetadata?: unknown;
  validationResults?: unknown[];
  overallValidation?: unknown;
  error?: { message: string; code?: string; details?: string };
};

@Injectable()
export class OrgChartSearchService {
  private readonly logger = new Logger(OrgChartSearchService.name);

  constructor(
    private readonly searchExecutionService: SearchExecutionService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly requirementAnalyzerService: RequirementAnalyzerService,
    private readonly pythonOrgChartService: PythonOrgChartService,
    private readonly orgchartCancelRegistry: OrgchartCancelRegistryService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly orgChartCacheService: OrgChartCacheService,
    private readonly businessDivisionOrgChartParserService: BusinessDivisionOrgChartParserService,
  ) {}

  /**
   * Lightweight helper for org-chart integrations:
   * Given a natural-language requirement (built from company + mode),
   * execute a LinkedIn people search and return transformed candidates.
   */
  async runOrgchartLinkedInSearch(
    rawQuery: string,
    cleanedQuery: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    apiToken: string,
    sendEvent?: (event: string, data: unknown) => void,
    options?: {
      mode?: string;
      companyName?: string;
      companyId?: string;
      requestId?: string;
      jobTitles?: string[];
      country?: string;
      functionRoot?: string;
      /** Canonical LinkedIn company URL for Python org-chart (e.g. https://www.linkedin.com/company/briskpe/) */
      linkedinCompanyUrl?: string;
      /** Unipile LinkedIn account id (same as linkedin-search ?account_id); after UNIPILE_LINKEDIN_ACCOUNT_ID env */
      linkedinUnipileAccountId?: string;
      /** Natural-language business division query; triggers structured LLM + keyword strategy */
      businessDivisionRawQuery?: string;
    },
  ): Promise<{
    items: unknown[];
    itemCount: number;
    isCached?: boolean;
    cacheSource?: 'none' | 'function_grade';
    orgChart?: OrgChartData;
    functionGradeCacheMeta?: {
      strategyCap: number;
      keywordsHash: string;
      functionRoot: string;
      country: string;
    };
    /** Merged filters after business-division LLM (for org-chart build) */
    effectiveCountry?: string;
    effectiveFunctionRoot?: string;
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>;
  }> {
    const searchCategory: 'people' = 'people';
    const searchParamKey = constructSearchParamKey(searchType, searchCategory);
    const parameterKey = searchParamKey;

    const requirement = cleanedQuery || rawQuery;

    const mode = options?.mode;
    const primaryCompanyName = options?.companyName?.trim() || '';
    const primaryCompanyId = options?.companyId?.trim() || '';
    const requestId = options?.requestId;
    const rawCountryFromOptions = options?.country?.trim() || '';
    const rawFunctionFromOptions = options?.functionRoot?.trim() || '';
    let country =
      rawCountryFromOptions.toLowerCase() === 'global'
        ? ''
        : rawCountryFromOptions;
    let functionRoot = rawFunctionFromOptions;

    const businessDivisionRaw = options?.businessDivisionRawQuery?.trim();
    if (businessDivisionRaw && !primaryCompanyName) {
      throw new Error(
        'businessDivisionRawQuery requires companyName on the org chart request',
      );
    }

    let workspaceMemberId: string | undefined;
    try {
      const authContext =
        await this.workspaceQueryService.accessTokenService.validateToken(
          apiToken,
        );
      workspaceMemberId = authContext.workspaceMemberId;
    } catch {
      this.logger.warn(
        'Unable to resolve workspace member id for orgchart progress events',
      );
    }

    const emitProgress = (
      event: string,
      data: Record<string, unknown>,
    ): boolean | void => {
      if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
        return false;
      }
      sendEvent?.(event, data);

      if (!workspaceMemberId) {
        return;
      }

      this.workspaceQueryService.webSocketService.sendToUser(
        workspaceMemberId,
        'orgchart-search-progress',
        {
          event,
          requestId,
          mode,
          searchType,
          companyName: primaryCompanyName,
          data,
        },
      );
    };

    emitProgress('status', {
      message: `Starting org chart search for ${primaryCompanyName || 'company'}...`,
    });

    let businessDivisionEffective:
      | { effectiveCountry?: string; effectiveFunctionRoot?: string }
      | undefined;
    let businessDivisionLinkedinKeywords: string | undefined;

    if (businessDivisionRaw && primaryCompanyName) {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      emitProgress('status', {
        message: 'Parsing business division query...',
      });

      const parsed =
        await this.businessDivisionOrgChartParserService.parseBusinessDivisionQuery(
          openaiClient,
          {
            companyName: primaryCompanyName,
            userRawText: businessDivisionRaw,
            defaultCountry: rawCountryFromOptions,
            defaultFunctionRoot: rawFunctionFromOptions,
          },
          sendEvent,
        );

      const merged = mergeBusinessDivisionFilters(
        parsed,
        rawCountryFromOptions,
        rawFunctionFromOptions,
      );

      if (!merged.linkedinKeywords) {
        throw new Error(
          'Business division parser did not produce linkedin_keywords',
        );
      }

      country =
        merged.effectiveCountryRaw === '' ||
        merged.effectiveCountryRaw.toLowerCase() === 'global'
          ? ''
          : merged.effectiveCountryRaw;
      functionRoot = merged.effectiveFunctionRoot;

      businessDivisionEffective = {
        effectiveCountry: country === '' ? 'global' : country,
        effectiveFunctionRoot: functionRoot || undefined,
      };
      businessDivisionLinkedinKeywords = merged.linkedinKeywords;
    }

    const hasAdditionalFilters =
      !!country || hasMeaningfulOrgChartFunctionRootFilter(functionRoot);

    const isAllPeopleInCompanyMode =
      searchType === 'classic' &&
      !!primaryCompanyName &&
      (mode === 'entire_company' || mode === 'all_people') &&
      !hasAdditionalFilters &&
      !businessDivisionRaw;

    if (
      mode === 'function_grade' &&
      searchType === 'classic' &&
      !!primaryCompanyName
    ) {
      const cachedCandidateList =
        await this.orgChartCacheService.getCachedCompanyCandidateList({
          companyName: primaryCompanyName,
          companyId: primaryCompanyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedCandidateList?.items && Array.isArray(cachedCandidateList.items)) {
        const filteredItems =
          this.filterOrgChartCandidatesByCountryAndFunctionRoot(
            cachedCandidateList.items,
            country,
            functionRoot,
          );

        this.logger.log(
          `OrgchartLinkedInSearch: reusing full-company candidate list cache for function-grade search (company="${primaryCompanyName}", functionRoot="${functionRoot}", country="${rawCountryFromOptions || 'global'}") with ${filteredItems.length} candidates after filters.`,
        );

        emitProgress('complete', {
          message: `Loaded cached org chart people search with ${filteredItems.length} candidates (from full-company cache).`,
          itemCount: filteredItems.length,
          strategyCount: 0,
          isCached: true,
        });

        return {
          items: filteredItems,
          itemCount: filteredItems.length,
          isCached: true,
          cacheSource: 'function_grade',
          orgChart: undefined,
          functionGradeCacheMeta: undefined,
          strategyResults: [],
        };
      }
    }

    let strategies: PeopleSearchStrategyResult[];
    let parsedJobDescription: ParsedJobDescription;

    if (businessDivisionLinkedinKeywords && primaryCompanyName) {
      this.logger.log(
        `OrgchartLinkedInSearch: business division keyword strategy for "${primaryCompanyName}".`,
      );

      const locationForStrategy =
        country && country.length > 0 ? [country] : undefined;

      const divisionStrategy = this.createBusinessDivisionStrategy(
        primaryCompanyName,
        businessDivisionLinkedinKeywords,
        requirement,
        locationForStrategy,
      );

      try {
        const accountId =
          await this.candidateSearchBaseService.getLinkedInAccountId(
            apiToken,
            options?.linkedinUnipileAccountId,
          );
        const resolvedParams =
          await this.linkedinParameterResolver.resolveParameterIds(
            divisionStrategy.parameters,
            accountId,
            divisionStrategy.id,
          );
        divisionStrategy.parameters = resolvedParams;
      } catch (error) {
        this.logger.error(
          `[Strategy: ${divisionStrategy.id}] Failed to parameterize business division orgchart search`,
          error as Error,
        );
      }

      strategies = [divisionStrategy];
      parsedJobDescription = createMinimalParsedJobDescription({
        jobTitle: `Business division at ${primaryCompanyName}`,
        company: primaryCompanyName,
      });
    } else if (isAllPeopleInCompanyMode) {
      this.logger.log(
        `OrgchartLinkedInSearch: using direct company filter strategy for "${primaryCompanyName}" (mode=${mode}) without multi-agent flow.`,
      );

      const simpleStrategy = this.createSimpleCompanyStrategy(
        primaryCompanyName,
        requirement,
      );

      try {
        const accountId =
          await this.candidateSearchBaseService.getLinkedInAccountId(
            apiToken,
            options?.linkedinUnipileAccountId,
          );
        const resolvedParams =
          await this.linkedinParameterResolver.resolveParameterIds(
            simpleStrategy.parameters,
            accountId,
            simpleStrategy.id,
          );
        simpleStrategy.parameters = resolvedParams;
      } catch (error) {
        this.logger.error(
          `[Strategy: ${simpleStrategy.id}] Failed to parameterize company name for orgchart search, continuing with raw company value "${primaryCompanyName}"`,
          error as Error,
        );
      }

      strategies = [simpleStrategy];
      parsedJobDescription = createMinimalParsedJobDescription({
        jobTitle: primaryCompanyName
          ? `Employee at ${primaryCompanyName}`
          : 'Employee',
        company: primaryCompanyName,
      });
    } else {
      let parsedRequirement: {
        primary_role_name?: string | null;
        location?: string | null;
        industry?: string | null;
      } | undefined;
      const usePythonQueryGenerator =
        process.env.USE_PYTHON_QUERY_GENERATOR_FOR_ORGCHART === 'true' ||
        process.env.USE_PYTHON_QUERY_GENERATOR_FOR_ORGCHART === '1';

      if (usePythonQueryGenerator) {
        emitProgress('status', {
          message: 'Generating LinkedIn search via Python query generator...',
        });
        const pythonInput: PythonQueryInput = {
          company_names: primaryCompanyName ? [primaryCompanyName] : [],
        };

        if (functionRoot) {
          pythonInput.function_root = [
            { name: functionRoot, exclude: false },
          ];
        }

        if (mode === 'leadership') {
          pythonInput.grades = [{ name: 'leadership', exclude: false }];
        } else if (mode === 'function_grade' && options?.jobTitles?.length) {
          pythonInput.raw_job_titles = options.jobTitles;
        }

        const unresolved =
          await this.pythonQueryGenerationService.generateSearchParameters(
            pythonInput,
            searchType,
            requirement,
          );
        strategies = extractStrategiesFromGeneratedParams(
          unresolved,
          searchType,
          searchCategory,
        );
      } else {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        const { openAIclient: openaiClient } =
          await this.workspaceQueryService.initializeLLMClients(workspaceId);

        emitProgress('status', {
          message: 'Analyzing org-chart requirement...',
        });
        parsedRequirement =
          await this.requirementAnalyzerService.analyzeRequirement(
            rawQuery,
            cleanedQuery,
            openaiClient,
            () => {},
            sendEvent,
          );

        emitProgress('status', {
          message: 'Generating LinkedIn search strategies...',
        });
        const orchestratorResult =
          await this.linkedinQueryGenerationService.generateSearchQuerySet(
            cleanedQuery,
            {
              verbose: process.env.LINKEDIN_QUERY_GENERATION_VERBOSE === 'true',
              sendEvent,
            },
          );
        const unresolved = mapLinkedinSearchQueriesToGeneratedParameters(
          orchestratorResult.final_query_set,
          searchType,
          requirement,
        );
        strategies = extractStrategiesFromGeneratedParams(
          unresolved,
          searchType,
          searchCategory,
        );
      }

      const parsedReq = parsedRequirement;
      parsedJobDescription = createMinimalParsedJobDescription({
        jobTitle:
          (parsedReq?.primary_role_name && parsedReq.primary_role_name.trim()) ||
          (primaryCompanyName ? `Role at ${primaryCompanyName}` : 'Employee'),
        company: primaryCompanyName,
        location: parsedReq?.location ?? '',
        industry: parsedReq?.industry ?? '',
      });
    }

    this.logStrategies(strategies);

    const strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }> = [];

    const configuredMaxStrategiesRaw = process.env.ORGCHART_MAX_STRATEGIES;
    const configuredMaxStrategiesParsed =
      configuredMaxStrategiesRaw !== undefined
        ? Number.parseInt(configuredMaxStrategiesRaw, 10)
        : NaN;
    const maxStrategiesToRun =
      Number.isFinite(configuredMaxStrategiesParsed) &&
      configuredMaxStrategiesParsed > 0
        ? configuredMaxStrategiesParsed
        : 1;
    const strategiesToRun =
      strategies.length > 0 ? strategies.slice(0, maxStrategiesToRun) : [];

    this.logger.log(
      `OrgchartLinkedInSearch: strategy execution cap=${maxStrategiesToRun}, extracted=${strategies.length}, executing=${strategiesToRun.length}`,
    );

    const isFunctionGradeMode = mode === 'function_grade';
    const normalizedFunctionRoot = normalizeFunctionRoot(functionRoot);
    const normalizedCountry = normalizeCountry(country);
    const keywordsHash = this.buildFunctionGradeKeywordsHash(strategiesToRun);

    if (isFunctionGradeMode && primaryCompanyName && normalizedFunctionRoot) {
      const cachedFunctionGrade =
        await this.orgChartCacheService.getCachedFunctionGradeSearch({
          companyName: primaryCompanyName,
          companyId: primaryCompanyId,
          functionRoot: normalizedFunctionRoot,
          country: normalizedCountry,
          searchType,
          strategyCap: maxStrategiesToRun,
          keywordsHash,
        });

      if (cachedFunctionGrade) {
        this.logger.log(
          `OrgchartLinkedInSearch: function-grade cache HIT for company="${primaryCompanyName}", functionRoot="${normalizedFunctionRoot}", country="${normalizedCountry}", strategyCap=${maxStrategiesToRun}`,
        );
        emitProgress('complete', {
          message: `Loaded cached org chart people search with ${cachedFunctionGrade.itemCount} candidates.`,
          itemCount: cachedFunctionGrade.itemCount,
          strategyCount: strategiesToRun.length,
          isCached: true,
        });
        return {
          items: cachedFunctionGrade.items,
          itemCount: cachedFunctionGrade.itemCount,
          isCached: true,
          cacheSource: 'function_grade',
          orgChart: cachedFunctionGrade.orgChart,
          functionGradeCacheMeta: {
            strategyCap: maxStrategiesToRun,
            keywordsHash,
            functionRoot: normalizedFunctionRoot,
            country: normalizedCountry,
          },
          strategyResults: strategiesToRun.map((s) => ({
            strategy: s,
            result: null,
          })),
        };
      }
    }

    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      this.logger.log(
        `Orgchart search aborted by user before execution. requestId=${requestId}`,
      );
      return {
        items: [],
        itemCount: 0,
        strategyResults: strategiesToRun.map((s) => ({
          strategy: s,
          result: null,
        })),
      };
    }

    for (const strategy of strategiesToRun) {
      const preview =
        await this.searchExecutionService.executeMultiPageSearchWithoutValidation(
          parsedJobDescription,
          strategy,
          searchType,
          searchCategory,
          parameterKey,
          apiToken,
          undefined,
          emitProgress,
          {
            forceClassicPeopleJson: true,
            linkedInAccountId: options?.linkedinUnipileAccountId,
          },
        );
      strategyResults.push({
        strategy,
        result: preview as SearchExecutionResult | null,
      });
    }

    const allCandidates = strategyResults.flatMap(
      (sr) => sr.result?.transformedCandidates || [],
    );

    const candidatesOut =
      businessDivisionRaw && primaryCompanyName
        ? this.filterOrgChartCandidatesByCountryAndFunctionRoot(
            allCandidates,
            country,
            functionRoot,
          )
        : allCandidates;

    this.logger.log(
      `OrgchartLinkedInSearch: collected ${candidatesOut.length} transformed candidates from ${strategyResults.length} strategy/strategies.`,
    );

    emitProgress('complete', {
      message: `Completed org chart people search with ${candidatesOut.length} candidates.`,
      itemCount: candidatesOut.length,
      strategyCount: strategyResults.length,
    });

    if (
      isFunctionGradeMode &&
      primaryCompanyName &&
      normalizedFunctionRoot &&
      candidatesOut.length > 0
    ) {
      await this.orgChartCacheService.setCachedFunctionGradeSearch({
        companyName: primaryCompanyName,
        companyId: primaryCompanyId,
        functionRoot: normalizedFunctionRoot,
        country: normalizedCountry,
        searchType,
        strategyCap: maxStrategiesToRun,
        keywordsHash,
        items: candidatesOut,
        itemCount: candidatesOut.length,
      });
    }

    return {
      items: candidatesOut,
      itemCount: candidatesOut.length,
      isCached: false,
      cacheSource: 'none',
      functionGradeCacheMeta:
        isFunctionGradeMode && normalizedFunctionRoot
          ? {
              strategyCap: maxStrategiesToRun,
              keywordsHash,
              functionRoot: normalizedFunctionRoot,
              country: normalizedCountry,
            }
          : undefined,
      ...(businessDivisionEffective
        ? {
            effectiveCountry: businessDivisionEffective.effectiveCountry,
            effectiveFunctionRoot:
              businessDivisionEffective.effectiveFunctionRoot,
          }
        : {}),
      strategyResults,
    };
  }

  async buildOrgChartFromLinkedInCompanyCandidates(
    candidates: OrgChartCandidateInput[],
    options: {
      companyName: string;
      companyId?: string;
      mode?: string;
      function?: string;
      /** When set, used as job_company_linkedin_url for the Python service (overrides /company/{companyId}) */
      companyLinkedinUrl?: string;
    },
  ): Promise<OrgChartData> {
    const { companyName, companyId, mode, function: fn } = options;
    const normalizedCompanyName = (companyName ?? '').trim();
    const normalizedCompanyId =
      (companyId ?? '').trim() ||
      (normalizedCompanyName
        ? normalizedCompanyName.replace(/\s+/g, '').toLowerCase()
        : '');

    const trimmedCanonical = options.companyLinkedinUrl?.trim();
    const companyLinkedinUrl =
      trimmedCanonical && trimmedCanonical.length > 0
        ? trimmedCanonical.replace(/\/+$/, '')
        : normalizedCompanyId !== ''
          ? `https://www.linkedin.com/company/${normalizedCompanyId}`
          : '';

    const people: StandardizedOrgChartPerson[] = candidates.map(
      (candidate, index) => {
        const raw = candidate as Record<string, unknown>;

        const fullName =
          (typeof (raw as { fullName?: unknown }).fullName === 'string' &&
            (raw as { fullName: string }).fullName) ||
          (typeof (raw as { name?: unknown }).name === 'string' &&
            (raw as { name: string }).name) ||
          '';

        const rawJob =
          typeof (raw as { jobTitle?: unknown }).jobTitle === 'string'
            ? (raw as { jobTitle: string }).jobTitle?.trim()
            : '';
        const rawHeadline =
          typeof (raw as { headline?: unknown }).headline === 'string'
            ? (raw as { headline: string }).headline?.trim()
            : '';
        const rawJobTitleSnake =
          typeof (raw as { job_title?: unknown }).job_title === 'string'
            ? (raw as { job_title: string }).job_title?.trim()
            : '';
        const rawLinkedInHeadline =
          typeof (raw as { linkedin_headline?: unknown }).linkedin_headline ===
          'string'
            ? (raw as { linkedin_headline: string }).linkedin_headline?.trim()
            : '';
        const jobTitleStr =
          (rawJob && rawJob !== 'N/A' ? rawJob : '') ||
          rawHeadline ||
          rawJobTitleSnake ||
          rawLinkedInHeadline ||
          '';
        const jobTitle = typeof jobTitleStr === 'string' ? jobTitleStr : '';

        const jobCompanyName =
          (typeof (raw as { jobCompanyName?: unknown }).jobCompanyName ===
            'string' &&
            (raw as { jobCompanyName: string }).jobCompanyName) ||
          (typeof (raw as { company?: unknown }).company === 'string' &&
            (raw as { company: string }).company) ||
          normalizedCompanyName;

        const locationName =
          (typeof (raw as { locationName?: unknown }).locationName ===
            'string' &&
            (raw as { locationName: string }).locationName) ||
          (typeof (raw as { location?: unknown }).location === 'string' &&
            (raw as { location: string }).location) ||
          '';

        const industry =
          (typeof (raw as { industry?: unknown }).industry === 'string' &&
            (raw as { industry: string }).industry) ||
          '';

        const linkedinUrl =
          (typeof (raw as { linkedinUrl?: unknown }).linkedinUrl === 'string' &&
            (raw as { linkedinUrl: string }).linkedinUrl) ||
          (typeof (raw as { profileUrl?: unknown }).profileUrl === 'string' &&
            (raw as { profileUrl: string }).profileUrl) ||
          '';

        const locationCountry =
          (typeof (raw as { locationCountry?: unknown }).locationCountry ===
            'string' &&
            (raw as { locationCountry: string }).locationCountry) ||
          '';

        const locationRegion =
          (typeof (raw as { locationRegion?: unknown }).locationRegion ===
            'string' &&
            (raw as { locationRegion: string }).locationRegion) ||
          '';

        const locationLocality =
          (typeof (raw as { locationLocality?: unknown }).locationLocality ===
            'string' &&
            (raw as { locationLocality: string }).locationLocality) ||
          '';

        const idValue =
          (typeof (raw as { peopleId?: unknown }).peopleId === 'string' &&
            (raw as { peopleId: string }).peopleId) ||
          (typeof (raw as { id?: unknown }).id === 'string' &&
            (raw as { id: string }).id) ||
          (linkedinUrl !== '' ? linkedinUrl : '') ||
          `${fullName || 'candidate'}-${jobCompanyName || 'company'}-${index}`;

        const profilePictureUrl =
          (typeof (raw as { profile_picture_url?: unknown })
            .profile_picture_url === 'string' &&
            (raw as { profile_picture_url: string }).profile_picture_url) ||
          (typeof (raw as { profile_picture_url_large?: unknown })
            .profile_picture_url_large === 'string' &&
            (raw as { profile_picture_url_large: string })
              .profile_picture_url_large) ||
          (typeof (raw as { profilePictureUrl?: unknown }).profilePictureUrl ===
            'string' &&
            (raw as { profilePictureUrl: string }).profilePictureUrl) ||
          (typeof (raw as { displayPicture?: unknown }).displayPicture ===
            'string' &&
            (raw as { displayPicture: string }).displayPicture) ||
          '';

        return {
          full_name: fullName,
          job_title: jobTitle,
          job_company_linkedin_url: companyLinkedinUrl,
          job_company_id: normalizedCompanyId || jobCompanyName || '',
          job_company_name: jobCompanyName,
          industry,
          country: locationCountry || 'global',
          job_company_website: '',
          linkedin_url: linkedinUrl,
          facebook_url: '',
          twitter_url: '',
          gender: '',
          location_country: locationCountry,
          location_region: locationRegion,
          location_locality: locationLocality,
          location_metro: '',
          location_name: locationName,
          inferred_salary: '',
          inferred_years_experience: '',
          emails: '',
          phone_numbers: '',
          profile_picture_url: profilePictureUrl,
          id: idValue,
        };
      },
    );

    this.logger.log(
      `OrgchartLinkedInSearch: building org chart from ${people.length} candidates for company="${normalizedCompanyName}"`,
    );

    const jobNameSuffix = fn
      ? fn.replace(/\s+/g, '-').toLowerCase()
      : mode === 'leadership'
        ? 'leadership'
        : mode === 'entire_company' || mode === 'all_people'
          ? 'entire'
          : mode ?? 'chart';
    const jobName = `orgchart-${normalizedCompanyName.replace(/\s+/g, '-')}-${jobNameSuffix}`;

    const yugaNormalizedId = normalizedCompanyId.replace(/-/g, '_').toLowerCase();
    const isYugaLabsCompany =
      yugaNormalizedId === 'yuga_labs' ||
      normalizedCompanyName.toLowerCase().trim() === 'yuga labs';

    try {
      return await this.pythonOrgChartService.createOrgChartFromStandardizedPeople(
        {
          people,
          jobName,
          jobId: normalizedCompanyId || undefined,
          functionRoot: fn,
        },
      );
    } catch (error) {
      if (!isYugaLabsCompany) {
        throw error;
      }
      const staticChart =
        await this.pythonOrgChartService.loadYugaLabsStaticAssistOrNull();
      if (!staticChart) {
        throw error;
      }
      this.logger.warn(
        `Yuga Labs org chart build failed; using static yuga_labs_all_org_chart_assist.json. ${error instanceof Error ? error.message : String(error)}`,
      );
      return staticChart;
    }
  }

  private createSimpleCompanyStrategy(
    companyName: string,
    requirement: string,
  ): ClassicPeopleSearchStrategyResult {
    return {
      id: `orgchart-company-${companyName}`,
      label: `All employees from ${companyName}`,
      description: `Org-chart helper strategy to fetch all employees from ${companyName} using a simple company filter.`,
      strategyText: `All employees from ${companyName}`,
      originalUserQuery: requirement,
      clarificationQuestions: null,
      clarificationAnswers: null,
      parameters: {
        company: [companyName],
      },
    };
  }

  private createBusinessDivisionStrategy(
    companyName: string,
    keywords: string,
    requirement: string,
    location?: string[],
  ): ClassicPeopleSearchStrategyResult {
    const safeId = companyName.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);

    return {
      id: `orgchart-business-division-${safeId}`,
      label: `Business division at ${companyName}`,
      description: `Org-chart business division mapping using keyword filter at ${companyName}.`,
      strategyText: keywords,
      originalUserQuery: requirement,
      clarificationQuestions: null,
      clarificationAnswers: null,
      parameters: {
        company: [companyName],
        keywords,
        ...(location?.length ? { location } : {}),
      },
    };
  }

  private filterOrgChartCandidatesByCountryAndFunctionRoot(
    items: unknown[],
    countryRaw?: string,
    functionRootRaw?: string,
  ): unknown[] {
    const normalizedCountryRaw =
      typeof countryRaw === 'string' ? countryRaw.trim() : '';
    const hasCountryFilter =
      normalizedCountryRaw.length > 0 &&
      normalizedCountryRaw.toLowerCase() !== 'global';

    const normalizedFunctionRootRaw =
      typeof functionRootRaw === 'string' ? functionRootRaw.trim() : '';
    const hasFunctionRootFilter =
      hasMeaningfulOrgChartFunctionRootFilter(normalizedFunctionRootRaw);

    if (!hasCountryFilter && !hasFunctionRootFilter) {
      return items;
    }

    return items.filter((item) => {
      const raw = item as Record<string, unknown>;

      if (hasCountryFilter) {
        const filterCountry = normalizedCountryRaw.toLowerCase();
        const possibleCountryValues = [
          (raw as { locationCountry?: unknown }).locationCountry,
          (raw as { location_country?: unknown }).location_country,
          raw.country,
        ].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );

        const normalizedCountry =
          possibleCountryValues[0]?.trim().toLowerCase() ?? '';

        if (!normalizedCountry.includes(filterCountry)) {
          return false;
        }
      }

      if (hasFunctionRootFilter) {
        const filterFunctionRoot = normalizedFunctionRootRaw.toLowerCase();
        const possibleFunctionRootValues = [
          (raw as { std_function_root?: unknown }).std_function_root,
          (raw as { functionRoot?: unknown }).functionRoot,
          (raw as { function_root?: unknown }).function_root,
        ].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );

        const normalizedFunctionRoot =
          possibleFunctionRootValues[0]?.trim().toLowerCase() ?? '';

        if (
          normalizedFunctionRoot === '' ||
          !normalizedFunctionRoot.includes(filterFunctionRoot)
        ) {
          return false;
        }
      }

      return true;
    });
  }

  private buildFunctionGradeKeywordsHash(
    strategies: Array<{
      id?: string;
      label?: string;
      parameters?: Record<string, unknown>;
    }>,
  ): string {
    const normalized = strategies.map((strategy) => {
      const rawKeywords = strategy.parameters?.keywords;
      const rawJobTitle = strategy.parameters?.job_title;
      const keywords =
        typeof rawKeywords === 'string' ? rawKeywords.trim().toLowerCase() : '';
      const jobTitle =
        typeof rawJobTitle === 'string' ? rawJobTitle.trim().toLowerCase() : '';
      return {
        id: strategy.id ?? '',
        label: strategy.label ?? '',
        keywords,
        jobTitle,
      };
    });

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private logStrategies(strategies: PeopleSearchStrategyResult[]): void {
    this.logger.log(
      `Strategies extracted: ${strategies.length} strategies found`,
    );
    strategies.forEach((strategy) => {
      this.logger.log(
        `[Strategy: ${strategy.id}] Strategy details: ${JSON.stringify({ id: strategy.id, label: strategy.label }, null, 2)}`,
      );
      this.logger.log(
        `[Strategy: ${strategy.id}] Strategy parameters: ${JSON.stringify(strategy.parameters, null, 2)}`,
      );
    });
  }
}
