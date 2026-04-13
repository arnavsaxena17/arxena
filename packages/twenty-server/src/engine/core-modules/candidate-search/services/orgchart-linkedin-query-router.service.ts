import { Injectable, Logger } from '@nestjs/common';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import type { SearchQuery } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { normalizeLlmNullishString } from '../schemas/org-chart.schema';
import type {
  GeneratedSearchParameters,
  ParsedJobDescription,
} from '../types/candidate-search-request.type';
import {
  attachPeopleStrategiesToGeneratedSearchParameters,
  extractStrategiesFromGeneratedParams,
  type PeopleSearchStrategyResult,
} from '../utils/extract-strategies.util';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../utils/linkedin-query-generation-mapper.util';
import { createMinimalParsedJobDescription } from '../utils/parsed-job-description.util';
import type { PythonQueryInput } from './python-query-generation.service';
import { PythonQueryGenerationService } from './python-query-generation.service';
import { RequirementAnalyzerService } from './requirement-analyzer.service';
import { TitleTaxonomyRemoteService } from './title-taxonomy-remote.service';

export type OrgchartQueryGeneratorPreference = 'python' | 'multi_agent';

@Injectable()
export class OrgchartLinkedInQueryRouterService {
  private readonly logger = new Logger(OrgchartLinkedInQueryRouterService.name);

  constructor(
    private readonly linkedinQueryGenerationService: LinkedinQueryGenerationService,
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly requirementAnalyzerService: RequirementAnalyzerService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
  ) {}

  resolveGeneratorPreference(
    preference?: OrgchartQueryGeneratorPreference,
  ): 'python' | 'multi_agent' {
    return preference === 'multi_agent' ? 'multi_agent' : 'python';
  }

  /**
   * ANDs extra keyword clauses onto business-division base keywords: title taxonomy when
   * queryGenerator is python (default), else LinkedIn multi-agent orchestrator.
   */
  async enrichBusinessDivisionLinkedinKeywords(args: {
    queryGenerator?: OrgchartQueryGeneratorPreference;
    businessDivisionRaw: string;
    primaryCompanyName: string;
    baseBusinessDivisionKeywords: string;
    requirementForMultiAgent: string;
    /** From unified BD LLM — forwarded to arxena-site title-taxonomy `resolved_intent`. */
    titleTaxonomyResolvedIntent?: Record<string, unknown>;
    sendEvent?: (event: string, data: Record<string, unknown>) => boolean | void;
  }): Promise<string> {
    const {
      queryGenerator,
      businessDivisionRaw,
      primaryCompanyName,
      baseBusinessDivisionKeywords,
      requirementForMultiAgent,
      titleTaxonomyResolvedIntent,
      sendEvent,
    } = args;
    const base = baseBusinessDivisionKeywords.trim();
    if (!base) {
      return baseBusinessDivisionKeywords;
    }
    const gen = this.resolveGeneratorPreference(queryGenerator);
    if (gen === 'python') {
      this.logger.log(
        'Orgchart router: enriching BD keywords via title taxonomy (queryGenerator=python).',
      );
      const tax = await this.titleTaxonomyRemoteService.searchKeywordsFromQuery({
        query: businessDivisionRaw,
        companyName: primaryCompanyName,
        resolvedIntent: titleTaxonomyResolvedIntent,
      });
      const extra = tax?.boolean_query?.trim();
      if (extra) {
        return `(${baseBusinessDivisionKeywords}) AND (${extra})`;
      }
      return baseBusinessDivisionKeywords;
    }
    this.logger.log(
      'Orgchart router: enriching BD keywords via multi-agent (queryGenerator=multi_agent).',
    );
    sendEvent?.('status', {
      message: 'Enriching business division keywords (multi-agent)...',
    });
    const orchestratorResult =
      await this.linkedinQueryGenerationService.generateSearchQuerySet(
        requirementForMultiAgent,
        {
          verbose: process.env.LINKEDIN_QUERY_GENERATION_VERBOSE === 'true',
          sendEvent,
        },
      );
    const first = orchestratorResult.final_query_set?.search_query_set?.[0];
    const extra = first?.keywords?.trim() || first?.job_title?.trim() || '';
    if (extra) {
      return `(${baseBusinessDivisionKeywords}) AND (${extra})`;
    }
    return baseBusinessDivisionKeywords;
  }

  buildPythonQueryInputForOrgchartMode(args: {
    mode?: string;
    primaryCompanyName: string;
    functionRoot: string;
    jobTitles?: string[];
    stdFunction?: string;
    stdGrade?: string;
    selectedNodeStdScopes?: Array<{ stdFunction?: string; stdGrade?: string }>;
  }): PythonQueryInput {
    const pythonInput: PythonQueryInput = {
      company_names: args.primaryCompanyName ? [args.primaryCompanyName] : [],
    };
    const mode = args.mode;
    const stdFn = args.stdFunction?.trim();
    const stdGr = args.stdGrade?.trim();
    const nodeScope = mode === 'current_node' || mode === 'selected_nodes';

    const scopesFromBody = (args.selectedNodeStdScopes ?? [])
      .map((s) => ({
        stdFunction: s.stdFunction?.trim(),
        stdGrade: s.stdGrade?.trim(),
      }))
      .filter((s) => (s.stdFunction?.length ?? 0) > 0 || (s.stdGrade?.length ?? 0) > 0);

    const legacySingleScope =
      nodeScope && (stdFn || stdGr) && scopesFromBody.length === 0
        ? [{ stdFunction: stdFn, stdGrade: stdGr }]
        : [];

    const effectiveScopes =
      scopesFromBody.length > 0 ? scopesFromBody : legacySingleScope;

    const skipFunctionRootForNodeStdLabels =
      nodeScope && (scopesFromBody.length > 0 || !!(stdFn || stdGr));

    if (args.functionRoot?.trim() && !skipFunctionRootForNodeStdLabels) {
      pythonInput.function_root = [
        { name: args.functionRoot.trim(), exclude: false },
      ];
    }

    if (mode === 'leadership') {
      pythonInput.grades = [{ name: 'leadership', exclude: false }];
    } else if (mode === 'selected_nodes' && effectiveScopes.length > 1) {
      if (args.jobTitles?.length) {
        pythonInput.raw_job_titles = args.jobTitles;
      }
    } else if (effectiveScopes.length === 1) {
      const s = effectiveScopes[0]!;
      if (s.stdFunction) {
        pythonInput.functions = [{ name: s.stdFunction, exclude: false }];
      }
      if (s.stdGrade) {
        pythonInput.grades = [{ name: s.stdGrade, exclude: false }];
      }
    }

    if (args.mode === 'function_grade' && args.jobTitles?.length) {
      pythonInput.raw_job_titles = args.jobTitles;
    }
    return pythonInput;
  }

  /**
   * Maps a single LinkedIn query row to people strategies in classic / Sales Nav / Recruiter shape.
   * Used for org-chart shortcuts (full company, business division) so `searchType` is respected.
   */
  private buildStrategiesFromSingleSearchQuery(args: {
    query: SearchQuery;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    requirement: string;
  }): PeopleSearchStrategyResult[] {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      { search_query_set: [args.query] },
      args.searchType,
      args.requirement,
    );
    return extractStrategiesFromGeneratedParams(
      generated,
      args.searchType,
      'people',
    );
  }

  /**
   * Builds LinkedIn people strategies + minimal JD for org-chart flows (Unipile execution).
   */
  async buildOrgchartLinkedInStrategies(args: {
    rawQuery: string;
    cleanedQuery: string;
    requirement: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    mode?: string;
    primaryCompanyName: string;
    jobTitles?: string[];
    country: string;
    functionRoot: string;
    stdFunction?: string;
    stdGrade?: string;
    selectedNodeStdScopes?: Array<{ stdFunction?: string; stdGrade?: string }>;
    businessDivisionLinkedinKeywords?: string;
    isAllPeopleInCompanyMode: boolean;
    apiToken: string;
    queryGenerator?: OrgchartQueryGeneratorPreference;
    sendEvent?: (event: string, data: unknown) => void;
  }): Promise<{
    strategies: PeopleSearchStrategyResult[];
    parsedJobDescription: ParsedJobDescription;
  }> {
    const searchCategory: 'people' = 'people';
    const {
      rawQuery,
      cleanedQuery,
      requirement,
      searchType,
      mode,
      primaryCompanyName,
      jobTitles,
      country,
      functionRoot,
      stdFunction,
      stdGrade,
      selectedNodeStdScopes,
      businessDivisionLinkedinKeywords,
      isAllPeopleInCompanyMode,
      apiToken,
      queryGenerator,
      sendEvent,
    } = args;

    if (businessDivisionLinkedinKeywords && primaryCompanyName) {
      this.logger.log(
        `Orgchart router: business division keyword strategy for "${primaryCompanyName}" (searchType=${searchType}).`,
      );
      const countryForLocation = normalizeLlmNullishString(country) ?? '';
      const locationForQuery =
        countryForLocation.length > 0 ? [countryForLocation] : null;
      const divisionQuery: SearchQuery = {
        keywords: businessDivisionLinkedinKeywords,
        job_title: null,
        company: [primaryCompanyName],
        location: locationForQuery,
        years_of_experience: null,
      };
      const strategies = this.buildStrategiesFromSingleSearchQuery({
        query: divisionQuery,
        searchType,
        requirement,
      });
      return {
        strategies,
        parsedJobDescription: createMinimalParsedJobDescription({
          jobTitle: `Business division at ${primaryCompanyName}`,
          company: primaryCompanyName,
        }),
      };
    }

    if (isAllPeopleInCompanyMode) {
      this.logger.log(
        `Orgchart router: direct company filter for "${primaryCompanyName}" (mode=${mode}, searchType=${searchType}).`,
      );
      const companyOnlyQuery: SearchQuery = {
        keywords: null,
        job_title: null,
        company: [primaryCompanyName],
        location: null,
        years_of_experience: null,
      };
      const strategies = this.buildStrategiesFromSingleSearchQuery({
        query: companyOnlyQuery,
        searchType,
        requirement,
      });
      return {
        strategies,
        parsedJobDescription: createMinimalParsedJobDescription({
          jobTitle: primaryCompanyName
            ? `Employee at ${primaryCompanyName}`
            : 'Employee',
          company: primaryCompanyName,
        }),
      };
    }

    let parsedRequirement:
      | {
          primary_role_name?: string | null;
          location?: string | null;
          industry?: string | null;
        }
      | undefined;
    const gen = this.resolveGeneratorPreference(queryGenerator);

    if (gen === 'python') {
      sendEvent?.('status', {
        message: 'Generating LinkedIn search via Python query generator...',
      });
      const pythonInput = this.buildPythonQueryInputForOrgchartMode({
        mode,
        primaryCompanyName,
        functionRoot,
        jobTitles,
        stdFunction,
        stdGrade,
        selectedNodeStdScopes,
      });
      const unresolved =
        await this.pythonQueryGenerationService.generateSearchParameters(
          pythonInput,
          searchType,
          requirement,
        );
      const strategies = extractStrategiesFromGeneratedParams(
        unresolved,
        searchType,
        searchCategory,
      );
      const parsedReq = parsedRequirement;
      return {
        strategies,
        parsedJobDescription: createMinimalParsedJobDescription({
          jobTitle:
            (parsedReq?.primary_role_name &&
              parsedReq.primary_role_name.trim()) ||
            (primaryCompanyName ? `Role at ${primaryCompanyName}` : 'Employee'),
          company: primaryCompanyName,
          location: parsedReq?.location ?? '',
          industry: parsedReq?.industry ?? '',
        }),
      };
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const { openAIclient: openaiClient } =
      await this.workspaceQueryService.initializeLLMClients(workspaceId);

    sendEvent?.('status', {
      message: 'Analyzing org-chart requirement...',
    });
    parsedRequirement = await this.requirementAnalyzerService.analyzeRequirement(
      rawQuery,
      cleanedQuery,
      openaiClient,
      () => {},
      sendEvent,
    );

    sendEvent?.('status', {
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
    const strategies = extractStrategiesFromGeneratedParams(
      unresolved,
      searchType,
      searchCategory,
    );
    const parsedReq = parsedRequirement;
    return {
      strategies,
      parsedJobDescription: createMinimalParsedJobDescription({
        jobTitle:
          (parsedReq?.primary_role_name && parsedReq.primary_role_name.trim()) ||
          (primaryCompanyName ? `Role at ${primaryCompanyName}` : 'Employee'),
        company: primaryCompanyName,
        location: parsedReq?.location ?? '',
        industry: parsedReq?.industry ?? '',
      }),
    };
  }

  /**
   * Same routing as org-chart search, but returns `GeneratedSearchParameters` for REST/MCP.
   */
  async buildGeneratedSearchParametersForOrgchart(args: {
    rawQuery: string;
    cleanedQuery: string;
    requirement: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    mode?: string;
    primaryCompanyName: string;
    jobTitles?: string[];
    country: string;
    functionRoot: string;
    stdFunction?: string;
    stdGrade?: string;
    selectedNodeStdScopes?: Array<{ stdFunction?: string; stdGrade?: string }>;
    businessDivisionLinkedinKeywords?: string;
    isAllPeopleInCompanyMode: boolean;
    apiToken: string;
    queryGenerator?: OrgchartQueryGeneratorPreference;
    sendEvent?: (event: string, data: unknown) => void;
  }): Promise<GeneratedSearchParameters> {
    const { strategies } = await this.buildOrgchartLinkedInStrategies(args);
    this.logger.log(
      `Orgchart router: generated unresolved params from ${strategies.length} strateg(ies)`,
    );
    return attachPeopleStrategiesToGeneratedSearchParameters(
      strategies,
      args.searchType,
    );
  }
}
