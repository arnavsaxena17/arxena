import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import {
  graphqlToAddNewJob,
  OrgChartData,
  type OrgchartSearchMode,
} from 'twenty-shared';

import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { BrightDataLinkedinPeopleSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-linkedin-people-search.service';
import { BrightDataLinkedinProfileScrapeService } from 'src/engine/core-modules/bright-data/services/bright-data-linkedin-profile-scrape.service';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { OrgchartApifyBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-apify-build.types';
import { OrgchartLinkedinXrayBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-linkedin-xray-build.types';
import { OrgchartUnipileBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-unipile-build.types';
import {
  ApolloIoRestService,
  type ApolloPeopleSearchParams,
  isApolloOrganizationId,
} from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { ApolloPeopleSearchTransformerService } from 'src/engine/core-modules/candidate-search/services/apollo-people-search-transformer.service';
import { OrgChartSearchService } from 'src/engine/core-modules/candidate-search/services/orgchart-search.service';
import { ResultValidationService } from 'src/engine/core-modules/candidate-search/services/result-validation.service';
import { extractApiToken } from 'src/engine/core-modules/candidate-search/utils/auth.utils';
import { CandidateDataService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-data.service';
import { TransformedCandidateForTable } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { LinkedinXrayTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-xray-transformer.service';
import { OrgChartProgressRedisService } from 'src/engine/core-modules/candidate-sourcing/services/orgchart-progress-redis.service';
import { linkedInPeopleSearchResultMatchesTargetCompany } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-orgchart-company-match.util';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  LinkedInSearchService,
  parseApifyLinkedinCompanyScraperLogLine,
} from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { OrgChartCacheService } from 'src/engine/core-modules/org-chart/services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from 'src/engine/core-modules/org-chart/services/orgchart-cancel-registry.service';
import { OrgChartLinkedinCandidateSource } from 'src/engine/core-modules/org-chart/types/orgchart-linkedin-candidate-source.type';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import { filterOrgChartCandidatesByNodeStdLabels } from 'src/engine/core-modules/org-chart/utils/orgchart-node-scope-filter.util';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { LinkedinXrayService } from 'src/modules/linkedin-xray/linkedin-xray.service';
import { LinkedinXraySearchEngine } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

import { OrgChartRecordWorkspaceService } from './org-chart-record-workspace.service';
import { OrgChartS3Service } from './orgchart-s3.service';
import { PythonOrgChartService } from './python-org-chart.service';

/** Matches OrgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates input rows */
type OrgChartBuildCandidateRow =
  | TransformedCandidateForTable
  | Record<string, unknown>;

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

type SearchOrgchartLinkedInBody = {
  rawQuery: string;
  cleanedQuery: string;
  companyName?: string;
  companyId?: string;
  jobTitles?: string[];
  mode: OrgchartSearchMode;
  maxPages?: number;
  searchType?: OrgchartSearchType;
  requestId?: string;
  country?: string;
  functionRoot?: string;
  /** Standardized org-chart function label for current_node / selected_nodes (replaces function_root for Python + post-filter). */
  stdFunction?: string;
  /** Standardized org-chart grade label for current_node / selected_nodes. */
  stdGrade?: string;
  /** `selected_nodes`: one entry per selected diagram node (std_function + std_grade per node). */
  selectedNodeStdScopes?: Array<{ stdFunction?: string; stdGrade?: string }>;
  candidateSource?: OrgChartLinkedinCandidateSource;
  linkedinCompanyUrl?: string;
  apifyMaxItems?: number;
  profileScraperMode?: string;
  linkedinUnipileAccountId?: string;
  /** NL business division query; requires Unipile (not Apify) */
  businessDivisionRawQuery?: string;
  /** When true, LLM validation/scoring on LinkedIn hit lists. Default false. */
  validateAndScoreLinkedInResults?: boolean;
  queryGenerator?: 'python' | 'multi_agent';
  xraySearchEngine?: LinkedinXraySearchEngine;
  includePaginatedHtml?: boolean;
};

type EntireCompanyFilterState = {
  shouldWriteCompanyOrgChartCache: boolean;
  hasCountryFilter: boolean;
  hasFunctionRootFilter: boolean;
  normalizedCountryRaw: string;
  normalizedFunctionRootRaw: string;
};

@Injectable()
export class OrgChartLinkedInBuildService {
  private readonly logger = new Logger(OrgChartLinkedInBuildService.name);

  constructor(
    private readonly orgChartSearchService: OrgChartSearchService,
    private readonly orgChartCacheService: OrgChartCacheService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly creditTransactionService: CreditTransactionService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly orgChartProgressRedisService: OrgChartProgressRedisService,
    private readonly orgchartCancelRegistry: OrgchartCancelRegistryService,
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly orgChartRecordWorkspaceService: OrgChartRecordWorkspaceService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly candidateDataService: CandidateDataService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly apifyService: ApifyService,
    private readonly brightDataSerpService: BrightDataSerpService,
    private readonly brightDataLinkedinPeopleSearchService: BrightDataLinkedinPeopleSearchService,
    private readonly brightDataLinkedinProfileScrapeService: BrightDataLinkedinProfileScrapeService,
    private readonly resultValidationService: ResultValidationService,
    private readonly linkedinXrayService: LinkedinXrayService,
    private readonly linkedinXrayTransformerService: LinkedinXrayTransformerService,
    private readonly apolloIoRestService: ApolloIoRestService,
    private readonly apolloPeopleSearchTransformer: ApolloPeopleSearchTransformerService,
    @InjectMessageQueue(MessageQueue.orgchartApifyQueue)
    private readonly orgchartApifyQueue: MessageQueueService,
  ) {}

  private isBrightDataLinkedinProfileEnrichEnabled(): boolean {
    return process.env.BRIGHT_DATA_LINKEDIN_PROFILE_ENRICH_ENABLED !== 'false';
  }

  private buildLinkedinXrayRequirementText(args: {
    companyName: string;
    mode: OrgchartSearchMode;
    country?: string;
    functionRoot?: string;
    jobTitles?: string[];
  }): string {
    const parts = [`LinkedIn x-ray people search for ${args.companyName}`];

    if (args.jobTitles?.length) {
      parts.push(`titles: ${args.jobTitles.join(', ')}`);
    }

    if (args.functionRoot?.trim()) {
      parts.push(`function: ${args.functionRoot.trim()}`);
    }

    if (args.country?.trim()) {
      parts.push(`country: ${args.country.trim()}`);
    }

    parts.push(`mode: ${args.mode}`);

    return parts.join(' | ');
  }

  private inferCandidateSourceFromItems(
    items: Record<string, unknown>[],
  ): OrgChartLinkedinCandidateSource | undefined {
    for (const item of items) {
      const source = item.source;

      if (
        source === 'linkedin_xray' ||
        source === 'apify' ||
        source === 'apollo'
      ) {
        return source;
      }
    }

    return undefined;
  }

  private async runLinkedinXrayOrgChartSearch(args: {
    body: SearchOrgchartLinkedInBody;
    apiToken: string;
    mode: OrgchartSearchMode;
    resolvedCompanyName: string;
    companyId?: string;
    requestId?: string;
    searchType: OrgchartSearchType;
    canonicalCompanyLinkedinUrl?: string;
  }): Promise<{
    items: TransformedCandidateForTable[];
    itemCount: number;
    isCached: false;
    cacheSource: 'none';
    strategyResults: [];
  } | null> {
    const {
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      requestId,
      searchType,
      canonicalCompanyLinkedinUrl,
    } = args;

    console.log("These are args : ", args)

    if (body.candidateSource !== 'linkedin_xray') {
      return null;
    }

    if (!this.brightDataSerpService.isConfigured()) {
      throw new HttpException(
        'LinkedIn x-ray is not configured (BRIGHT_DATA_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    console.log("This is body : ", body)

    const jobTitlesJoined =
      body.jobTitles?.filter((title) => title.trim().length > 0).join(' OR ') ||
      '';
    const functionRootForQuery = hasMeaningfulOrgChartFunctionRootFilter(
      body.functionRoot,
    )
      ? body.functionRoot?.trim() ?? ''
      : '';

    const xrayPayload = this.linkedinXrayService.buildLinkedinXray({
      currentEmployer: resolvedCompanyName,
      country: body.country,
      jobTitle: jobTitlesJoined || functionRootForQuery,
      includeKeywords:
        body.businessDivisionRawQuery?.trim() ||
        functionRootForQuery ||
        jobTitlesJoined,
    });

    console.log("This is xray payload : ", xrayPayload)

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message:
          body.includePaginatedHtml === true
            ? `Running LinkedIn x-ray search via Bright Data snapshot pagination on ${body.xraySearchEngine === 'both' ? 'Google and Bing' : body.xraySearchEngine ?? 'Google'}...`
            : `Running LinkedIn x-ray search on ${body.xraySearchEngine === 'both' ? 'Google and Bing' : body.xraySearchEngine ?? 'Google'}...`,
        candidateSource: 'linkedin_xray',
        rawQuery: this.buildLinkedinXrayRequirementText({
          companyName: resolvedCompanyName,
          mode,
          country: body.country,
          functionRoot: body.functionRoot,
          jobTitles: body.jobTitles,
        }),
      },
    });

    const paginationInfoEmittedByEngine = new Set<string>();

    const results =
      await this.brightDataLinkedinPeopleSearchService.fetchAllPeopleResults({
        engines:
          body.xraySearchEngine === 'both'
            ? ['google', 'bing']
            : [body.xraySearchEngine ?? 'google'],
        urls: {
          google: xrayPayload.urls.google,
          bing: xrayPayload.urls.bing,
        },
        keywords: {
          google: [xrayPayload.query.q, xrayPayload.query.asOq]
            .filter(Boolean)
            .join(' ')
            .trim(),
          bing: [xrayPayload.query.q, xrayPayload.query.asOq]
            .filter(Boolean)
            .join(' ')
            .trim(),
        },
        includePaginatedHtml: body.includePaginatedHtml === true,
        dedupeByLinkedinUrl: true,
        postProcessPageCandidates: async (input) => {
          if (
            !this.isBrightDataLinkedinProfileEnrichEnabled() ||
            !this.brightDataLinkedinProfileScrapeService.isConfigured()
          ) {
            return {
              candidates: input.newUniqueCandidates,
              continuePagination: true,
            };
          }

          if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
            return {
              candidates: [],
              continuePagination: false,
            };
          }

          const enriched: LinkedInPeopleSearchResult[] =
            await this.brightDataLinkedinProfileScrapeService.enrichLinkedinPeopleSearchResults(
              input.newUniqueCandidates,
              {
                onProgress: async (event) => {
                  if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
                    return;
                  }

                  if (event.kind === 'batchStart') {
                    await this.emitOrgchartSearchProgressForToken(apiToken, {
                      requestId,
                      mode,
                      searchType,
                      companyName: resolvedCompanyName,
                      event: 'status',
                      data: {
                        message: `Bright Data: fetching ${event.totalUrls} LinkedIn profile(s) (parallel, concurrency ${process.env.BRIGHT_DATA_LINKEDIN_PROFILE_SCRAPE_CONCURRENCY ?? '8'})…`,
                        candidateSource: 'linkedin_xray',
                        workerPhase: 'bright_data_profiles_fetch',
                        engine: input.engine,
                        page: input.page,
                        brightDataTotal: event.totalUrls,
                      },
                    });
                    return;
                  }

                  if (event.kind === 'profileRequestDone') {
                    await this.emitOrgchartSearchProgressForToken(apiToken, {
                      requestId,
                      mode,
                      searchType,
                      companyName: resolvedCompanyName,
                      event: 'status',
                      data: {
                        message: `Bright Data: profile ${event.index + 1}/${event.total} ${event.success ? 'ok' : 'no data'} — ${event.url.slice(0, 72)}…`,
                        candidateSource: 'linkedin_xray',
                        workerPhase: 'bright_data_profile_done',
                        engine: input.engine,
                        page: input.page,
                        brightDataIndex: event.index + 1,
                        brightDataTotal: event.total,
                        brightDataSuccess: event.success,
                      },
                    });
                    return;
                  }

                  if (event.kind === 'batchComplete') {
                    await this.emitOrgchartSearchProgressForToken(apiToken, {
                      requestId,
                      mode,
                      searchType,
                      companyName: resolvedCompanyName,
                      event: 'status',
                      data: {
                        message: `Bright Data: finished profile scrape — ${event.recordsReturned} record(s) returned.`,
                        candidateSource: 'linkedin_xray',
                        workerPhase: 'bright_data_profiles_complete',
                        engine: input.engine,
                        page: input.page,
                        brightDataRecordsReturned: event.recordsReturned,
                      },
                    });
                  }
                },
              },
            );

          if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
            return {
              candidates: [],
              continuePagination: false,
            };
          }

          const companyMatched = enriched.filter((c) =>
            linkedInPeopleSearchResultMatchesTargetCompany(c, resolvedCompanyName),
          );

          const totalMatchedIncludingThisPage =
            input.totalUniqueResultsSoFarBeforeThisPage + companyMatched.length;

          await this.emitOrgchartSearchProgressForToken(apiToken, {
            requestId,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            event: 'status',
            data: {
              message: `Target company: ${companyMatched.length}/${enriched.length} on ${input.engine} page ${input.page} match "${resolvedCompanyName}". Running pagination validation (LLM)…`,
              candidateSource: 'linkedin_xray',
              workerPhase: 'company_filter_then_validation',
              engine: input.engine,
              page: input.page,
              matchedForOrgChart: companyMatched.length,
              evaluatedOnPage: enriched.length,
            },
          });

          const requirementText = this.buildLinkedinXrayRequirementText({
            companyName: resolvedCompanyName,
            mode,
            country: body.country,
            functionRoot: body.functionRoot,
            jobTitles: body.jobTitles,
          });

          const validation =
            await this.resultValidationService.validateLinkedinXraySerpPageForPagination(
              enriched,
              requirementText,
              resolvedCompanyName,
              totalMatchedIncludingThisPage,
              apiToken,
            );

          const continuePagination =
            this.resultValidationService.shouldContinuePagination(
              validation,
              totalMatchedIncludingThisPage,
              input.page,
            );

          await this.emitOrgchartSearchProgressForToken(apiToken, {
            requestId,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            event: 'status',
            data: {
              message: `Pagination validation: ${continuePagination ? 'continue' : 'stop'} — ${validation.reasoning?.slice(0, 200) ?? ''}`,
              candidateSource: 'linkedin_xray',
              workerPhase: 'pagination_validation_complete',
              engine: input.engine,
              page: input.page,
              shouldContinuePagination: continuePagination,
            },
          });

          return {
            candidates: companyMatched,
            continuePagination,
          };
        },
        onStatus: async (update) => {
          if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
            return;
          }

          await this.emitOrgchartSearchProgressForToken(apiToken, {
            requestId,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            event: 'status',
            data: {
              message: update.message,
              candidateSource: 'linkedin_xray',
              engine: update.engine,
              snapshotId: update.snapshotId,
              pollingAttempt: update.pollingAttempt,
              paginationMode:
                body.includePaginatedHtml === true ? 'bright_data' : 'arxena',
            },
          });
        },
        onPageFetched: async (update) => {
          if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
            return;
          }

          const strategyId = `orgchart-linkedin-xray-${update.engine}`;
          const strategyLabel = `LinkedIn x-ray (${update.engine})`;
          const remainingToFetch =
            update.totalResultsReported != null
              ? Math.max(
                  0,
                  update.totalResultsReported - update.totalUniqueResults,
                )
              : undefined;

          if (
            !paginationInfoEmittedByEngine.has(update.engine) &&
            (update.totalPagesAvailable != null ||
              update.totalResultsReported != null)
          ) {
            paginationInfoEmittedByEngine.add(update.engine);
            await this.emitOrgchartSearchProgressForToken(apiToken, {
              requestId,
              mode,
              searchType,
              companyName: resolvedCompanyName,
              event: 'paginationInfo',
              data: {
                strategyId,
                strategyLabel,
                totalCount: update.totalResultsReported,
                totalPages: update.totalPagesAvailable,
                pageLimit: 10,
                candidateSource: 'linkedin_xray',
                engine: update.engine,
                paginationMode:
                  body.includePaginatedHtml === true ? 'bright_data' : 'arxena',
              },
            });
          }

          await this.emitOrgchartSearchProgressForToken(apiToken, {
            requestId,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            event: 'pageResults',
            data: {
              message: `Fetched ${update.engine} page ${update.page}.`,
              page: update.page,
              totalPages: update.totalPagesAvailable,
              totalCountFromAPI: update.totalResultsReported,
              totalCandidates: update.totalUniqueResults,
              candidatesReceived: update.newUniqueResultsInPage,
              candidatesCollectedSoFar: update.totalUniqueResults,
              remainingToFetch,
              strategyId,
              strategyLabel,
              candidateSource: 'linkedin_xray',
              engine: update.engine,
              paginationMode:
                body.includePaginatedHtml === true ? 'bright_data' : 'arxena',
            },
          });
        },
      });

    console.log("This is results : ", results)

    this.logger.log(
      `LinkedIn x-ray search complete for company="${resolvedCompanyName}" includePaginatedHtml=${body.includePaginatedHtml === true} itemCount=${results.candidates.length}`,
    );

    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      return {
        items: [],
        itemCount: 0,
        isCached: false,
        cacheSource: 'none',
        strategyResults: [],
      };
    }

    const transformedCandidates =
      this.linkedinXrayTransformerService.transformLinkedinXrayRowsToTableFormat(
        results.candidates,
        {
          companyName: resolvedCompanyName,
          companyId,
          companyLinkedinUrl: canonicalCompanyLinkedinUrl,
        },
      );

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message: `LinkedIn x-ray fetched ${transformedCandidates.length} candidates. Building org chart...`,
        itemCount: transformedCandidates.length,
        candidateSource: 'linkedin_xray',
      },
    });

    const scopedItems = filterOrgChartCandidatesByNodeStdLabels(
      transformedCandidates,
      mode,
      {
        stdFunction: body.stdFunction,
        stdGrade: body.stdGrade,
        selectedNodeStdScopes: body.selectedNodeStdScopes,
      },
    ) as TransformedCandidateForTable[];

    return {
      items: scopedItems,
      itemCount: scopedItems.length,
      isCached: false,
      cacheSource: 'none',
      strategyResults: [],
    };
  }

  /**
   * Apollo.io people search for org chart (organization_ids + person_titles / keywords).
   *
   * Resolves the Apollo organization_id from companyId when the caller did not pick
   * the company via Apollo autocomplete (e.g. passed a LinkedIn slug / company name),
   * then builds mode-specific query params per the Apollo People API Search contract.
   *
   * @see https://docs.apollo.io/reference/people-api-search
   */
  private async runApolloOrgChartPeopleSearch(args: {
    body: SearchOrgchartLinkedInBody;
    apiToken: string;
    mode: OrgchartSearchMode;
    resolvedCompanyName: string;
    companyId?: string;
    requestId?: string;
    searchType: OrgchartSearchType;
    jobTitles: string[];
    canonicalCompanyLinkedinUrl?: string;
  }): Promise<{
    items: TransformedCandidateForTable[];
    itemCount: number;
    isCached: false;
    cacheSource: 'none';
    strategyResults: [];
  } | null> {
    if (args.body.candidateSource !== 'apollo') {
      return null;
    }

    if (!this.apolloIoRestService.isConfigured()) {
      throw new HttpException(
        'Apollo API is not configured (APOLLO_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (args.mode === 'business_division_map') {
      throw new HttpException(
        'Apollo org chart does not support business_division_map',
        HttpStatus.BAD_REQUEST,
      );
    }

    const linkedinCompanyUrl =
      args.canonicalCompanyLinkedinUrl?.trim() ||
      args.body.linkedinCompanyUrl?.trim() ||
      undefined;

    await this.emitOrgchartSearchProgressForToken(args.apiToken, {
      requestId: args.requestId,
      mode: args.mode,
      searchType: args.searchType,
      companyName: args.resolvedCompanyName,
      event: 'status',
      data: {
        message: 'Resolving company on Apollo…',
        candidateSource: 'apollo',
      },
    });

    const { organizationId: resolvedOrgId, linkedinUrl: resolvedLinkedinUrl } =
      await this.apolloIoRestService.resolveOrganizationIdForOrgChart({
        candidateId: args.companyId,
        companyName: args.resolvedCompanyName,
        linkedinCompanyUrl,
      });

    if (!resolvedOrgId) {
      this.logger.warn(
        `Apollo org chart: unable to resolve organization_id for company="${args.resolvedCompanyName}" (candidateId=${args.companyId ?? 'none'}, linkedin=${linkedinCompanyUrl ?? 'none'})`,
      );
      throw new HttpException(
        `Apollo org chart: could not find Apollo organization for "${args.resolvedCompanyName}"`,
        HttpStatus.NOT_FOUND,
      );
    }

    const apolloParams = this.buildApolloPeopleSearchParams({
      body: args.body,
      mode: args.mode,
      organizationId: resolvedOrgId,
      jobTitles: args.jobTitles,
    });

    await this.emitOrgchartSearchProgressForToken(args.apiToken, {
      requestId: args.requestId,
      mode: args.mode,
      searchType: args.searchType,
      companyName: args.resolvedCompanyName,
      event: 'status',
      data: {
        message: 'Fetching people from Apollo…',
        candidateSource: 'apollo',
      },
    });

    const merged: TransformedCandidateForTable[] = [];
    for (let page = 1; page <= 10; page++) {
      const raw = await this.apolloIoRestService.peopleSearch({
        ...apolloParams,
        page,
        per_page: 100,
      });
      const rows =
        this.apolloPeopleSearchTransformer.transformApolloPeopleToTableRows(
          raw as Record<string, unknown>,
          {
            companyName: args.resolvedCompanyName,
            companyId: resolvedOrgId,
            companyLinkedinUrl:
              resolvedLinkedinUrl ?? args.canonicalCompanyLinkedinUrl,
          },
        );
      merged.push(...rows);
      const pag = raw.pagination as
        | { page?: number; total_pages?: number }
        | undefined;
      if (!pag?.total_pages || page >= (pag.total_pages ?? 0)) {
        break;
      }
      if (rows.length === 0) {
        break;
      }
    }

    const scopedItems = filterOrgChartCandidatesByNodeStdLabels(
      merged,
      args.mode,
      {
        stdFunction: args.body.stdFunction,
        stdGrade: args.body.stdGrade,
        selectedNodeStdScopes: args.body.selectedNodeStdScopes,
      },
    ) as TransformedCandidateForTable[];

    return {
      items: scopedItems,
      itemCount: scopedItems.length,
      isCached: false,
      cacheSource: 'none',
      strategyResults: [],
    };
  }

  /**
   * Resolve front-end org-chart body → Apollo People API Search params.
   * Mirrors the unresolved → resolved parameter pattern used for Unipile/Apify,
   * stripping internal sentinels (`fullcompany`, `global`) before mapping to Apollo fields.
   */
  private buildApolloPeopleSearchParams(args: {
    body: SearchOrgchartLinkedInBody;
    mode: OrgchartSearchMode;
    organizationId: string;
    jobTitles: string[];
  }): ApolloPeopleSearchParams {
    const { body, mode, organizationId, jobTitles } = args;

    const trimmedCountry =
      typeof body.country === 'string' ? body.country.trim() : '';
    const hasCountryFilter =
      trimmedCountry.length > 0 && trimmedCountry.toLowerCase() !== 'global';

    const trimmedFunctionRoot =
      typeof body.functionRoot === 'string' ? body.functionRoot.trim() : '';
    const hasFunctionRootFilter =
      hasMeaningfulOrgChartFunctionRootFilter(trimmedFunctionRoot);

    const titles = jobTitles
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const qKeywordParts: string[] = [];
    if (hasFunctionRootFilter) {
      qKeywordParts.push(trimmedFunctionRoot);
    }
    if (body.businessDivisionRawQuery?.trim()) {
      qKeywordParts.push(body.businessDivisionRawQuery.trim());
    }
    if (body.stdFunction?.trim() && mode !== 'entire_company') {
      qKeywordParts.push(body.stdFunction.trim());
    }
    const q_keywords =
      qKeywordParts.length > 0 ? qKeywordParts.join(' ') : undefined;

    const person_locations = hasCountryFilter ? [trimmedCountry] : undefined;

    const person_titles: string[] | undefined =
      mode === 'entire_company' || mode === 'leadership'
        ? undefined
        : titles.length > 0
          ? titles
          : undefined;

    const person_seniorities: string[] | undefined =
      mode === 'leadership'
        ? [
            'owner',
            'founder',
            'c_suite',
            'partner',
            'vp',
            'head',
            'director',
          ]
        : undefined;

    // Safety: only pass organization_ids when it is a valid Apollo ObjectId.
    const organization_ids = isApolloOrganizationId(organizationId)
      ? [organizationId]
      : undefined;

    this.logger.log(
      `Apollo search params (mode=${mode}, organization_id=${organizationId}): ` +
        `titles=${person_titles?.length ?? 0}, seniorities=${person_seniorities?.length ?? 0}, ` +
        `location=${person_locations?.[0] ?? 'any'}, keywords="${q_keywords ?? ''}"`,
    );

    return {
      organization_ids,
      person_titles,
      person_seniorities,
      person_locations,
      q_keywords,
      include_similar_titles: person_titles ? true : undefined,
    };
  }

  /** Metadata aligned with org_chart credit debits / S3 folder under org-charts/{normalized}/ */
  private async buildOrgChartCreditMetadata(
    apiToken: string | undefined,
    companyId: string | undefined,
    resolvedCompanyName: string,
  ): Promise<{
    companyName?: string;
    companyId?: string;
    workspaceMemberId?: string;
    orgChartS3RelativePath: string;
  }> {
    const persistKey = this.orgChartS3Service.persistedCompanyFolderKey(
      companyId,
      resolvedCompanyName,
    );
    const orgChartS3RelativePath =
      this.orgChartS3Service.buildRelativeFolderPathFromPersistedKey(
        persistKey,
      );
    const workspaceMemberId = apiToken
      ? ((await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
          apiToken,
        )) ?? undefined)
      : undefined;

    return {
      companyName: resolvedCompanyName,
      companyId: companyId?.trim() || undefined,
      orgChartS3RelativePath,
      workspaceMemberId,
    };
  }

  async buildOrgChartFromJobCandidates(
    body: { jobId: string; jobName?: string },
    apiToken: string,
  ) {
    try {
      const jobId = body?.jobId;

      if (!jobId || jobId === 'job-id') {
        throw new HttpException('jobId is required', HttpStatus.BAD_REQUEST);
      }

      // Fetch all candidates currently attached to this job
      const candidates = await this.candidateDataService.fetchCandidatesForJob(
        jobId,
        [],
        apiToken,
      );

      if (!candidates.length) {
        return {
          success: true,
          mode: 'entire_company' as OrgchartSearchMode,
          searchType: 'classic' as OrgchartSearchType,
          jobId,
          itemCount: 0,
          items: [],
          orgChart: undefined,
          isCached: false,
          cacheSource: 'none',
        };
      }

      // Infer primary company name from candidate data (e.g. job_company_name field),
      // falling back to the provided jobName when needed.
      const companyCounts = new Map<string, number>();

      for (const candidate of candidates as Array<Record<string, unknown>>) {
        const raw = candidate as { [key: string]: unknown };
        const companyNameValue =
          (typeof raw.job_company_name === 'string' && raw.job_company_name) ||
          (typeof raw.company === 'string' && raw.company) ||
          '';
        const trimmed = companyNameValue?.trim();

        if (trimmed) {
          companyCounts.set(trimmed, (companyCounts.get(trimmed) ?? 0) + 1);
        }
      }

      let primaryCompanyName = '';
      let maxCount = 0;

      for (const [name, count] of companyCounts.entries()) {
        if (count > maxCount) {
          primaryCompanyName = name;
          maxCount = count;
        }
      }

      if (!primaryCompanyName) {
        primaryCompanyName = body.jobName?.trim() || 'OrgChart Job';
      }

      this.logger.log(
        `Building job org chart from ${candidates.length} candidates for jobId="${jobId}", primaryCompany="${primaryCompanyName}"`,
      );

      const orgChart =
        await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
          candidates,
          {
            companyName: primaryCompanyName,
            companyId: undefined,
            mode: 'entire_company',
            function: undefined,
          },
        );

      return {
        success: true,
        mode: 'entire_company' as OrgchartSearchMode,
        searchType: 'classic' as OrgchartSearchType,
        jobId,
        companyName: primaryCompanyName,
        itemCount: candidates.length,
        items: candidates,
        orgChart,
        isCached: false,
        cacheSource: 'job_candidates',
      };
    } catch (error: any) {
      this.logger.error('Failed to build org chart from job candidates', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error?.message || 'Failed to build org chart from job candidates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private buildOrgchartSearchRequirementText(
    mode: OrgchartSearchMode,
    resolvedCompanyName: string,
    jobTitles: string[],
  ): string {
    switch (mode) {
      case 'leadership':
        return `Find all leadership positions at ${resolvedCompanyName}.`;
      case 'entire_company':
        return `Find all people currently working at ${resolvedCompanyName}.`;
      case 'function_grade': {
        const titlesText =
          jobTitles && jobTitles.length > 0
            ? jobTitles.join(', ')
            : 'the relevant function and seniority described by the node';

        return `Find people at ${resolvedCompanyName} with job titles similar to: ${titlesText}.`;
      }
      case 'business_division_map':
        return `Map business division at ${resolvedCompanyName}.`;
      case 'selected_nodes':
        return `Find people for the selected nodes at ${resolvedCompanyName}.`;
      case 'current_node':
      default: {
        const titlesText =
          jobTitles && jobTitles.length > 0
            ? jobTitles.join(', ')
            : 'this role';

        return `Find people matching ${titlesText} at ${resolvedCompanyName}.`;
      }
    }
  }

  private getEntireCompanyFilterState(
    body: SearchOrgchartLinkedInBody,
  ): EntireCompanyFilterState {
    const filterCountryRaw = body.country;
    const filterFunctionRootRaw = body.functionRoot;
    const normalizedCountryRaw =
      typeof filterCountryRaw === 'string' ? filterCountryRaw.trim() : '';
    const hasCountryFilter =
      normalizedCountryRaw.length > 0 &&
      normalizedCountryRaw.toLowerCase() !== 'global';

    const normalizedFunctionRootRaw =
      typeof filterFunctionRootRaw === 'string'
        ? filterFunctionRootRaw.trim()
        : '';
    const hasFunctionRootFilter = hasMeaningfulOrgChartFunctionRootFilter(
      normalizedFunctionRootRaw,
    );

    return {
      shouldWriteCompanyOrgChartCache:
        !hasCountryFilter && !hasFunctionRootFilter,
      hasCountryFilter,
      hasFunctionRootFilter,
      normalizedCountryRaw,
      normalizedFunctionRootRaw,
    };
  }

  private filterItemsByEntireCompanyFilters(
    items: Record<string, unknown>[],
    state: EntireCompanyFilterState,
  ): Record<string, unknown>[] {
    const {
      hasCountryFilter,
      hasFunctionRootFilter,
      normalizedCountryRaw,
      normalizedFunctionRootRaw,
    } = state;

    if (!hasCountryFilter && !hasFunctionRootFilter) {
      return items;
    }

    return items.filter((item) => {
      const raw = item;

      if (hasCountryFilter) {
        const filterCountry = normalizedCountryRaw.toLowerCase();
        const possibleCountryValues = [
          raw.locationCountry,
          raw.location_country,
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

  private isFullCompanyOrgChartPayload(orgChartPayload: unknown): boolean {
    if (
      !orgChartPayload ||
      typeof orgChartPayload !== 'object' ||
      Array.isArray(orgChartPayload)
    ) {
      return false;
    }

    const rawType = (orgChartPayload as { type?: unknown }).type;

    return (
      typeof rawType === 'string' &&
      rawType.trim().toLowerCase() === 'fullcompany'
    );
  }

  private async tryEntireCompanyOrgChartFromCachesAndS3(args: {
    apiToken: string;
    mode: OrgchartSearchMode;
    resolvedCompanyName: string;
    companyId?: string;
    jobTitles: string[];
    searchType: OrgchartSearchType;
    canonicalCompanyLinkedinUrl?: string;
    requestId?: string;
    filterState: EntireCompanyFilterState;
    shouldWriteCompanyOrgChartCache: boolean;
  }): Promise<unknown> {
    const {
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      jobTitles,
      searchType,
      canonicalCompanyLinkedinUrl,
      requestId,
      filterState,
      shouldWriteCompanyOrgChartCache,
    } = args;

    const {
      hasCountryFilter,
      hasFunctionRootFilter,
      normalizedFunctionRootRaw,
    } = filterState;

    const applyFiltersToItems = (items: Record<string, unknown>[]) =>
      this.filterItemsByEntireCompanyFilters(items, filterState);

    const cachedOrgChart =
      await this.orgChartCacheService.getCachedCompanyOrgChart({
        companyName: resolvedCompanyName,
        companyId,
        mode: 'entire_company',
        searchType,
      });

    if (cachedOrgChart) {
      if (
        !hasCountryFilter &&
        !hasFunctionRootFilter &&
        !this.isFullCompanyOrgChartPayload(cachedOrgChart.orgChart)
      ) {
        this.logger.warn(
          `Ignoring invalid company org chart cache for company="${resolvedCompanyName}" because cached orgChart.type is not fullcompany`,
        );
      } else {
        const creditsAlreadyDebited = cachedOrgChart.creditsDebited !== false;

        if (creditsAlreadyDebited) {
          this.logger.log(
            `Serving cached company org chart for company="${resolvedCompanyName}" (credits already debited)`,
          );
          const baseItems = Array.isArray(cachedOrgChart.items)
            ? (cachedOrgChart.items as Record<string, unknown>[])
            : [];
          const candidateSource = this.inferCandidateSourceFromItems(baseItems);
          const filteredItems = applyFiltersToItems(baseItems);
          const orgChartForResponse =
            hasCountryFilter || hasFunctionRootFilter
              ? await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
                  filteredItems,
                  {
                    companyName: resolvedCompanyName,
                    companyId,
                    mode: 'entire_company',
                    function: hasFunctionRootFilter
                      ? normalizedFunctionRootRaw
                      : undefined,
                    companyLinkedinUrl: canonicalCompanyLinkedinUrl,
                  },
                )
              : cachedOrgChart.orgChart;

          return {
            success: true,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            jobTitles,
            itemCount: filteredItems.length,
            items: filteredItems,
            orgChart: orgChartForResponse,
            isCached: true,
            cacheSource: 'orgchart',
            cachedAt: cachedOrgChart.cachedAt,
            ...(candidateSource && {
              candidateSource,
            }),
          };
        }
        if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
          const workspaceId =
            await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
          const hasSufficient =
            await this.workspaceCreditsService.hasSufficientOrgChartCredits(
              workspaceId,
              cachedOrgChart.itemCount,
            );

          if (!hasSufficient) {
            const creditsNeeded =
              this.workspaceCreditsService.computeOrgChartCreditsNeeded(
                cachedOrgChart.itemCount,
              );

            throw new HttpException(
              `Insufficient org chart credits. Need ${creditsNeeded} credits for ${cachedOrgChart.itemCount} employees.`,
              HttpStatus.FORBIDDEN,
            );
          }
          const creditMeta = await this.buildOrgChartCreditMetadata(
            apiToken,
            companyId,
            resolvedCompanyName,
          );

          await this.workspaceCreditsService.debitOrgChartCredits(
            workspaceId,
            cachedOrgChart.itemCount,
            {
              companyName: resolvedCompanyName,
              companyId,
              orgChartS3RelativePath: creditMeta.orgChartS3RelativePath,
              ...(creditMeta.workspaceMemberId && {
                workspaceMemberId: creditMeta.workspaceMemberId,
              }),
            },
          );
          await this.orgChartCacheService.setCachedCompanyOrgChart({
            companyName: resolvedCompanyName,
            companyId,
            mode: 'entire_company',
            searchType,
            orgChart: cachedOrgChart.orgChart,
            items: cachedOrgChart.items,
            itemCount: cachedOrgChart.itemCount,
            creditsDebited: true,
          });
        }
        this.logger.log(
          `Serving cached company org chart for company="${resolvedCompanyName}" (credits debited on this request)`,
        );
        const baseItems = Array.isArray(cachedOrgChart.items)
          ? (cachedOrgChart.items as Record<string, unknown>[])
          : [];
        const candidateSource = this.inferCandidateSourceFromItems(baseItems);
        const filteredItems = applyFiltersToItems(baseItems);
        const orgChartForResponse =
          hasCountryFilter || hasFunctionRootFilter
            ? await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
                filteredItems,
                {
                  companyName: resolvedCompanyName,
                  companyId,
                  mode: 'entire_company',
                  function: hasFunctionRootFilter
                    ? normalizedFunctionRootRaw
                    : undefined,
                  companyLinkedinUrl: canonicalCompanyLinkedinUrl,
                },
              )
            : cachedOrgChart.orgChart;

        return {
          success: true,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          jobTitles,
          itemCount: filteredItems.length,
          items: filteredItems,
          orgChart: orgChartForResponse,
          isCached: true,
          cacheSource: 'orgchart',
          cachedAt: cachedOrgChart.cachedAt,
          ...(candidateSource && {
            candidateSource,
          }),
        };
      }
    }

    const cachedCandidateList =
      await this.orgChartCacheService.getCachedCompanyCandidateList({
        companyName: resolvedCompanyName,
        companyId,
        mode: 'entire_company',
        searchType,
      });

    if (cachedCandidateList && cachedCandidateList.itemCount > 0) {
      this.logger.log(
        `Building org chart from cached candidate list for company="${resolvedCompanyName}" (${cachedCandidateList.itemCount} candidates)`,
      );
      try {
        const baseItems = Array.isArray(cachedCandidateList.items)
          ? (cachedCandidateList.items as Record<string, unknown>[])
          : [];
        const candidateSource = this.inferCandidateSourceFromItems(baseItems);
        const filteredItems = applyFiltersToItems(baseItems);
        const orgChartFromCache =
          await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
            filteredItems,
            {
              companyName: resolvedCompanyName,
              companyId,
              mode,
              function: hasFunctionRootFilter
                ? normalizedFunctionRootRaw
                : undefined,
              companyLinkedinUrl: canonicalCompanyLinkedinUrl,
            },
          );
        const shouldCacheBuiltOrgChartFromCandidateList =
          this.orgChartCacheService.shouldCacheCompanyOrgChart({
            orgChart: orgChartFromCache,
            fallbackCandidateCount: cachedCandidateList.itemCount,
            companyName: resolvedCompanyName,
            companyId,
          });
        let creditsDebited = process.env.IS_BILLING_ENABLED !== 'true';

        if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
          const workspaceId =
            await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
          const hasSufficient =
            await this.workspaceCreditsService.hasSufficientOrgChartCredits(
              workspaceId,
              cachedCandidateList.itemCount,
            );

          if (!hasSufficient) {
            if (
              shouldCacheBuiltOrgChartFromCandidateList &&
              shouldWriteCompanyOrgChartCache
            ) {
              await this.orgChartCacheService.setCachedCompanyOrgChart(
                {
                  companyName: resolvedCompanyName,
                  companyId,
                  mode: 'entire_company',
                  searchType,
                  orgChart: orgChartFromCache,
                  items: cachedCandidateList.items,
                  itemCount: cachedCandidateList.itemCount,
                  creditsDebited: false,
                },
              );
            }
            const creditsNeeded =
              this.workspaceCreditsService.computeOrgChartCreditsNeeded(
                cachedCandidateList.itemCount,
              );

            throw new HttpException(
              `Insufficient org chart credits. Need ${creditsNeeded} credits for ${cachedCandidateList.itemCount} employees.`,
              HttpStatus.FORBIDDEN,
            );
          }
          const creditMetaCandidate = await this.buildOrgChartCreditMetadata(
            apiToken,
            companyId,
            resolvedCompanyName,
          );

          await this.workspaceCreditsService.debitOrgChartCredits(
            workspaceId,
            cachedCandidateList.itemCount,
            {
              companyName: resolvedCompanyName,
              companyId,
              orgChartS3RelativePath:
                creditMetaCandidate.orgChartS3RelativePath,
              ...(creditMetaCandidate.workspaceMemberId && {
                workspaceMemberId: creditMetaCandidate.workspaceMemberId,
              }),
            },
          );
          creditsDebited = true;
        }
        if (
          shouldCacheBuiltOrgChartFromCandidateList &&
          shouldWriteCompanyOrgChartCache
        ) {
          await this.orgChartCacheService.setCachedCompanyOrgChart({
            companyName: resolvedCompanyName,
            companyId,
            mode: 'entire_company',
            searchType,
            orgChart: orgChartFromCache,
            items: baseItems,
            itemCount: baseItems.length,
            creditsDebited,
          });
        }

        return {
          success: true,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          jobTitles,
          itemCount: filteredItems.length,
          items: filteredItems,
          orgChart: orgChartFromCache,
          isCached: true,
          cacheSource: 'candidate_list',
          cachedAt: cachedCandidateList.cachedAt,
          ...(candidateSource && {
            candidateSource,
          }),
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        this.logger.error(
          `Failed to build org chart from cached candidates for company="${resolvedCompanyName}"`,
          error as Error,
        );
        const buildFailureMessage =
          error instanceof Error
            ? error.message
            : 'Failed to build organization chart from cached people.';

        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: { message: buildFailureMessage },
        });
        const baseItems = Array.isArray(cachedCandidateList.items)
          ? (cachedCandidateList.items as Record<string, unknown>[])
          : [];
        const candidateSource = this.inferCandidateSourceFromItems(baseItems);
        const filteredItems = applyFiltersToItems(baseItems);

        return {
          success: true,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          jobTitles,
          itemCount: filteredItems.length,
          items: filteredItems,
          orgChart: undefined,
          orgChartError: buildFailureMessage,
          isCached: true,
          cacheSource: 'candidate_list',
          cachedAt: cachedCandidateList.cachedAt,
          ...(candidateSource && {
            candidateSource,
          }),
        };
      }
    }

    if (shouldWriteCompanyOrgChartCache) {
      const s3PersistKey = this.orgChartS3Service.persistedCompanyFolderKey(
        companyId,
        resolvedCompanyName,
      );
      const creditMetaS3 = await this.buildOrgChartCreditMetadata(
        apiToken,
        companyId,
        resolvedCompanyName,
      );
      let canLoadS3 = false;

      if (creditMetaS3.workspaceMemberId && apiToken) {
        const workspaceIdS3 =
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

        if (workspaceIdS3) {
          canLoadS3 =
            await this.creditTransactionService.hasOrgChartS3AccessForMember(
              workspaceIdS3,
              creditMetaS3.workspaceMemberId,
              creditMetaS3.orgChartS3RelativePath,
              s3PersistKey,
            );
        }
      }

      if (!canLoadS3) {
        this.logger.log(
          `Skipping S3 org chart for company="${resolvedCompanyName}" (no credit transaction access for this member/path)`,
        );
      }

      const [s3OrgChart, s3Candidates] = canLoadS3
        ? await Promise.all([
            this.orgChartS3Service.getOrgChart(s3PersistKey),
            this.orgChartS3Service.getCandidates(s3PersistKey),
          ])
        : [null, null];

      if (
        canLoadS3 &&
        s3OrgChart &&
        Array.isArray(s3Candidates) &&
        s3Candidates.length > 0 &&
        this.isFullCompanyOrgChartPayload(s3OrgChart)
      ) {
        this.logger.log(
          `Serving org chart from S3 for company="${resolvedCompanyName}" (${s3Candidates.length} candidates, key=${s3PersistKey})`,
        );
        await this.orgChartCacheService.setCachedCompanyCandidateList({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
          items: s3Candidates,
          itemCount: s3Candidates.length,
        });
        await this.orgChartCacheService.setCachedCompanyOrgChart({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
          orgChart: s3OrgChart,
          items: s3Candidates,
          itemCount: s3Candidates.length,
          creditsDebited: true,
        });

        return {
          success: true,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          jobTitles,
          itemCount: s3Candidates.length,
          items: s3Candidates,
          orgChart: s3OrgChart,
          isCached: true,
          cacheSource: 's3',
        };
      }
    }

    return null;
  }

  private async maybeQueueApifyOrgChartBuild(args: {
    body: SearchOrgchartLinkedInBody;
    apiToken: string;
    mode: OrgchartSearchMode;
    resolvedCompanyName: string;
    companyId?: string;
    jobTitles: string[];
    searchType: OrgchartSearchType;
    requestId?: string;
    shouldWriteCompanyOrgChartCache: boolean;
  }): Promise<unknown> {
    const {
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      jobTitles,
      searchType,
      requestId,
      shouldWriteCompanyOrgChartCache,
    } = args;

    if (body.candidateSource !== 'apify' || mode !== 'entire_company') {
      return null;
    }

    const linkedinCompanyUrl =
      body.linkedinCompanyUrl?.trim() ||
      (companyId ? `https://www.linkedin.com/company/${companyId}` : '');

    if (!linkedinCompanyUrl) {
      throw new HttpException(
        'linkedinCompanyUrl or companyId is required when candidateSource is apify',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!this.apifyService.isConfigured()) {
      throw new HttpException(
        'Apify is not configured (APIFY_API_TOKEN)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (requestId) {
      this.orgchartCancelRegistry.register(requestId);
    }

    const maxItems =
      typeof body.apifyMaxItems === 'number' && body.apifyMaxItems > 0
        ? Math.min(body.apifyMaxItems, 10000)
        : 500;

    const jobData: OrgchartApifyBuildJobData = {
      apiToken,
      requestId,
      rawQuery: body.rawQuery,
      cleanedQuery: body.cleanedQuery,
      searchType,
      mode: 'entire_company',
      companyName: resolvedCompanyName,
      companyId,
      jobTitles: body.jobTitles,
      country: body.country,
      functionRoot: body.functionRoot,
      linkedinCompanyUrl,
      maxItems,
      profileScraperMode: body.profileScraperMode,
      shouldWriteCompanyOrgChartCache,
    };

    await this.orgchartApifyQueue.add('OrgchartApifyBuildProcessor', jobData, {
      retryLimit: 0,
    });

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message: 'Apify org chart job queued. Waiting for worker pickup…',
        candidateSource: 'apify',
      },
    });

    this.logger.log(
      `Queued Apify org chart build for company="${resolvedCompanyName}" linkedinUrl=${linkedinCompanyUrl}`,
    );

    return {
      success: true,
      queued: true,
      candidateSource: 'apify' as const,
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles,
      linkedinCompanyUrl,
      itemCount: 0,
      items: [],
      orgChart: undefined,
      isCached: false,
      cacheSource: 'none' as const,
    };
  }

  private async maybeQueueLinkedinXrayOrgChartBuild(args: {
    body: SearchOrgchartLinkedInBody;
    apiToken: string;
    mode: OrgchartSearchMode;
    resolvedCompanyName: string;
    companyId?: string;
    jobTitles: string[];
    searchType: OrgchartSearchType;
    requestId?: string;
    canonicalCompanyLinkedinUrl?: string;
    shouldWriteCompanyOrgChartCache: boolean;
  }): Promise<unknown> {
    const {
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      jobTitles,
      searchType,
      requestId,
      canonicalCompanyLinkedinUrl,
      shouldWriteCompanyOrgChartCache,
    } = args;

    if (body.candidateSource !== 'linkedin_xray') {
      return null;
    }

    const terminalResponse = this.buildTerminalOrgchartRequestResponse({
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles,
      linkedinCompanyUrl: canonicalCompanyLinkedinUrl,
      candidateSource: 'linkedin_xray',
    });

    if (terminalResponse) {
      this.logger.log(
        `Skipping LinkedIn x-ray requeue for terminal requestId=${requestId} status=${String(
          (terminalResponse as { terminalStatus?: string }).terminalStatus,
        )}`,
      );

      return terminalResponse;
    }

    if (!this.brightDataSerpService.isConfigured()) {
      throw new HttpException(
        'LinkedIn x-ray is not configured (BRIGHT_DATA_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (requestId) {
      this.orgchartCancelRegistry.register(requestId);
    }

    const jobData: OrgchartLinkedinXrayBuildJobData = {
      apiToken,
      requestId,
      rawQuery: body.rawQuery,
      cleanedQuery: body.cleanedQuery,
      searchType,
      mode,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles: body.jobTitles,
      country: body.country,
      functionRoot: body.functionRoot,
      stdFunction: body.stdFunction,
      stdGrade: body.stdGrade,
      selectedNodeStdScopes: body.selectedNodeStdScopes,
      linkedinCompanyUrl: canonicalCompanyLinkedinUrl,
      businessDivisionRawQuery: body.businessDivisionRawQuery,
      xraySearchEngine: body.xraySearchEngine,
      includePaginatedHtml: body.includePaginatedHtml,
      shouldWriteCompanyOrgChartCache,
    };

    await this.orgchartApifyQueue.add(
      'OrgchartLinkedinXrayBuildProcessor',
      jobData,
      { retryLimit: 0 },
    );

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message: 'LinkedIn x-ray org chart job queued. Waiting for worker pickup…',
        candidateSource: 'linkedin_xray',
      },
    });

    this.logger.log(
      `Queued LinkedIn x-ray org chart build for company="${resolvedCompanyName}" includePaginatedHtml=${body.includePaginatedHtml === true}`,
    );

    return {
      success: true,
      queued: true,
      candidateSource: 'linkedin_xray' as const,
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles,
      linkedinCompanyUrl: canonicalCompanyLinkedinUrl,
      itemCount: 0,
      items: [],
      orgChart: undefined,
      isCached: false,
      cacheSource: 'none' as const,
    };
  }

  private async maybeQueueUnipileOrgChartBuild(args: {
    body: SearchOrgchartLinkedInBody;
    apiToken: string;
    mode: OrgchartSearchMode;
    resolvedCompanyName: string;
    companyId?: string;
    jobTitles: string[];
    searchType: OrgchartSearchType;
    requestId?: string;
    canonicalCompanyLinkedinUrl?: string;
    shouldWriteCompanyOrgChartCache: boolean;
  }): Promise<unknown> {
    const {
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      jobTitles,
      searchType,
      requestId,
      canonicalCompanyLinkedinUrl,
      shouldWriteCompanyOrgChartCache,
    } = args;

    if (
      body.candidateSource === 'apify' ||
      body.candidateSource === 'linkedin_xray' ||
      body.candidateSource === 'apollo'
    ) {
      return null;
    }

    const terminalResponse = this.buildTerminalOrgchartRequestResponse({
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles,
      linkedinCompanyUrl: canonicalCompanyLinkedinUrl,
      candidateSource: 'unipile',
    });

    if (terminalResponse) {
      this.logger.log(
        `Skipping Unipile requeue for terminal requestId=${requestId} status=${String(
          (terminalResponse as { terminalStatus?: string }).terminalStatus,
        )}`,
      );

      return terminalResponse;
    }

    if (requestId) {
      this.orgchartCancelRegistry.register(requestId);
    }

    const jobData: OrgchartUnipileBuildJobData = {
      apiToken,
      requestId,
      rawQuery: body.rawQuery,
      cleanedQuery: body.cleanedQuery,
      searchType,
      mode,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles: body.jobTitles,
      country: body.country,
      functionRoot: body.functionRoot,
      stdFunction: body.stdFunction,
      stdGrade: body.stdGrade,
      selectedNodeStdScopes: body.selectedNodeStdScopes,
      linkedinCompanyUrl: canonicalCompanyLinkedinUrl,
      linkedinUnipileAccountId: body.linkedinUnipileAccountId,
      businessDivisionRawQuery: body.businessDivisionRawQuery,
      shouldWriteCompanyOrgChartCache,
    };

    await this.orgchartApifyQueue.add(
      'OrgchartUnipileBuildProcessor',
      jobData,
      { retryLimit: 0 },
    );

    console.log(`jobData:: ${JSON.stringify(jobData)}`);
    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message: 'LinkedIn org chart job queued. Waiting for worker pickup…',
        candidateSource: 'unipile',
      },
    });

    this.logger.log(
      `Queued Unipile org chart build for company="${resolvedCompanyName}" mode=${mode} linkedinCompanyUrl=${canonicalCompanyLinkedinUrl}, linkedinUnipileAccountId=${body.linkedinUnipileAccountId}`,
    );

    return {
      success: true,
      queued: true,
      candidateSource: 'unipile' as const,
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles,
      linkedinCompanyUrl: canonicalCompanyLinkedinUrl,
      itemCount: 0,
      items: [],
      orgChart: undefined,
      isCached: false,
      cacheSource: 'none' as const,
    };
  }

  private buildTerminalOrgchartRequestResponse(input: {
    requestId?: string;
    mode: OrgchartSearchMode;
    searchType: OrgchartSearchType;
    companyName: string;
    companyId?: string;
    jobTitles: string[];
    linkedinCompanyUrl?: string;
    candidateSource: 'unipile' | 'linkedin_xray' | 'apify';
  }):
    | {
        success: true;
        queued: false;
        requestId?: string;
        mode: OrgchartSearchMode;
        searchType: OrgchartSearchType;
        companyName: string;
        companyId?: string;
        jobTitles: string[];
        linkedinCompanyUrl?: string;
        candidateSource: 'unipile' | 'linkedin_xray' | 'apify';
        itemCount: 0;
        items: [];
        orgChart: undefined;
        isCached: false;
        cacheSource: 'none';
        terminalStatus: 'cancelled' | 'completed' | 'failed';
        orgChartError?: string;
      }
    | null {
    const state = this.orgchartCancelRegistry.getState(input.requestId);

    if (
      !state ||
      (state.status !== 'cancelled' &&
        state.status !== 'completed' &&
        state.status !== 'failed')
    ) {
      return null;
    }

    return {
      success: true,
      queued: false,
      requestId: input.requestId,
      mode: input.mode,
      searchType: input.searchType,
      companyName: input.companyName,
      companyId: input.companyId,
      jobTitles: input.jobTitles,
      linkedinCompanyUrl: input.linkedinCompanyUrl,
      candidateSource: input.candidateSource,
      itemCount: 0,
      items: [],
      orgChart: undefined,
      isCached: false,
      cacheSource: 'none' as const,
      terminalStatus: state.status,
      ...(state.status === 'failed' || state.status === 'cancelled'
        ? {
            orgChartError:
              state.message ||
              (state.status === 'cancelled'
                ? 'Org chart search was cancelled.'
                : 'Org chart search failed.'),
          }
        : {}),
    };
  }

  private async buildOrgChartAfterLinkedInSearch(args: {
    apiToken: string;
    body: SearchOrgchartLinkedInBody;
    mode: OrgchartSearchMode;
    resolvedCompanyName: string;
    companyId?: string;
    searchType: OrgchartSearchType;
    requestId?: string;
    canonicalCompanyLinkedinUrl?: string;
    shouldWriteCompanyOrgChartCache: boolean;
    result: Awaited<
      ReturnType<OrgChartSearchService['runOrgchartLinkedInSearch']>
    >;
  }): Promise<{ orgChart: OrgChartData | undefined; orgChartError?: string }> {
    const {
      apiToken,
      body,
      mode,
      resolvedCompanyName,
      companyId,
      searchType,
      requestId,
      canonicalCompanyLinkedinUrl,
      shouldWriteCompanyOrgChartCache,
      result,
    } = args;

    let orgChart: OrgChartData | undefined;
    let orgChartError: string | undefined;

    if (mode === 'entire_company' && result.itemCount > 0) {
      await this.orgChartCacheService.setCachedCompanyCandidateList({
        companyName: resolvedCompanyName,
        companyId,
        mode: 'entire_company',
        searchType,
        items: result.items,
        itemCount: result.itemCount,
      });
    }

    if (mode === 'entire_company' && result.itemCount > 0) {
      try {
        orgChart =
          await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
            result.items as OrgChartBuildCandidateRow[],
            {
              companyName: resolvedCompanyName,
              companyId,
              mode,
              function: body.functionRoot,
              companyLinkedinUrl: canonicalCompanyLinkedinUrl,
            },
          );
      } catch (error) {
        this.logger.error(
          `Failed to build org chart from LinkedIn orgchart search for company="${resolvedCompanyName}"`,
          error as Error,
        );
        const rawMsg = error instanceof Error ? error.message : '';
        const isFetchTransport =
          rawMsg === 'fetch failed' ||
          rawMsg.toLowerCase().includes('fetch failed');
        const buildFailureMessage =
          error instanceof Error
            ? isFetchTransport
              ? PythonOrgChartService.ORG_CHART_AGENT_UNAVAILABLE_MESSAGE
              : error.message
            : 'Failed to build organization chart after people search.';

        orgChartError = buildFailureMessage;
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: { message: buildFailureMessage },
        });
      }
      const shouldCacheBuiltOrgChartFromLinkedIn =
        orgChart &&
        this.orgChartCacheService.shouldCacheCompanyOrgChart({
          orgChart,
          fallbackCandidateCount: result.itemCount,
          companyName: resolvedCompanyName,
          companyId,
        });
      let creditsDebited = process.env.IS_BILLING_ENABLED !== 'true';

      if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        const hasSufficient =
          await this.workspaceCreditsService.hasSufficientOrgChartCredits(
            workspaceId,
            result.itemCount,
          );

        if (!hasSufficient) {
          if (
            shouldCacheBuiltOrgChartFromLinkedIn &&
            shouldWriteCompanyOrgChartCache &&
            orgChart
          ) {
            await this.orgChartCacheService.setCachedCompanyOrgChart({
              companyName: resolvedCompanyName,
              companyId,
              mode: 'entire_company',
              searchType,
              orgChart,
              items: result.items,
              itemCount: result.itemCount,
              creditsDebited: false,
            });
          }
          const creditsNeeded =
            this.workspaceCreditsService.computeOrgChartCreditsNeeded(
              result.itemCount,
            );

          throw new HttpException(
            `Insufficient org chart credits. Need ${creditsNeeded} credits for ${result.itemCount} employees.`,
            HttpStatus.FORBIDDEN,
          );
        }
        const creditMetaFresh = await this.buildOrgChartCreditMetadata(
          apiToken,
          companyId,
          resolvedCompanyName,
        );

        await this.workspaceCreditsService.debitOrgChartCredits(
          workspaceId,
          result.itemCount,
          {
            companyName: resolvedCompanyName,
            companyId,
            orgChartS3RelativePath: creditMetaFresh.orgChartS3RelativePath,
            ...(creditMetaFresh.workspaceMemberId && {
              workspaceMemberId: creditMetaFresh.workspaceMemberId,
            }),
          },
        );
        creditsDebited = true;
      }
      if (
        shouldCacheBuiltOrgChartFromLinkedIn &&
        shouldWriteCompanyOrgChartCache &&
        orgChart
      ) {
        await this.orgChartCacheService.setCachedCompanyOrgChart({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
          orgChart,
          items: result.items,
          itemCount: result.itemCount,
          creditsDebited,
        });

        const s3CompanyId = this.orgChartS3Service.persistedCompanyFolderKey(
          companyId,
          resolvedCompanyName,
        );

        await Promise.all([
          this.orgChartS3Service.saveOrgChart(s3CompanyId, orgChart),
          this.orgChartS3Service.saveCandidates(s3CompanyId, result.items),
        ]);

        const creditMetaForRow = await this.buildOrgChartCreditMetadata(
          apiToken,
          companyId,
          resolvedCompanyName,
        );

        const functionGradeMeta = (
          result as {
            functionGradeCacheMeta?: { keywordsHash?: string };
          }
        ).functionGradeCacheMeta;

        await this.orgChartRecordWorkspaceService.tryPersistOrgChartRecord({
          apiToken,
          mode,
          searchType,
          resolvedCompanyName,
          companyId,
          linkedinCompanyUrl:
            canonicalCompanyLinkedinUrl ?? body.linkedinCompanyUrl,
          itemCount: result.itemCount,
          orgChartS3RelativePath: creditMetaForRow.orgChartS3RelativePath,
          functionRoot: body.functionRoot,
          country: body.country,
          keywordsHash: functionGradeMeta?.keywordsHash,
        });

        if (process.env.IS_BILLING_ENABLED !== 'true' && apiToken) {
          const workspaceIdForGrant =
            await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
          const creditMetaGrant = await this.buildOrgChartCreditMetadata(
            apiToken,
            companyId,
            resolvedCompanyName,
          );

          if (workspaceIdForGrant && creditMetaGrant.workspaceMemberId) {
            await this.creditTransactionService.recordOrgChartAccessGrant({
              workspaceId: workspaceIdForGrant,
              workspaceMemberId: creditMetaGrant.workspaceMemberId,
              orgChartS3RelativePath: creditMetaGrant.orgChartS3RelativePath,
              companyName: creditMetaGrant.companyName,
              companyId: creditMetaGrant.companyId,
              employeeCount: result.itemCount,
            });
          }
        }

        const orgChartJobNameSuffix = body.functionRoot
          ? body.functionRoot.replace(/\s+/g, '-').toLowerCase()
          : 'entire';
        const orgChartJobName = `orgchart-${resolvedCompanyName.replace(/\s+/g, '-')}-${orgChartJobNameSuffix}`;

        try {
          await this.staticGraphQLService.executeGraphQL(
            graphqlToAddNewJob,
            { input: { name: orgChartJobName, position: 'first' } },
            apiToken,
          );
          this.logger.log(
            `Created org chart job "${orgChartJobName}" for company="${resolvedCompanyName}"`,
          );
        } catch (jobError) {
          this.logger.warn(
            `Could not create org chart job "${orgChartJobName}": ${(jobError as Error).message}`,
          );
        }
      }
    }

    if (mode === 'function_grade' && result.itemCount > 0) {
      orgChart = result.orgChart;
      try {
        if (!orgChart) {
          orgChart =
            await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
              result.items as OrgChartBuildCandidateRow[],
              {
                companyName: resolvedCompanyName,
                companyId,
                mode,
                function: body.functionRoot,
                companyLinkedinUrl: canonicalCompanyLinkedinUrl,
              },
            );
        }
      } catch (error) {
        this.logger.error(
          `Failed to build function-grade org chart for company="${resolvedCompanyName}"`,
          error as Error,
        );
        const buildFailureMessage =
          error instanceof Error
            ? error.message
            : 'Failed to build organization chart for this function.';

        orgChartError = buildFailureMessage;
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: { message: buildFailureMessage },
        });
      }

      if (
        result.functionGradeCacheMeta &&
        result.functionGradeCacheMeta.functionRoot
      ) {
        await this.orgChartCacheService.setCachedFunctionGradeSearch({
          companyName: resolvedCompanyName,
          companyId,
          functionRoot: result.functionGradeCacheMeta.functionRoot,
          country: result.functionGradeCacheMeta.country,
          searchType,
          strategyCap: result.functionGradeCacheMeta.strategyCap,
          keywordsHash: result.functionGradeCacheMeta.keywordsHash,
          items: result.items,
          itemCount: result.itemCount,
          ...(orgChart ? { orgChart } : {}),
        });
      }
    }

    if (mode === 'business_division_map' && result.itemCount > 0) {
      orgChart = result.orgChart;
      try {
        if (!orgChart) {
          orgChart =
            await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
              result.items as OrgChartBuildCandidateRow[],
              {
                companyName: resolvedCompanyName,
                companyId,
                mode,
                function: body.functionRoot,
                companyLinkedinUrl: canonicalCompanyLinkedinUrl,
              },
            );
        }
      } catch (error) {
        this.logger.error(
          `Failed to build business division org chart for company="${resolvedCompanyName}"`,
          error as Error,
        );
        const buildFailureMessage =
          error instanceof Error
            ? error.message
            : 'Failed to build organization chart for this business division.';

        orgChartError = buildFailureMessage;
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: { message: buildFailureMessage },
        });
      }
    }

    return { orgChart, orgChartError };
  }

  async searchOrgchartFromLinkedIn(
    body: SearchOrgchartLinkedInBody,
    headers: Record<string, string>,
  ) {
    const apiToken = extractApiToken(headers);

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(`body:: ${JSON.stringify(body)}`);
    const canonicalCompanyLinkedinUrl =
      body.linkedinCompanyUrl?.trim().replace(/\/+$/, '') || undefined;
    const {
      companyName,
      companyId,
      jobTitles = [],
      mode,
      searchType = 'classic',
      requestId,
    } = body;

    if (body.candidateSource === 'apify' && mode !== 'entire_company') {
      throw new HttpException(
        'candidateSource "apify" is only supported for entire_company mode. Business division mapping and other filtered modes require LinkedIn (Unipile).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const resolvedCompanyName =
      companyName || (companyId ? String(companyId) : '');

    if (
      mode === 'business_division_map' &&
      !body.businessDivisionRawQuery?.trim()
    ) {
      throw new HttpException(
        'businessDivisionRawQuery is required when mode is business_division_map',
        HttpStatus.BAD_REQUEST,
      );
    }

    const requirementText = this.buildOrgchartSearchRequirementText(
      mode,
      resolvedCompanyName,
      jobTitles,
    );

    this.logger.log(
      `Orgchart search requested. Mode=${mode}, searchType=${searchType}, company="${resolvedCompanyName}", jobTitles=${JSON.stringify(
        jobTitles,
      )}, requirement="${requirementText}"`,
    );

    let shouldWriteCompanyOrgChartCache = true;

    if (mode === 'entire_company') {
      const filterState = this.getEntireCompanyFilterState(body);

      shouldWriteCompanyOrgChartCache =
        filterState.shouldWriteCompanyOrgChartCache;

      const cacheHit = await this.tryEntireCompanyOrgChartFromCachesAndS3({
        apiToken,
        mode,
        resolvedCompanyName,
        companyId,
        jobTitles,
        searchType,
        canonicalCompanyLinkedinUrl,
        requestId,
        filterState,
        shouldWriteCompanyOrgChartCache,
      });

      if (cacheHit) {
        return cacheHit;
      }
    }

    const apifyQueued = await this.maybeQueueApifyOrgChartBuild({
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      jobTitles,
      searchType,
      requestId,
      shouldWriteCompanyOrgChartCache,
    });

    if (apifyQueued) {
      return apifyQueued;
    }

    const linkedinXrayQueued =
      await this.maybeQueueLinkedinXrayOrgChartBuild({
        body,
        apiToken,
        mode,
        resolvedCompanyName,
        companyId,
      jobTitles,
      searchType,
      requestId,
      canonicalCompanyLinkedinUrl,
      shouldWriteCompanyOrgChartCache,
    });

    if (linkedinXrayQueued) {
      return linkedinXrayQueued;
    }

    const apolloPeopleResult = await this.runApolloOrgChartPeopleSearch({
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      requestId,
      searchType,
      jobTitles,
      canonicalCompanyLinkedinUrl,
    });

    if (apolloPeopleResult) {
      const { orgChart, orgChartError } =
        await this.buildOrgChartAfterLinkedInSearch({
          apiToken,
          body,
          mode,
          resolvedCompanyName,
          companyId,
          searchType,
          requestId,
          canonicalCompanyLinkedinUrl,
          shouldWriteCompanyOrgChartCache,
          result: apolloPeopleResult,
        });

      return {
        success: true,
        mode,
        searchType,
        companyName: resolvedCompanyName,
        jobTitles,
        itemCount: apolloPeopleResult.itemCount,
        items: apolloPeopleResult.items,
        orgChart,
        ...(orgChartError ? { orgChartError } : {}),
        isCached: false,
        cacheSource: 'none' as const,
        candidateSource: 'apollo' as const,
      };
    }

    const unipileQueued = await this.maybeQueueUnipileOrgChartBuild({
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      jobTitles,
      searchType,
      requestId,
      canonicalCompanyLinkedinUrl,
      shouldWriteCompanyOrgChartCache,
    });

    if (unipileQueued) {
      return unipileQueued;
    }

    const xrayResult = await this.runLinkedinXrayOrgChartSearch({
      body,
      apiToken,
      mode,
      resolvedCompanyName,
      companyId,
      requestId,
      searchType,
      canonicalCompanyLinkedinUrl,
    });

    if (xrayResult) {
      const { orgChart, orgChartError } =
        await this.buildOrgChartAfterLinkedInSearch({
          apiToken,
          body,
          mode,
          resolvedCompanyName,
          companyId,
          searchType,
          requestId,
          canonicalCompanyLinkedinUrl,
          shouldWriteCompanyOrgChartCache,
          result: xrayResult,
        });

      return {
        success: true,
        mode,
        searchType,
        companyName: resolvedCompanyName,
        jobTitles,
        itemCount: xrayResult.itemCount,
        items: xrayResult.items,
        orgChart,
        ...(orgChartError ? { orgChartError } : {}),
        isCached: false,
        cacheSource: 'none' as const,
        candidateSource: 'linkedin_xray' as const,
      };
    }

    const result =
      await this.orgChartSearchService.runOrgchartLinkedInSearch(
        body.rawQuery,
        body.cleanedQuery,
        searchType,
        apiToken,
        undefined,
        {
          mode,
          companyName: resolvedCompanyName,
          companyId,
          requestId,
          jobTitles: body.jobTitles,
          country: body.country,
          functionRoot: body.functionRoot,
          stdFunction: body.stdFunction,
          stdGrade: body.stdGrade,
          selectedNodeStdScopes: body.selectedNodeStdScopes,
          linkedinCompanyUrl: canonicalCompanyLinkedinUrl,
          linkedinUnipileAccountId: body.linkedinUnipileAccountId?.trim(),
          businessDivisionRawQuery: body.businessDivisionRawQuery?.trim(),
          validateAndScoreLinkedInResults:
            body.validateAndScoreLinkedInResults === true,
          queryGenerator: body.queryGenerator,
        },
      );

    const bodyForBuild: SearchOrgchartLinkedInBody = {
      ...body,
      ...(result.effectiveFunctionRoot !== undefined
        ? { functionRoot: result.effectiveFunctionRoot }
        : {}),
      ...(result.effectiveCountry !== undefined
        ? { country: result.effectiveCountry }
        : {}),
    };

    const { orgChart, orgChartError } =
      await this.buildOrgChartAfterLinkedInSearch({
        apiToken,
        body: bodyForBuild,
        mode,
        resolvedCompanyName,
        companyId,
        searchType,
        requestId,
        canonicalCompanyLinkedinUrl,
        shouldWriteCompanyOrgChartCache,
        result,
      });

    return {
      success: true,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      jobTitles,
      itemCount: result.itemCount,
      items: result.items,
      orgChart,
      ...(orgChartError ? { orgChartError } : {}),
      isCached: result.isCached ?? false,
      cacheSource: result.cacheSource ?? 'none',
    };
  }

  /**
   * Background worker: Apify company profile scraper → Python org chart (same cache/credits/S3 path as Unipile).
   */
  async handleApifyOrgChartJob(
    jobData: OrgchartApifyBuildJobData,
  ): Promise<void> {
    const {
      apiToken,
      requestId,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
    } = jobData;

    console.log("Org Chart Build :", jobData)
    const modeForOrgChartBuild: OrgchartSearchMode = jobData.mode;

    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      this.logger.log( `Apify org chart job skipped (cancelled) requestId=${requestId}`, );
      return;
    }

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode: modeForOrgChartBuild,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message: 'Running Apify company employee scraper…',
        candidateSource: 'apify',
      },
    });

    const apifyStrategyId = 'orgchart-apify-company-scraper';
    const apifyStrategyLabel = 'Apify company employees';
    let apifyReportedTotalProfiles: number | undefined;

    let items: TransformedCandidateForTable[] = [];

    try {
      items =
        await this.linkedInSearchService.fetchCompanyEmployeesViaApifyActor({
          linkedinCompanyUrl: jobData.linkedinCompanyUrl,
          maxItems: jobData.maxItems,
          profileScraperMode: jobData.profileScraperMode,
          defaultCompanyName: resolvedCompanyName,
          companyLinkedinUrl: jobData.linkedinCompanyUrl,
          jobTitles: jobData.jobTitles,
          onProgress: async (message) => {
            const parsed = parseApifyLinkedinCompanyScraperLogLine(message);
            console.log("This is parsed", parsed)
            if (parsed?.kind === 'profiles_total') {
              apifyReportedTotalProfiles = parsed.total;
              const approxPages = Math.max(1, Math.ceil(parsed.total / 25));
              
              await this.emitOrgchartSearchProgressForToken(apiToken, {
                requestId,
                mode: modeForOrgChartBuild,
                searchType,
                companyName: resolvedCompanyName,
                event: 'paginationInfo',
                data: {
                  strategyId: apifyStrategyId,
                  strategyLabel: apifyStrategyLabel,
                  totalCount: parsed.total,
                  totalPages: approxPages,
                  pageLimit: 25,
                  candidateSource: 'apify',
                },
              });
            }
            if (parsed?.kind === 'search_page') {
              const totalPages = apifyReportedTotalProfiles
                ? Math.max(1, Math.ceil(apifyReportedTotalProfiles / 25))
                : undefined;
              const totalCandidatesApprox = apifyReportedTotalProfiles
                ? Math.min(
                    apifyReportedTotalProfiles,
                    parsed.page * 25,
                  )
                : parsed.page * 25;
              await this.emitOrgchartSearchProgressForToken(apiToken, {
                requestId,
                mode: modeForOrgChartBuild,
                searchType,
                companyName: resolvedCompanyName,
                event: 'pageResults',
                data: {
                  page: parsed.page,
                  totalPages,
                  totalCandidates: totalCandidatesApprox,
                  candidatesReceived: parsed.profilesOnPage,
                  totalCountFromAPI: apifyReportedTotalProfiles,
                  remainingToFetch:
                    apifyReportedTotalProfiles != null
                      ? Math.max(
                          0,
                          apifyReportedTotalProfiles - totalCandidatesApprox,
                        )
                      : undefined,
                  strategyId: apifyStrategyId,
                  strategyLabel: apifyStrategyLabel,
                  candidateSource: 'apify',
                },
              });
            }
            await this.emitOrgchartSearchProgressForToken(apiToken, {
              requestId,
              mode: modeForOrgChartBuild,
              searchType,
              companyName: resolvedCompanyName,
              event: 'status',
              data: {
                message,
                candidateSource: 'apify',
              },
            });
          },
        });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Apify fetch failed';

      this.logger.error(
        `Apify org chart job fetch failed: ${msg}`,
        error as Error,
      );
      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        companyName: resolvedCompanyName,
        event: 'error',
        data: { message: msg, candidateSource: 'apify' },
      });

      return;
    }

    const result = { items, itemCount: items.length };

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode: modeForOrgChartBuild,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message: `Apify returned ${result.itemCount} profiles; building org chart…`,
        itemCount: result.itemCount,
        candidateSource: 'apify',
      },
    });

    if (result.itemCount === 0) {
      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        companyName: resolvedCompanyName,
        event: 'error',
        data: {
          message: 'Apify returned no employees for this company.',
          candidateSource: 'apify',
        },
      });

      return;
    }

    const cacheListMode = 'entire_company' as const;

    await this.orgChartCacheService.setCachedCompanyCandidateList({
      companyName: resolvedCompanyName,
      companyId,
      mode: cacheListMode,
      searchType,
      items: result.items,
      itemCount: result.itemCount,
    });

    let orgChart: OrgChartData | undefined;

    try {
      orgChart =
        await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
          result.items,
          {
            companyName: resolvedCompanyName,
            companyId,
            mode: modeForOrgChartBuild,
            function: jobData.functionRoot,
            companyLinkedinUrl:
              jobData.linkedinCompanyUrl?.trim().replace(/\/+$/, '') ||
              undefined,
          },
        );
    } catch (error) {
      this.logger.error(
        `Failed to build org chart from Apify profiles for company="${resolvedCompanyName}"`,
        error as Error,
      );
      const rawMsg = error instanceof Error ? error.message : '';
      const isFetchTransport =
        rawMsg === 'fetch failed' ||
        rawMsg.toLowerCase().includes('fetch failed');
      const buildFailureMessage =
        error instanceof Error
          ? isFetchTransport
            ? PythonOrgChartService.ORG_CHART_AGENT_UNAVAILABLE_MESSAGE
            : error.message
          : 'Failed to build organization chart after Apify people fetch.';

      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        companyName: resolvedCompanyName,
        event: 'error',
        data: { message: buildFailureMessage, candidateSource: 'apify' },
      });

      return;
    }

    const shouldWriteCompanyOrgChartCache =
      jobData.shouldWriteCompanyOrgChartCache;

    const shouldCacheBuiltOrgChartFromLinkedIn =
      orgChart &&
      this.orgChartCacheService.shouldCacheCompanyOrgChart({
        orgChart,
        fallbackCandidateCount: result.itemCount,
        companyName: resolvedCompanyName,
        companyId,
      });
    let creditsDebited = process.env.IS_BILLING_ENABLED !== 'true';

    if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const hasSufficient =
        await this.workspaceCreditsService.hasSufficientOrgChartCredits(
          workspaceId,
          result.itemCount,
        );

      if (!hasSufficient) {
        if (
          shouldCacheBuiltOrgChartFromLinkedIn &&
          shouldWriteCompanyOrgChartCache &&
          orgChart
        ) {
          await this.orgChartCacheService.setCachedCompanyOrgChart({
            companyName: resolvedCompanyName,
            companyId,
            mode: 'entire_company',
            searchType,
            orgChart,
            items: result.items,
            itemCount: result.itemCount,
            creditsDebited: false,
          });
        }
        const creditsNeeded =
          this.workspaceCreditsService.computeOrgChartCreditsNeeded(
            result.itemCount,
          );

        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: {
            message: `Insufficient org chart credits. Need ${creditsNeeded} credits for ${result.itemCount} employees.`,
            candidateSource: 'apify',
          },
        });

        return;
      }
      const creditMetaFresh = await this.buildOrgChartCreditMetadata(
        apiToken,
        companyId,
        resolvedCompanyName,
      );

      await this.workspaceCreditsService.debitOrgChartCredits(
        workspaceId,
        result.itemCount,
        {
          companyName: resolvedCompanyName,
          companyId,
          orgChartS3RelativePath: creditMetaFresh.orgChartS3RelativePath,
          ...(creditMetaFresh.workspaceMemberId && {
            workspaceMemberId: creditMetaFresh.workspaceMemberId,
          }),
        },
      );
      creditsDebited = true;
    }

    if (
      shouldCacheBuiltOrgChartFromLinkedIn &&
      shouldWriteCompanyOrgChartCache &&
      orgChart
    ) {
      await this.orgChartCacheService.setCachedCompanyOrgChart({
        companyName: resolvedCompanyName,
        companyId,
        mode: 'entire_company',
        searchType,
        orgChart,
        items: result.items,
        itemCount: result.itemCount,
        creditsDebited,
      });

      const s3CompanyId = this.orgChartS3Service.persistedCompanyFolderKey(
        companyId,
        resolvedCompanyName,
      );

      await Promise.all([
        this.orgChartS3Service.saveOrgChart(s3CompanyId, orgChart),
        this.orgChartS3Service.saveCandidates(s3CompanyId, result.items),
      ]);

      const creditMetaForRowApify = await this.buildOrgChartCreditMetadata(
        apiToken,
        companyId,
        resolvedCompanyName,
      );

      await this.orgChartRecordWorkspaceService.tryPersistOrgChartRecord({
        apiToken,
        mode: modeForOrgChartBuild,
        searchType,
        resolvedCompanyName,
        companyId,
        linkedinCompanyUrl: jobData.linkedinCompanyUrl,
        itemCount: result.itemCount,
        orgChartS3RelativePath: creditMetaForRowApify.orgChartS3RelativePath,
        functionRoot: jobData.functionRoot,
        country: jobData.country,
      });

      if (process.env.IS_BILLING_ENABLED !== 'true' && apiToken) {
        const workspaceIdForGrant =
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        const creditMetaGrant = await this.buildOrgChartCreditMetadata(
          apiToken,
          companyId,
          resolvedCompanyName,
        );

        if (workspaceIdForGrant && creditMetaGrant.workspaceMemberId) {
          await this.creditTransactionService.recordOrgChartAccessGrant({
            workspaceId: workspaceIdForGrant,
            workspaceMemberId: creditMetaGrant.workspaceMemberId,
            orgChartS3RelativePath: creditMetaGrant.orgChartS3RelativePath,
            companyName: creditMetaGrant.companyName,
            companyId: creditMetaGrant.companyId,
            employeeCount: result.itemCount,
          });
        }
      }

      const orgChartJobNameSuffix = jobData.functionRoot
        ? jobData.functionRoot.replace(/\s+/g, '-').toLowerCase()
        : 'entire';
      const orgChartJobName = `orgchart-${resolvedCompanyName.replace(/\s+/g, '-')}-${orgChartJobNameSuffix}`;

      try {
        await this.staticGraphQLService.executeGraphQL(
          graphqlToAddNewJob,
          { input: { name: orgChartJobName, position: 'first' } },
          apiToken,
        );
        this.logger.log(
          `Created org chart job "${orgChartJobName}" for company="${resolvedCompanyName}" (Apify)`,
        );
      } catch (jobError) {
        this.logger.warn(
          `Could not create org chart job "${orgChartJobName}": ${(jobError as Error).message}`,
        );
      }
    }

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode: modeForOrgChartBuild,
      searchType,
      companyName: resolvedCompanyName,
      event: 'complete',
      data: {
        message: `Org chart ready (${result.itemCount} employees via Apify).`,
        itemCount: result.itemCount,
        candidateSource: 'apify',
        orgChart,
        items: result.items,
      },
    });
  }

  async handleLinkedinXrayOrgChartJob(
    jobData: OrgchartLinkedinXrayBuildJobData,
  ): Promise<void> {
    const {
      apiToken,
      requestId,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
      linkedinCompanyUrl,
    } = jobData;

    const modeForOrgChartBuild = jobData.mode;

    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      this.logger.log(
        `LinkedIn x-ray org chart job skipped (cancelled) requestId=${requestId}`,
      );

      return;
    }

    const body: SearchOrgchartLinkedInBody = {
      rawQuery: jobData.rawQuery,
      cleanedQuery: jobData.cleanedQuery,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles: jobData.jobTitles,
      mode: modeForOrgChartBuild,
      searchType,
      requestId,
      country: jobData.country,
      functionRoot: jobData.functionRoot,
      stdFunction: jobData.stdFunction,
      stdGrade: jobData.stdGrade,
      selectedNodeStdScopes: jobData.selectedNodeStdScopes,
      candidateSource: 'linkedin_xray',
      linkedinCompanyUrl,
      businessDivisionRawQuery: jobData.businessDivisionRawQuery,
      xraySearchEngine: jobData.xraySearchEngine,
      includePaginatedHtml: jobData.includePaginatedHtml,
    };

    try {
      const result = await this.runLinkedinXrayOrgChartSearch({
        body,
        apiToken,
        mode: modeForOrgChartBuild,
        resolvedCompanyName,
        companyId,
        requestId,
        searchType,
        canonicalCompanyLinkedinUrl: linkedinCompanyUrl,
      });
      console.log("REsult:", result)

      if (!result) {
        if (requestId) {
          this.orgchartCancelRegistry.setFailed(
            requestId,
            'LinkedIn x-ray job did not produce a result.',
          );
        }
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: {
            message: 'LinkedIn x-ray job did not produce a result.',
            candidateSource: 'linkedin_xray',
          },
        });

        return;
      }

      if (result.itemCount === 0) {
        if (requestId) {
          this.orgchartCancelRegistry.setFailed(
            requestId,
            'LinkedIn x-ray returned no matching employees.',
          );
        }
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: {
            message: 'LinkedIn x-ray returned no matching employees.',
            candidateSource: 'linkedin_xray',
          },
        });

        return;
      }

      const { orgChart, orgChartError } =
        await this.buildOrgChartAfterLinkedInSearch({
          apiToken,
          body,
          mode: modeForOrgChartBuild,
          resolvedCompanyName,
          companyId,
          searchType,
          requestId,
          canonicalCompanyLinkedinUrl: linkedinCompanyUrl,
          shouldWriteCompanyOrgChartCache:
            jobData.shouldWriteCompanyOrgChartCache,
          result,
        });

      if (orgChartError) {
        if (requestId) {
          this.orgchartCancelRegistry.setFailed(requestId, orgChartError);
        }
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: {
            message: orgChartError,
            candidateSource: 'linkedin_xray',
          },
        });

        return;
      }

      if (requestId) {
        this.orgchartCancelRegistry.setCompleted(requestId);
      }

      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        companyName: resolvedCompanyName,
        event: 'complete',
        data: {
          message: `Org chart ready (${result.itemCount} employees via LinkedIn x-ray).`,
          itemCount: result.itemCount,
          candidateSource: 'linkedin_xray',
          orgChart,
          items: result.items,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'LinkedIn x-ray org chart build failed.';

      this.logger.error(
        `LinkedIn x-ray org chart job failed for company="${resolvedCompanyName}": ${message}`,
        error as Error,
      );

      if (requestId) {
        this.orgchartCancelRegistry.setFailed(requestId, message);
      }

      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        companyName: resolvedCompanyName,
        event: 'error',
        data: {
          message,
          candidateSource: 'linkedin_xray',
        },
      });
    }
  }

  async handleUnipileOrgChartJob(
    jobData: OrgchartUnipileBuildJobData,
  ): Promise<void> {
    const {
      apiToken,
      requestId,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
      linkedinCompanyUrl,
    } = jobData;

    const modeForOrgChartBuild: OrgchartSearchMode = jobData.mode;
    console.log("Job Data for Org chart build:", jobData);
    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      this.logger.log(
        `Unipile org chart job skipped (cancelled) requestId=${requestId}`,
      );

      return;
    }

    const body: SearchOrgchartLinkedInBody = {
      rawQuery: jobData.rawQuery,
      cleanedQuery: jobData.cleanedQuery,
      companyName: resolvedCompanyName,
      companyId,
      jobTitles: jobData.jobTitles,
      mode: modeForOrgChartBuild,
      searchType,
      requestId,
      country: jobData.country,
      functionRoot: jobData.functionRoot,
      stdFunction: jobData.stdFunction,
      stdGrade: jobData.stdGrade,
      selectedNodeStdScopes: jobData.selectedNodeStdScopes,
      candidateSource: 'unipile',
      linkedinCompanyUrl,
      linkedinUnipileAccountId: jobData.linkedinUnipileAccountId,
      businessDivisionRawQuery: jobData.businessDivisionRawQuery,
    };

    try {
      const result = await this.orgChartSearchService.runOrgchartLinkedInSearch(
        body.rawQuery,
        body.cleanedQuery,
        searchType,
        apiToken,
        undefined,
        {
          mode: modeForOrgChartBuild,
          companyName: resolvedCompanyName,
          companyId,
          requestId,
          jobTitles: body.jobTitles,
          country: body.country,
          functionRoot: body.functionRoot,
          stdFunction: body.stdFunction,
          stdGrade: body.stdGrade,
          selectedNodeStdScopes: body.selectedNodeStdScopes,
          linkedinCompanyUrl,
          linkedinUnipileAccountId: body.linkedinUnipileAccountId?.trim(),
          businessDivisionRawQuery: body.businessDivisionRawQuery?.trim(),
        },
      );

      if (result.itemCount === 0) {
        if (requestId) {
          this.orgchartCancelRegistry.setFailed(
            requestId,
            'LinkedIn returned no matching employees.',
          );
        }
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: {
            message: 'LinkedIn returned no matching employees.',
            candidateSource: 'unipile',
          },
        });

        return;
      }

      const bodyForBuild: SearchOrgchartLinkedInBody = {
        ...body,
        ...(result.effectiveFunctionRoot !== undefined
          ? { functionRoot: result.effectiveFunctionRoot }
          : {}),
        ...(result.effectiveCountry !== undefined
          ? { country: result.effectiveCountry }
          : {}),
      };

      const { orgChart, orgChartError } =
        await this.buildOrgChartAfterLinkedInSearch({
          apiToken,
          body: bodyForBuild,
          mode: modeForOrgChartBuild,
          resolvedCompanyName,
          companyId,
          searchType,
          requestId,
          canonicalCompanyLinkedinUrl: linkedinCompanyUrl,
          shouldWriteCompanyOrgChartCache:
            jobData.shouldWriteCompanyOrgChartCache,
          result,
        });

      if (orgChartError) {
        if (requestId) {
          this.orgchartCancelRegistry.setFailed(requestId, orgChartError);
        }
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'error',
          data: {
            message: orgChartError,
            candidateSource: 'unipile',
          },
        });

        return;
      }

      if (requestId) {
        this.orgchartCancelRegistry.setCompleted(requestId);
      }

      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        companyName: resolvedCompanyName,
        event: 'complete',
        data: {
          message: `Org chart ready (${result.itemCount} employees via LinkedIn).`,
          itemCount: result.itemCount,
          candidateSource: 'unipile',
          orgChart,
          items: result.items,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'LinkedIn org chart build failed.';

      this.logger.error(
        `Unipile org chart job failed for company="${resolvedCompanyName}": ${message}`,
        error as Error,
      );

      if (requestId) {
        this.orgchartCancelRegistry.setFailed(requestId, message);
      }

      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        companyName: resolvedCompanyName,
        event: 'error',
        data: {
          message,
          candidateSource: 'unipile',
        },
      });
    }
  }

  /**
   * Org chart progress for Unipile, Apify, and LinkedIn x-ray (sync + queue workers).
   * Uses Redis pub/sub; the HTTP process forwards to Socket.IO (see OrgChartProgressBridgeService).
   */
  private async emitOrgchartSearchProgressForToken(
    apiToken: string,
    payload: {
      requestId?: string;
      mode: OrgchartSearchMode;
      searchType: OrgchartSearchType;
      companyName: string;
      event: string;
      data: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const authContext =
        await this.workspaceQueryService.accessTokenService.validateToken(
          apiToken,
        );
      const workspaceMemberId = authContext.workspaceMemberId;

      if (!workspaceMemberId) {
        return;
      }
      const progressPayload = {
        event: payload.event,
        requestId: payload.requestId,
        mode: payload.mode,
        searchType: payload.searchType,
        companyName: payload.companyName,
        data: payload.data,
      };

      console.log("Payload : ", payload)
      await this.orgChartProgressRedisService.publish(
        workspaceMemberId,
        progressPayload,
      );
    } catch {
      // Invalid token or missing member id — response body still carries orgChartError.
    }
  }

  cancelOrgchartSearch(
    body: { requestId: string },
    headers: Record<string, string>,
  ) {
    const apiToken = extractApiToken(headers);

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }
    const { requestId } = body;

    if (!requestId || typeof requestId !== 'string') {
      throw new HttpException('requestId is required', HttpStatus.BAD_REQUEST);
    }
    this.orgchartCancelRegistry.setCancelled(requestId);
    this.logger.log(`Orgchart search cancelled. requestId=${requestId}`);

    return { success: true, requestId };
  }
}
