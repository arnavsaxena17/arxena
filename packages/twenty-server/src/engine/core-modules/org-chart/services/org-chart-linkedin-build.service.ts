import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { graphqlToAddNewJob, OrgChartData } from 'twenty-shared';

import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import type { OrgchartApifyBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-apify-build.types';
import { CandidateSearchHandlerService } from 'src/engine/core-modules/candidate-search/services/candidate-search-handler.service';
import { OrgchartCancelRegistryService } from 'src/engine/core-modules/candidate-search/services/orgchart-cancel-registry.service';
import { extractApiToken } from 'src/engine/core-modules/candidate-search/utils/auth.utils';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/candidate-search/utils/orgchart-filter.util';
import { CandidateDataService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-data.service';
import type { TransformedCandidateForTable } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { OrgChartS3Service } from './orgchart-s3.service';
import { PythonOrgChartService } from './python-org-chart.service';

type OrgchartSearchMode =
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'function_grade'
  | 'all_people'
  | 'selected_nodes';

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

@Injectable()
export class OrgChartLinkedInBuildService {
  private readonly logger = new Logger(OrgChartLinkedInBuildService.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly creditTransactionService: CreditTransactionService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly orgchartCancelRegistry: OrgchartCancelRegistryService,
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly candidateDataService: CandidateDataService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly apifyService: ApifyService,
    @InjectMessageQueue(MessageQueue.orgchartApifyQueue)
    private readonly orgchartApifyQueue: MessageQueueService,
  ) {}

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
        await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
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

  async searchOrgchartFromLinkedIn(
    body: {
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
      /** Default Unipile; `apify` uses Apify company profile scraper (queued, long-running). */
      candidateSource?: 'unipile' | 'apify';
      linkedinCompanyUrl?: string;
      apifyMaxItems?: number;
      profileScraperMode?: string;
    },
    headers: Record<string, string>,
  ) {
    const apiToken = extractApiToken(headers);

    if (!apiToken) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log('body::', body);
    const {
      companyName,
      companyId,
      jobTitles = [],
      mode,
      searchType = 'classic',
      requestId,
      country,
      functionRoot,
    } = body;

    if (
      body.candidateSource === 'apify' &&
      mode !== 'entire_company' &&
      mode !== 'all_people'
    ) {
      throw new HttpException(
        'candidateSource "apify" is only supported for entire_company or all_people modes',
        HttpStatus.BAD_REQUEST,
      );
    }

    const resolvedCompanyName =
      companyName || (companyId ? String(companyId) : '');

    let requirement: string;

    switch (mode) {
      case 'leadership':
        requirement = `Find all leadership positions at ${resolvedCompanyName}.`;
        break;
      case 'entire_company':
      case 'all_people':
        requirement = `Find all people currently working at ${resolvedCompanyName}.`;
        break;
      case 'function_grade': {
        const titlesText =
          jobTitles && jobTitles.length > 0
            ? jobTitles.join(', ')
            : 'the relevant function and seniority described by the node';

        requirement = `Find people at ${resolvedCompanyName} with job titles similar to: ${titlesText}.`;
        break;
      }
      case 'selected_nodes':
        requirement = `Find people for the selected nodes at ${resolvedCompanyName}.`;
        break;
      case 'current_node':
      default: {
        const titlesText =
          jobTitles && jobTitles.length > 0
            ? jobTitles.join(', ')
            : 'this role';

        requirement = `Find people matching ${titlesText} at ${resolvedCompanyName}.`;
        break;
      }
    }

    this.logger.log(
      `Orgchart search requested. Mode=${mode}, searchType=${searchType}, company="${resolvedCompanyName}", jobTitles=${JSON.stringify(
        jobTitles,
      )}`,
    );

    let orgChartError: string | undefined;

    let shouldWriteCompanyOrgChartCache = true;

    if (mode === 'entire_company') {
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

      shouldWriteCompanyOrgChartCache =
        !hasCountryFilter && !hasFunctionRootFilter;

      const applyFiltersToItems = (items: any[]): any[] => {
        if (!hasCountryFilter && !hasFunctionRootFilter) {
          return items;
        }

        return items.filter((item) => {
          const raw = item as Record<string, unknown>;

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
      };

      const isFullCompanyOrgChartPayload = (
        orgChartPayload: unknown,
      ): boolean => {
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
      };

      const cachedOrgChart =
        await this.candidateSearchHandlerService.getCachedCompanyOrgChart({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedOrgChart) {
        if (
          !hasCountryFilter &&
          !hasFunctionRootFilter &&
          !isFullCompanyOrgChartPayload(cachedOrgChart.orgChart)
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
              ? cachedOrgChart.items
              : [];
            const filteredItems = applyFiltersToItems(baseItems);
            const orgChartForResponse =
              hasCountryFilter || hasFunctionRootFilter
                ? await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
                    filteredItems,
                    {
                      companyName: resolvedCompanyName,
                      companyId,
                      mode: 'entire_company',
                      function: hasFunctionRootFilter
                        ? normalizedFunctionRootRaw
                        : undefined,
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
            };
          }
          if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
            const workspaceId =
              await this.workspaceQueryService.getWorkspaceIdFromToken(
                apiToken,
              );
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
            await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
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
            ? cachedOrgChart.items
            : [];
          const filteredItems = applyFiltersToItems(baseItems);
          const orgChartForResponse =
            hasCountryFilter || hasFunctionRootFilter
              ? await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
                  filteredItems,
                  {
                    companyName: resolvedCompanyName,
                    companyId,
                    mode: 'entire_company',
                    function: hasFunctionRootFilter
                      ? normalizedFunctionRootRaw
                      : undefined,
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
          };
        }
      }

      const cachedCandidateList =
        await this.candidateSearchHandlerService.getCachedCompanyCandidateList({
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
            ? cachedCandidateList.items
            : [];
          const filteredItems = applyFiltersToItems(baseItems);
          const orgChartFromCache =
            await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
              filteredItems,
              {
                companyName: resolvedCompanyName,
                companyId,
                mode,
                function: hasFunctionRootFilter
                  ? normalizedFunctionRootRaw
                  : undefined,
              },
            );
          const shouldCacheBuiltOrgChartFromCandidateList =
            this.candidateSearchHandlerService.shouldCacheCompanyOrgChart({
              orgChart: orgChartFromCache,
              fallbackCandidateCount: cachedCandidateList.itemCount,
              companyName: resolvedCompanyName,
              companyId,
            });
          let creditsDebited = process.env.IS_BILLING_ENABLED !== 'true';

          if (process.env.IS_BILLING_ENABLED === 'true' && apiToken) {
            const workspaceId =
              await this.workspaceQueryService.getWorkspaceIdFromToken(
                apiToken,
              );
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
                await this.candidateSearchHandlerService.setCachedCompanyOrgChart(
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
            await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
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

          orgChartError = buildFailureMessage;
          await this.emitOrgchartSearchProgressForToken(apiToken, {
            requestId,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            event: 'error',
            data: { message: buildFailureMessage },
          });
          const baseItems = Array.isArray(cachedCandidateList.items)
            ? cachedCandidateList.items
            : [];
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
            orgChartError,
            isCached: true,
            cacheSource: 'candidate_list',
            cachedAt: cachedCandidateList.cachedAt,
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
          isFullCompanyOrgChartPayload(s3OrgChart)
        ) {
          this.logger.log(
            `Serving org chart from S3 for company="${resolvedCompanyName}" (${s3Candidates.length} candidates, key=${s3PersistKey})`,
          );
          await this.candidateSearchHandlerService.setCachedCompanyCandidateList(
            {
              companyName: resolvedCompanyName,
              companyId,
              mode: 'entire_company',
              searchType,
              items: s3Candidates,
              itemCount: s3Candidates.length,
            },
          );
          await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
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
    }

    if (
      body.candidateSource === 'apify' &&
      (mode === 'entire_company' || mode === 'all_people')
    ) {
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
        mode: mode === 'all_people' ? 'all_people' : 'entire_company',
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

      await this.orgchartApifyQueue.add('OrgchartApifyBuildProcessor', jobData);

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

    if (requestId) {
      this.orgchartCancelRegistry.register(requestId);
    }

    const result =
      await this.candidateSearchHandlerService.runOrgchartLinkedInSearch(
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
        },
      );

    let orgChart: OrgChartData | undefined;

    if (mode === 'entire_company' && result.itemCount > 0) {
      await this.candidateSearchHandlerService.setCachedCompanyCandidateList({
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
          await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
            result.items,
            {
              companyName: resolvedCompanyName,
              companyId,
              mode,
              // When a functionRoot filter is provided, pass it down so that
              // the Python org-chart pipeline can build a function-specific
              // chart instead of always returning the full company.
              function: body.functionRoot,
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
        this.candidateSearchHandlerService.shouldCacheCompanyOrgChart({
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
            await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
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
        await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
          orgChart,
          items: result.items,
          itemCount: result.itemCount,
          creditsDebited,
        });

        // Persist org chart and candidates to S3 for durable retrieval after Redis expiry.
        const s3CompanyId = this.orgChartS3Service.persistedCompanyFolderKey(
          companyId,
          resolvedCompanyName,
        );

        await Promise.all([
          this.orgChartS3Service.saveOrgChart(s3CompanyId, orgChart),
          this.orgChartS3Service.saveCandidates(s3CompanyId, result.items),
        ]);

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

        // Create a job record in the workspace for this org chart.
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

    // Build and return org chart for function-root scoped searches as well.
    // This keeps the candidate list payload while enabling the org chart UI to render.
    if (mode === 'function_grade' && result.itemCount > 0) {
      orgChart = result.orgChart;
      try {
        if (!orgChart) {
          orgChart =
            await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
              result.items,
              {
                companyName: resolvedCompanyName,
                companyId,
                mode,
                function: body.functionRoot,
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
        await this.candidateSearchHandlerService.setCachedFunctionGradeSearch({
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
  async handleApifyOrgChartJob(jobData: OrgchartApifyBuildJobData): Promise<void> {
    const {
      apiToken,
      requestId,
      searchType,
      companyName: resolvedCompanyName,
      companyId,
    } = jobData;

    const modeForOrgChartBuild: OrgchartSearchMode =
      jobData.mode === 'all_people' ? 'all_people' : 'entire_company';

    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      this.logger.log(
        `Apify org chart job skipped (cancelled) requestId=${requestId}`,
      );
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

    let items: TransformedCandidateForTable[] = [];

    try {
      items = await this.linkedInSearchService.fetchCompanyEmployeesViaApifyActor({
        linkedinCompanyUrl: jobData.linkedinCompanyUrl,
        maxItems: jobData.maxItems,
        profileScraperMode: jobData.profileScraperMode,
        defaultCompanyName: resolvedCompanyName,
        companyLinkedinUrl: jobData.linkedinCompanyUrl,
        jobTitles: jobData.jobTitles,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Apify fetch failed';
      this.logger.error(`Apify org chart job fetch failed: ${msg}`, error as Error);
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

    await this.candidateSearchHandlerService.setCachedCompanyCandidateList({
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
        await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
          result.items,
          {
            companyName: resolvedCompanyName,
            companyId,
            mode: modeForOrgChartBuild,
            function: jobData.functionRoot,
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

    const shouldWriteCompanyOrgChartCache = jobData.shouldWriteCompanyOrgChartCache;

    const shouldCacheBuiltOrgChartFromLinkedIn =
      orgChart &&
      this.candidateSearchHandlerService.shouldCacheCompanyOrgChart({
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
          await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
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
      await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
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
      this.workspaceQueryService.webSocketService.sendToUser(
        workspaceMemberId,
        'orgchart-search-progress',
        {
          event: payload.event,
          requestId: payload.requestId,
          mode: payload.mode,
          searchType: payload.searchType,
          companyName: payload.companyName,
          data: payload.data,
        },
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
