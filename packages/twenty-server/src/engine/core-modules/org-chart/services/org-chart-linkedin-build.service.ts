import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import {
  graphqlToAddNewJob,
  OrgChartData,
  OrgchartSearchMode,
} from 'twenty-shared';

import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { BrightDataLinkedinPeopleSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-linkedin-people-search.service';
import { BrightDataLinkedinProfileScrapeService } from 'src/engine/core-modules/bright-data/services/bright-data-linkedin-profile-scrape.service';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { OrgchartApifyBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-apify-build.types';
import { OrgchartApolloBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-apollo-build.types';
import { OrgchartLinkedinXrayBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-linkedin-xray-build.types';
import { OrgchartMultiSourceBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-multisource-build.types';
import { OrgchartUnipileBuildJobData } from 'src/engine/core-modules/candidate-search/jobs/orgchart-unipile-build.types';
import {
  ApolloIoRestService,
  ApolloPeopleSearchParams,
  isApolloOrganizationId,
} from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { ApolloPeopleSearchTransformerService } from 'src/engine/core-modules/candidate-search/services/apollo-people-search-transformer.service';
import { OrgChartSearchService } from 'src/engine/core-modules/candidate-search/services/orgchart-search.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';
import { ResultValidationService } from 'src/engine/core-modules/candidate-search/services/result-validation.service';
import { extractApiToken } from 'src/engine/core-modules/candidate-search/utils/auth.utils';
import { CandidateDataService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-data.service';
import { TransformedCandidateForTable } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { LinkedinXrayTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-xray-transformer.service';
import { OrgChartProgressRedisService } from 'src/engine/core-modules/candidate-sourcing/services/orgchart-progress-redis.service';
import { linkedInPeopleSearchResultMatchesTargetCompany } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-orgchart-company-match.util';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  LinkedInSearchService,
  parseApifyLinkedinCompanyScraperLogLine,
} from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { OrgChartCacheService } from 'src/engine/core-modules/org-chart/services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from 'src/engine/core-modules/org-chart/services/orgchart-cancel-registry.service';
import { OrgChartLinkedinCandidateSource } from 'src/engine/core-modules/org-chart/types/orgchart-linkedin-candidate-source.type';
import { dedupeAndMergeOrgChartCandidates } from 'src/engine/core-modules/org-chart/utils/orgchart-candidate-dedupe.util';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import { filterOrgChartCandidatesByNodeStdLabels } from 'src/engine/core-modules/org-chart/utils/orgchart-node-scope-filter.util';
import {
  normalizeCompanyId,
  normalizeCompanyName,
  normalizeCountry,
} from 'src/engine/core-modules/org-chart/utils/orgchart-normalization.util';
import { TheOfficialBoardService } from 'src/engine/core-modules/theofficialboard/services/theofficialboard.service';
import { TheOfficialBoardCandidate } from 'src/engine/core-modules/theofficialboard/types/theofficialboard.types';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';
import { TheOrgPerson } from 'src/engine/core-modules/theorg/types/theorg.types';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { LinkedinXrayService } from 'src/modules/linkedin-xray/linkedin-xray.service';
import { LinkedinXraySearchEngine } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

import { ContactOutPeopleSearchService } from './contactout-people-search.service';
import { OrgChartRecordWorkspaceService } from './org-chart-record-workspace.service';
import { OrgChartIncrementalBuildCacheService } from './orgchart-incremental-build-cache.service';
import { OrgChartS3Service } from './orgchart-s3.service';
import { PythonOrgChartService } from './python-org-chart.service';

/** Matches OrgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates input rows */
type OrgChartBuildCandidateRow =
  | TransformedCandidateForTable
  | Record<string, unknown>;

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';
const APIFY_ORG_INTELLIGENCE_SOURCE_TAG = 'apify-org-intelligence';

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
  multiSource?: boolean;
  sources?: string[];
  linkedinCompanyUrl?: string;
  /** Primary email/web domain for the target company (e.g. "litify.com"). When
   *  ORGCHART_APOLLO_SKIP_RESOLUTION is enabled, this is passed directly as
   *  q_organization_domains_list[] on Apollo People Search so the flow skips
   *  the /mixed_companies/search resolution hop. */
  companyDomain?: string;
  apifyMaxItems?: number;
  profileScraperMode?: string;
  includeOrgIntelligence?: boolean;
  linkedinUnipileAccountId?: string;
  /** NL business division query; requires Unipile (not Apify) */
  businessDivisionRawQuery?: string;
  /** When true, LLM validation/scoring on LinkedIn hit lists. Default false. */
  validateAndScoreLinkedInResults?: boolean;
  queryGenerator?: 'python' | 'multi_agent';
  xraySearchEngine?: LinkedinXraySearchEngine;
  includePaginatedHtml?: boolean;
  /** Raw industry label (e.g. "Computer Software") forwarded to Python list_data.industry */
  industry?: string;
  /** Macro category override forwarded to Python list_data.industry_category */
  industryCategory?: string;
  /** Optional MonthYear snapshot filter (YYYY-MM). When set, org chart is built from candidates active during that month. */
  asOfMonth?: string;
  /** Company site URL; used to derive `companyDomain` for Apollo when explicit domain is absent. */
  website?: string;
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
    private readonly orgChartIncrementalBuildCache: OrgChartIncrementalBuildCacheService,
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
    private readonly contactOutPeopleSearchService: ContactOutPeopleSearchService,
    private readonly environmentService: EnvironmentService,
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly theOrgService: TheOrgService,
    private readonly theOfficialBoardService: TheOfficialBoardService,
    @InjectMessageQueue(MessageQueue.orgchartApifyQueue)
    private readonly orgchartApifyQueue: MessageQueueService,
  ) {}

  async rebuildOrgChartUsingSavedPeople(input: {
    apiToken: string;
    companyId?: string;
    companyName?: string;
    industry?: string;
    industryCategory?: string;
    /** When set, same semantics as org-chart search: snapshot active titles at this month. */
    asOfMonth?: string;
    /** Canonical company LinkedIn URL for matching experience rows when the display name differs. */
    companyLinkedinUrl?: string;
  }): Promise<{
    success: true;
    companyName: string;
    companyId: string;
    itemCount: number;
    items: Record<string, unknown>[];
    orgChart: OrgChartData;
    candidateSource: 'saved_people';
  }> {
    const resolvedCompanyName = normalizeCompanyName(input.companyName);
    const resolvedCompanyId = normalizeCompanyId(
      input.companyId,
      resolvedCompanyName,
    );

    const cachedCandidateList =
      await this.orgChartCacheService.getCachedCompanyCandidateList({
        companyName: resolvedCompanyName,
        companyId: resolvedCompanyId,
        mode: 'entire_company',
        searchType: 'classic',
      });

    let savedItems = Array.isArray(cachedCandidateList?.items)
      ? (cachedCandidateList?.items as Record<string, unknown>[])
      : [];

    if (savedItems.length === 0) {
      const s3PersistKey = this.orgChartS3Service.persistedCompanyFolderKey(
        resolvedCompanyId,
        resolvedCompanyName || resolvedCompanyId,
      );
      const s3Candidates = await this.orgChartS3Service.getCandidates(s3PersistKey);
      savedItems = Array.isArray(s3Candidates)
        ? (s3Candidates as Record<string, unknown>[])
        : [];
    }

    if (savedItems.length === 0) {
      throw new HttpException(
        'No saved people found for this company. Generate a full org chart first.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.orgChartCacheService.invalidateEntireCompanyClassicCaches({
      companyName: resolvedCompanyName,
      companyId: resolvedCompanyId,
    });
    const s3CompanyId = this.orgChartS3Service.persistedCompanyFolderKey(
      resolvedCompanyId,
      resolvedCompanyName || resolvedCompanyId,
    );
    await this.orgChartS3Service.deletePersistedCompanyFolder(s3CompanyId);

    const orgChart =
      await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
        savedItems as OrgChartBuildCandidateRow[],
        {
          companyName: resolvedCompanyName || resolvedCompanyId,
          companyId: resolvedCompanyId,
          mode: 'entire_company',
          industry: input.industry,
          industryCategory: input.industryCategory,
          companyLinkedinUrl: input.companyLinkedinUrl?.trim() || undefined,
          asOfMonth: input.asOfMonth?.trim() || undefined,
        },
      );

    await this.orgChartCacheService.setCachedCompanyCandidateList({
      companyName: resolvedCompanyName,
      companyId: resolvedCompanyId,
      mode: 'entire_company',
      searchType: 'classic',
      items: savedItems,
      itemCount: savedItems.length,
    });
    await this.orgChartCacheService.setCachedCompanyOrgChart({
      companyName: resolvedCompanyName,
      companyId: resolvedCompanyId,
      mode: 'entire_company',
      searchType: 'classic',
      orgChart,
      items: savedItems,
      itemCount: savedItems.length,
      creditsDebited: true,
    });
    await Promise.all([
      this.orgChartS3Service.saveOrgChart(s3CompanyId, orgChart),
      this.orgChartS3Service.saveCandidates(s3CompanyId, savedItems),
    ]);

    const creditMetaForRow = await this.buildOrgChartCreditMetadata(
      input.apiToken,
      resolvedCompanyId,
      resolvedCompanyName,
    );
    await this.orgChartRecordWorkspaceService.tryPersistOrgChartRecord({
      apiToken: input.apiToken,
      mode: 'entire_company',
      searchType: 'classic',
      resolvedCompanyName: resolvedCompanyName || resolvedCompanyId,
      companyId: resolvedCompanyId,
      itemCount: savedItems.length,
      orgChartS3RelativePath: creditMetaForRow.orgChartS3RelativePath,
    });

    return {
      success: true,
      companyName: resolvedCompanyName || resolvedCompanyId,
      companyId: resolvedCompanyId,
      itemCount: savedItems.length,
      items: savedItems,
      orgChart,
      candidateSource: 'saved_people',
    };
  }

  private contactOutProfilesToCandidates(
    profiles: Array<{
      linkedinUrl: string;
      profile: Record<string, unknown>;
    }>,
    companyName: string,
    companyLinkedinUrl?: string,
  ): Array<Record<string, unknown>> {
    const normalizedCompany = companyName.trim();

    return profiles.map(({ linkedinUrl, profile }, index) => {
      const p = profile as {
        full_name?: unknown;
        title?: unknown;
        headline?: unknown;
        location?: unknown;
        country?: unknown;
        industry?: unknown;
        profile_picture_url?: unknown;
        experience?: unknown;
      };
      const fullName =
        typeof p.full_name === 'string' && p.full_name.trim()
          ? p.full_name.trim()
          : `Unknown ${index + 1}`;
      const headline = typeof p.headline === 'string' ? p.headline.trim() : '';
      const title = typeof p.title === 'string' ? p.title.trim() : '';
      const location = typeof p.location === 'string' ? p.location.trim() : '';
      const country = typeof p.country === 'string' ? p.country.trim() : '';
      const industry = typeof p.industry === 'string' ? p.industry.trim() : '';
      const profilePictureUrl =
        typeof p.profile_picture_url === 'string'
          ? p.profile_picture_url.trim()
          : '';

      return {
        id: `contactout_${index}_${fullName.replace(/\s+/g, '_')}`,
        name: fullName,
        first_name: fullName.split(/\s+/)[0] ?? '',
        last_name: fullName.split(/\s+/).slice(1).join(' ') ?? '',
        title: title || headline,
        headline: headline || title,
        location,
        locationName: location,
        locationCountry: country,
        industry,
        public_profile_url: linkedinUrl,
        profile_url: linkedinUrl,
        linkedinUrl,
        profile_picture_url: profilePictureUrl,
        company: normalizedCompany,
        jobCompanyName: normalizedCompany,
        ...(companyLinkedinUrl
          ? { jobCompanyLinkedinUrl: companyLinkedinUrl }
          : {}),
        source: 'contactout',
        sources: ['contactout'],
        // Preserve for timeline snapshotting utilities.
        org_contactout_profile: profile,
        org_contactout_experience: p.experience,
      };
    });
  }

  private isBrightDataLinkedinProfileEnrichEnabled(): boolean {
    return process.env.BRIGHT_DATA_LINKEDIN_PROFILE_ENRICH_ENABLED !== 'false';
  }

  private isM7kqDirectoryCandidateSource(
    s: OrgChartLinkedinCandidateSource | undefined,
  ): boolean {
    return s === 'm7kq' || s === 'apollo';
  }

  private normalizeMultiSources(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const cleaned = input
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

    return Array.from(new Set(cleaned));
  }

  private theOrgPeopleToCandidates(
    people: TheOrgPerson[],
    companyName: string,
    companyLinkedinUrl?: string,
  ): Array<Record<string, unknown>> {
    return (people ?? [])
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const fullName = typeof p.name === 'string' ? p.name : '';
        const [first, ...rest] = fullName.trim().split(/\s+/);
        const last = rest.join(' ');
        const title = typeof p.role === 'string' ? p.role : '';
        const linkedinUrl = p.linkedInUrl?.trim() || '';

        return {
          id: `theorg_${String(p.id)}`,
          name: fullName || 'Unknown',
          first_name: first || '',
          last_name: last || '',
          headline: title,
          title,
          public_profile_url: linkedinUrl || null,
          profile_url: linkedinUrl || null,
          profile_picture_url: p.profileImageUrl ?? null,
          current_positions: [
            {
              company: companyName || '—',
              company_id: null,
              description: null,
              role: title,
              location: null,
              industry: [],
              tenure_at_role: { years: 0, months: 0 },
              tenure_at_company: { years: 0, months: 0 },
              start: { year: new Date().getFullYear(), month: 1 },
              skills: null,
            },
          ],
          company: companyName,
          job_company_linkedin_url: companyLinkedinUrl ?? '',
          source: 'theorg',
          sources: ['theorg'],
        };
      });
  }

  private officialBoardCandidatesToCandidates(
    candidates: TheOfficialBoardCandidate[],
    companyName: string,
  ): Array<Record<string, unknown>> {
    return (candidates ?? [])
      .filter(
        (c) =>
          c &&
          typeof c === 'object' &&
          c.isMasked !== true &&
          typeof c.name === 'string' &&
          c.name.trim().length > 0,
      )
      .map((c) => {
        const fullName = c.name?.trim() ?? '';
        const [first, ...rest] = fullName.trim().split(/\s+/);
        const last = rest.join(' ');
        const title = (c.displayTitle ?? c.title ?? '')?.trim?.() ?? '';

        return {
          id: `officialboard_${c.id}`,
          name: fullName || 'Unknown',
          first_name: first || '',
          last_name: last || '',
          headline: title,
          title,
          public_profile_url: null,
          profile_url: null,
          current_positions: [
            {
              company: companyName || '—',
              company_id: null,
              description: null,
              role: title,
              location: null,
              industry: [],
              tenure_at_role: { years: 0, months: 0 },
              tenure_at_company: { years: 0, months: 0 },
              start: { year: new Date().getFullYear(), month: 1 },
              skills: null,
            },
          ],
          company: companyName,
          source: 'officialboard',
          sources: ['officialboard'],
        };
      });
  }

  private async emitMergedPartialOrgChart(args: {
    apiToken: string;
    requestId?: string;
    mode: OrgchartSearchMode;
    searchType: OrgchartSearchType;
    resolvedCompanyName: string;
    companyId?: string;
    candidates: Array<Record<string, unknown>>;
    candidateSourceLabel: string;
    message: string;
  }): Promise<void> {
    const requestId = args.requestId?.trim();

    if (!requestId) return;

    const s3PersistKey = this.orgChartS3Service.persistedCompanyFolderKey(
      args.companyId,
      args.resolvedCompanyName,
    );
    const inProgressVariant = `in-progress_${requestId}`;

    const deduped = dedupeAndMergeOrgChartCandidates(args.candidates);

    await this.orgChartIncrementalBuildCache.set(requestId, {
      companyName: args.resolvedCompanyName,
      companyId: args.companyId,
      candidateSources: [args.candidateSourceLabel],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: deduped,
      dedupedItemCount: deduped.length,
    });

    await this.emitOrgchartSearchProgressForToken(args.apiToken, {
      requestId,
      mode: args.mode,
      searchType: args.searchType,
      companyName: args.resolvedCompanyName,
      event: 'status',
      data: {
        message: args.message,
        candidateSource: args.candidateSourceLabel,
      },
    });

    try {
      const orgChart =
        await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
          deduped as OrgChartBuildCandidateRow[],
          {
            companyName: args.resolvedCompanyName,
            companyId: args.companyId,
            mode: args.mode,
            function: undefined,
            companyLinkedinUrl: undefined,
            profileSourceFallback: 'm7kq',
          },
        );

      await Promise.all([
        this.orgChartS3Service.saveCandidates(
          s3PersistKey,
          deduped,
          inProgressVariant,
        ),
        this.orgChartS3Service.saveOrgChart(
          s3PersistKey,
          orgChart,
          inProgressVariant,
        ),
      ]);

      await this.emitOrgchartSearchProgressForToken(args.apiToken, {
        requestId,
        mode: args.mode,
        searchType: args.searchType,
        companyName: args.resolvedCompanyName,
        event: 'partialOrgChart',
        data: {
          orgChart,
          itemCountSoFar: deduped.length,
          dedupedCountSoFar: deduped.length,
          candidateSource: args.candidateSourceLabel,
        },
      });
    } catch {
      // Best-effort.
    }
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

      if (source === 'linkedin_xray' || source === 'apify') {
        return source;
      }
      if (source === 'apollo' || source === 'm7kq') {
        return 'm7kq';
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

    console.log('These are args : ', args);

    if (body.candidateSource !== 'linkedin_xray') {
      return null;
    }

    if (!this.brightDataSerpService.isConfigured()) {
      throw new HttpException(
        'LinkedIn x-ray is not configured (BRIGHT_DATA_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    console.log('This is body : ', body);

    const jobTitlesJoined =
      body.jobTitles?.filter((title) => title.trim().length > 0).join(' OR ') ||
      '';
    const functionRootForQuery = hasMeaningfulOrgChartFunctionRootFilter(
      body.functionRoot,
    )
      ? (body.functionRoot?.trim() ?? '')
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

    console.log('This is xray payload : ', xrayPayload);

    await this.emitOrgchartSearchProgressForToken(apiToken, {
      requestId,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      event: 'status',
      data: {
        message:
          body.includePaginatedHtml === true
            ? `Running LinkedIn x-ray search via Bright Data snapshot pagination on ${body.xraySearchEngine === 'both' ? 'Google and Bing' : (body.xraySearchEngine ?? 'Google')}...`
            : `Running LinkedIn x-ray search on ${body.xraySearchEngine === 'both' ? 'Google and Bing' : (body.xraySearchEngine ?? 'Google')}...`,
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
                  if (
                    requestId &&
                    this.orgchartCancelRegistry.isCancelled(requestId)
                  ) {
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
            linkedInPeopleSearchResultMatchesTargetCompany(
              c,
              resolvedCompanyName,
            ),
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

    console.log('This is results : ', results);

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
    if (!this.isM7kqDirectoryCandidateSource(args.body.candidateSource)) {
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

    const skipApolloOrgResolution = this.environmentService.get(
      'ORGCHART_APOLLO_SKIP_RESOLUTION',
    );
    const explicitDomain = args.body.companyDomain?.trim().toLowerCase();
    const inferredDomain = this.extractDomainFromWebsite(
      args.body.website,
    )?.toLowerCase();
    const companyDomain = explicitDomain || inferredDomain || undefined;

    let resolvedOrgId: string | undefined;
    let resolvedLinkedinUrl: string | undefined;
    let resolvedOrgDomain: string | undefined;
    const shouldStartWithDomain = Boolean(companyDomain);
    let apolloSearchStrategy:
      | 'domain_only'
      | 'domain_then_org_resolution'
      | 'org_resolution_first' =
      shouldStartWithDomain ? 'domain_only' : 'org_resolution_first';

    if (shouldStartWithDomain) {
      resolvedOrgDomain = companyDomain;
      this.logger.log(
        `Apollo org chart: attempting domain-first people search (company="${args.resolvedCompanyName}", domain="${companyDomain}")`,
      );
      this.logger.log(
        `[APOLLO_ORGCHART_STRATEGY] strategy=${apolloSearchStrategy} company="${args.resolvedCompanyName}" domain="${companyDomain}"`,
      );
    } else if (skipApolloOrgResolution) {
      this.logger.warn(
        `Apollo org chart: ORGCHART_APOLLO_SKIP_RESOLUTION is enabled but no companyDomain was provided (company="${args.resolvedCompanyName}")`,
      );
      throw new HttpException(
        `Apollo org chart: companyDomain is required when ORGCHART_APOLLO_SKIP_RESOLUTION is enabled`,
        HttpStatus.BAD_REQUEST,
      );
    } else {
      this.logger.log(
        `[APOLLO_ORGCHART_STRATEGY] strategy=${apolloSearchStrategy} company="${args.resolvedCompanyName}" domain=none`,
      );
    }

    const trimmedFunctionRoot =
      typeof args.body.functionRoot === 'string'
        ? args.body.functionRoot.trim()
        : '';
    const shouldGenerateFunctionRootTitlesForApollo =
      args.mode === 'entire_company' &&
      hasMeaningfulOrgChartFunctionRootFilter(trimmedFunctionRoot) &&
      (!args.jobTitles || args.jobTitles.length === 0);
    const functionRootDerivedTitles = shouldGenerateFunctionRootTitlesForApollo
      ? await this.pythonQueryGenerationService.generateApolloPersonTitleTermsForFunctionRoot(
          trimmedFunctionRoot,
        )
      : [];

    const bodyForApollo = {
      ...args.body,
      ...(companyDomain ? { companyDomain } : {}),
    };

    const apolloParams = this.buildApolloPeopleSearchParams({
      body: bodyForApollo,
      mode: args.mode,
      organizationId: resolvedOrgId,
      organizationDomain: resolvedOrgDomain,
      jobTitles:
        (args.jobTitles?.length ? args.jobTitles : functionRootDerivedTitles) ??
        [],
    });

    await this.emitOrgchartSearchProgressForToken(args.apiToken, {
      requestId: args.requestId,
      mode: args.mode,
      searchType: args.searchType,
      companyName: args.resolvedCompanyName,
      event: 'status',
      data: {
        message: 'Fetching people ...',
        candidateSource: 'm7kq',
      },
    });

    // Apollo People Search allows per_page ≤ 100 and page ≤ 500.
    // We cap total records we pull per org-chart search at APOLLO_MAX_RECORDS
    // (5 pages × 100 per page = 500) to protect Apollo credit usage and
    // downstream org-chart build latency. If Apollo reports more entries we
    // still stop at this ceiling.
    const APOLLO_PER_PAGE = 100;
    const APOLLO_MAX_RECORDS = 500;
    const APOLLO_MAX_PAGES = Math.ceil(APOLLO_MAX_RECORDS / APOLLO_PER_PAGE);

    const merged: TransformedCandidateForTable[] = [];
    const requestIdForCache = args.requestId?.trim() ?? undefined;
    const s3PersistKey =
      args.companyId && args.resolvedCompanyName
        ? this.orgChartS3Service.persistedCompanyFolderKey(
            args.companyId,
            args.resolvedCompanyName,
          )
        : undefined;
    const inProgressVariant = requestIdForCache
      ? `in-progress_${requestIdForCache}`
      : undefined;
    const partialEmitThrottleMs = 2500;
    let lastPartialEmitAt = 0;
    const startedAtIso = new Date().toISOString();

    const emitPartialSnapshot = async (argsForEmit: {
      raw: Record<string, unknown>;
      page: number;
      force?: boolean;
    }) => {
      if (!requestIdForCache) return;
      const now = Date.now();

      if (
        !argsForEmit.force &&
        now - lastPartialEmitAt < partialEmitThrottleMs
      ) {
        return;
      }
      lastPartialEmitAt = now;

      const deduped = dedupeAndMergeOrgChartCandidates(
        merged as unknown as Array<Record<string, unknown>>,
      );

      await this.orgChartIncrementalBuildCache.set(requestIdForCache, {
        companyName: args.resolvedCompanyName,
        companyId: args.companyId,
        candidateSources: ['apollo'],
        startedAt: startedAtIso,
        updatedAt: new Date().toISOString(),
        items: deduped,
        dedupedItemCount: deduped.length,
      });

      if (s3PersistKey && inProgressVariant && argsForEmit.page % 2 === 0) {
        await this.orgChartS3Service.saveCandidates(
          s3PersistKey,
          deduped,
          inProgressVariant,
        );
      }

      try {
        const partialOrgChart =
          await this.orgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates(
            deduped as OrgChartBuildCandidateRow[],
            {
              companyName: args.resolvedCompanyName,
              companyId: args.companyId,
              mode: args.mode,
              function: args.body.functionRoot,
              companyLinkedinUrl: args.canonicalCompanyLinkedinUrl,
              industry: args.body.industry,
              industryCategory: args.body.industryCategory,
              profileSourceFallback: args.body.candidateSource,
            },
          );

        if (s3PersistKey && inProgressVariant && argsForEmit.page % 2 === 0) {
          await this.orgChartS3Service.saveOrgChart(
            s3PersistKey,
            partialOrgChart,
            inProgressVariant,
          );
        }

        const totalPages =
          typeof (argsForEmit.raw.pagination as any)?.total_pages === 'number'
            ? (argsForEmit.raw.pagination as any).total_pages
            : undefined;

        await this.emitOrgchartSearchProgressForToken(args.apiToken, {
          requestId: args.requestId,
          mode: args.mode,
          searchType: args.searchType,
          companyName: args.resolvedCompanyName,
          event: 'partialOrgChart',
          data: {
            orgChart: partialOrgChart,
            itemCountSoFar: merged.length,
            dedupedCountSoFar: deduped.length,
            page: argsForEmit.page,
            totalPages,
            candidateSource: 'm7kq',
          },
        });
      } catch {
        // Best-effort only; final build still happens at completion.
      }
    };

    let usedOrgResolutionFallback = false;

    for (let page = 1; page <= APOLLO_MAX_PAGES; page++) {
      const raw = await this.apolloIoRestService.peopleSearch({
        ...apolloParams,
        page,
        per_page: APOLLO_PER_PAGE,
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
      // Incremental: emit a partial snapshot (throttled).
      await emitPartialSnapshot({ raw: raw as Record<string, unknown>, page });

      const pag = raw.pagination as
        | {
            page?: number;
            per_page?: number;
            total_entries?: number;
            total_pages?: number;
          }
        | undefined;

      this.logger.log(
        `Apollo peopleSearch page=${page} returnedRows=${rows.length} totalSoFar=${merged.length} ` +
          `pagination=${pag ? JSON.stringify(pag) : 'none'} (cap=${APOLLO_MAX_RECORDS})`,
      );

      if (merged.length >= APOLLO_MAX_RECORDS) {
        if (merged.length > APOLLO_MAX_RECORDS) {
          merged.length = APOLLO_MAX_RECORDS;
        }
        this.logger.log(
          `Apollo peopleSearch reached record cap=${APOLLO_MAX_RECORDS} at page=${page}; stopping pagination`,
        );
        await emitPartialSnapshot({
          raw: raw as Record<string, unknown>,
          page,
          force: true,
        });
        break;
      }

      if (rows.length === 0) {
        const canFallbackToOrgResolution =
          page === 1 &&
          merged.length === 0 &&
          shouldStartWithDomain &&
          !skipApolloOrgResolution &&
          !usedOrgResolutionFallback;

        if (canFallbackToOrgResolution) {
          await this.emitOrgchartSearchProgressForToken(args.apiToken, {
            requestId: args.requestId,
            mode: args.mode,
            searchType: args.searchType,
            companyName: args.resolvedCompanyName,
            event: 'status',
            data: {
              message:
                'No domain results on Apollo. Resolving company and retrying…',
              candidateSource: 'm7kq',
            },
          });
          const resolved =
            await this.apolloIoRestService.resolveOrganizationIdForOrgChart({
              candidateId: args.companyId,
              companyName: args.resolvedCompanyName,
              linkedinCompanyUrl,
              domain: companyDomain,
            });

          if (!resolved.organizationId) {
            this.logger.warn(
              `Apollo org chart: domain-first people search returned no rows and organization_id resolution failed for company="${args.resolvedCompanyName}" (candidateId=${args.companyId ?? 'none'}, linkedin=${linkedinCompanyUrl ?? 'none'})`,
            );
          } else {
            resolvedOrgId = resolved.organizationId;
            resolvedLinkedinUrl = resolved.linkedinUrl;
            resolvedOrgDomain = resolved.primaryDomain?.toLowerCase();

            Object.assign(
              apolloParams,
              this.buildApolloPeopleSearchParams({
                body: bodyForApollo,
                mode: args.mode,
                organizationId: resolvedOrgId,
                organizationDomain: resolvedOrgDomain,
                jobTitles:
                  (args.jobTitles?.length
                    ? args.jobTitles
                    : functionRootDerivedTitles) ?? [],
              }),
            );
            usedOrgResolutionFallback = true;
            apolloSearchStrategy = 'domain_then_org_resolution';
            this.logger.log(
              `Apollo org chart: retrying people search with resolved organization_id=${resolvedOrgId}`,
            );
            this.logger.log(
              `[APOLLO_ORGCHART_STRATEGY] strategy=${apolloSearchStrategy} company="${args.resolvedCompanyName}" resolvedOrganizationId="${resolvedOrgId}"`,
            );
            page = 0;
            continue;
          }
        }

        await emitPartialSnapshot({
          raw: raw as Record<string, unknown>,
          page,
          force: true,
        });
        break;
      }

      const totalPages =
        typeof pag?.total_pages === 'number' ? pag.total_pages : undefined;

      if (totalPages !== undefined && page >= totalPages) {
        await emitPartialSnapshot({
          raw: raw as Record<string, unknown>,
          page,
          force: true,
        });
        break;
      }

      // Some Apollo responses omit pagination metadata; fall back to stopping
      // as soon as we receive a short page (less than the requested per_page).
      if (totalPages === undefined && rows.length < APOLLO_PER_PAGE) {
        await emitPartialSnapshot({
          raw: raw as Record<string, unknown>,
          page,
          force: true,
        });
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

  private extractDomainFromWebsite(website?: string): string | undefined {
    const raw = website?.trim();

    if (!raw) return undefined;
    try {
      const normalized =
        raw.startsWith('http://') || raw.startsWith('https://')
          ? raw
          : `https://${raw}`;
      const host = new URL(normalized).hostname.trim().toLowerCase();

      return host || undefined;
    } catch {
      return raw.toLowerCase();
    }
  }

  async getApolloOrgPeopleCountEstimate(args: {
    companyId?: string;
    companyName?: string;
    linkedinCompanyUrl?: string;
    website?: string;
    country?: string;
    functionRoot?: string;
  }): Promise<{ totalEntries: number | null }> {
    if (!this.apolloIoRestService.isConfigured()) {
      return { totalEntries: null };
    }

    const resolvedCompanyName =
      args.companyName?.trim() || args.companyId?.trim() || '';

    if (!resolvedCompanyName) {
      return { totalEntries: null };
    }

    const companyDomain = this.extractDomainFromWebsite(args.website);
    const skipApolloOrgResolution = this.environmentService.get(
      'ORGCHART_APOLLO_SKIP_RESOLUTION',
    );

    const body: SearchOrgchartLinkedInBody = {
      rawQuery: `Find all people currently working at ${resolvedCompanyName}.`,
      cleanedQuery: `Find all people currently working at ${resolvedCompanyName}.`,
      companyName: resolvedCompanyName,
      companyId: args.companyId,
      mode: 'entire_company',
      candidateSource: 'apollo',
      country: args.country,
      functionRoot: args.functionRoot,
      ...(companyDomain ? { companyDomain } : {}),
      ...(args.linkedinCompanyUrl?.trim()
        ? { linkedinCompanyUrl: args.linkedinCompanyUrl.trim() }
        : {}),
    };

    const runCountSearch = async (params: ApolloPeopleSearchParams) => {
      const pageOne = await this.apolloIoRestService.peopleSearch({
        ...params,
        page: 1,
        per_page: 1,
      });
      const pagination = (pageOne.pagination ?? {}) as {
        total_entries?: unknown;
      };
      return typeof pagination.total_entries === 'number' &&
        Number.isFinite(pagination.total_entries)
        ? pagination.total_entries
        : null;
    };

    const domainParams = this.buildApolloPeopleSearchParams({
      body,
      mode: 'entire_company',
      organizationDomain: companyDomain,
      jobTitles: [],
    });
    const domainTotalEntries = await runCountSearch(domainParams);

    if (domainTotalEntries !== 0 || skipApolloOrgResolution) {
      return { totalEntries: domainTotalEntries };
    }

    const resolved =
      await this.apolloIoRestService.resolveOrganizationIdForOrgChart({
        candidateId: args.companyId,
        companyName: resolvedCompanyName,
        linkedinCompanyUrl: args.linkedinCompanyUrl,
        domain: companyDomain,
      });
    if (!resolved.organizationId) {
      return { totalEntries: domainTotalEntries };
    }

    const resolvedParams = this.buildApolloPeopleSearchParams({
      body,
      mode: 'entire_company',
      organizationId: resolved.organizationId,
      organizationDomain: resolved.primaryDomain?.toLowerCase(),
      jobTitles: [],
    });
    const resolvedTotalEntries = await runCountSearch(resolvedParams);
    return { totalEntries: resolvedTotalEntries };
  }

  /**
   * Resolve front-end org-chart body → Apollo People API Search params.
   * Mirrors the unresolved → resolved parameter pattern used for Unipile/Apify,
   * stripping internal sentinels (`fullcompany`, `global`) before mapping to Apollo fields.
   */
  private buildApolloPeopleSearchParams(args: {
    body: SearchOrgchartLinkedInBody;
    mode: OrgchartSearchMode;
    organizationId?: string;
    organizationDomain?: string;
    jobTitles: string[];
  }): ApolloPeopleSearchParams {
    const { body, mode, organizationId, organizationDomain, jobTitles } = args;

    const trimmedCountry =
      typeof body.country === 'string' ? body.country.trim() : '';
    const hasCountryFilter =
      trimmedCountry.length > 0 && trimmedCountry.toLowerCase() !== 'global';

    const trimmedFunctionRoot =
      typeof body.functionRoot === 'string' ? body.functionRoot.trim() : '';
    const hasFunctionRootFilter =
      hasMeaningfulOrgChartFunctionRootFilter(trimmedFunctionRoot);

    const titles = jobTitles.map((t) => t.trim()).filter((t) => t.length > 0);

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
      mode === 'leadership'
        ? undefined
        : titles.length > 0
          ? mode === 'entire_company'
            ? hasFunctionRootFilter
              ? titles
              : undefined
            : titles
          : undefined;

    const person_seniorities: string[] | undefined =
      mode === 'leadership'
        ? ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director']
        : undefined;

    // Safety: only pass organization_ids when it is a valid Apollo ObjectId.
    const organization_ids =
      organizationId && isApolloOrganizationId(organizationId)
        ? [organizationId]
        : undefined;

    // When no Apollo ObjectId is known (skip-resolution path), fall back to
    // q_organization_domains_list[] which Apollo People Search also accepts.
    const normalizedDomain = organizationDomain?.trim().toLowerCase();
    const q_organization_domains_list =
      !organization_ids && normalizedDomain ? [normalizedDomain] : undefined;

    if (!organization_ids && !q_organization_domains_list) {
      throw new HttpException(
        'Apollo org chart: cannot build People Search without either an Apollo organization_id or a company domain',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Apollo search params (mode=${mode}, organization_id=${organizationId ?? 'none'}, domain=${normalizedDomain ?? 'none'}): ` +
        `titles=${person_titles?.length ?? 0}, seniorities=${person_seniorities?.length ?? 0}, ` +
        `location=${person_locations?.[0] ?? 'any'}, keywords="${q_keywords ?? ''}"`,
    );

    return {
      organization_ids,
      q_organization_domains_list,
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
    s3Variant?: string,
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
        s3Variant,
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
        const filterCountry = normalizeCountry(normalizedCountryRaw);
        const possibleCountryValues = [
          raw.locationCountry,
          raw.location_country,
          raw.country,
        ].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );

        const normalizedCountry = normalizeCountry(possibleCountryValues[0]);

        if (normalizedCountry !== filterCountry) {
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
    profileSourceFallback?: OrgChartLinkedinCandidateSource;
    industry?: string;
    industryCategory?: string;
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
      profileSourceFallback,
      industry,
      industryCategory,
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
                    industry,
                    industryCategory,
                    profileSourceFallback,
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
            const creditsAvailable =
              await this.workspaceCreditsService.getOrgChartCreditsAvailable(
                workspaceId,
              );

            throw new HttpException(
              {
                message: `Insufficient org chart credits. Need ${creditsNeeded} credits for ${cachedOrgChart.itemCount} employees.`,
                creditsNeeded,
                creditsAvailable,
              },
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
                  industry,
                  industryCategory,
                  profileSourceFallback,
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
              industry,
              industryCategory,
              profileSourceFallback,
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
              await this.orgChartCacheService.setCachedCompanyOrgChart({
                companyName: resolvedCompanyName,
                companyId,
                mode: 'entire_company',
                searchType,
                orgChart: orgChartFromCache,
                items: cachedCandidateList.items,
                itemCount: cachedCandidateList.itemCount,
                creditsDebited: false,
              });
            }
            const creditsNeeded =
              this.workspaceCreditsService.computeOrgChartCreditsNeeded(
                cachedCandidateList.itemCount,
              );
            const creditsAvailable =
              await this.workspaceCreditsService.getOrgChartCreditsAvailable(
                workspaceId,
              );

            throw new HttpException(
              {
                message: `Insufficient org chart credits. Need ${creditsNeeded} credits for ${cachedCandidateList.itemCount} employees.`,
                creditsNeeded,
                creditsAvailable,
              },
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

      if (apiToken) {
        const workspaceIdS3 =
          await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

        if (workspaceIdS3) {
          canLoadS3 =
            await this.creditTransactionService.hasOrgChartS3AccessForWorkspace(
              workspaceIdS3,
              creditMetaS3.orgChartS3RelativePath,
              s3PersistKey,
            );
        }
      }

      if (!canLoadS3) {
        this.logger.log(
          `Skipping S3 org chart for company="${resolvedCompanyName}" (no credit transaction access for this workspace/path)`,
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
      includeOrgIntelligence: body.includeOrgIntelligence === true,
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
        message:
          'LinkedIn x-ray org chart job queued. Waiting for worker pickup…',
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
      body.candidateSource === 'm7kq' ||
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
      multiSource: body.multiSource === true,
      sources: Array.isArray(body.sources) ? body.sources : undefined,
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
      industry: body.industry,
      industryCategory: body.industryCategory,
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
  }): {
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
  } | null {
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
              industry: body.industry,
              industryCategory: body.industryCategory,
              profileSourceFallback: body.candidateSource,
              asOfMonth: body.asOfMonth,
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
          const creditsAvailable =
            await this.workspaceCreditsService.getOrgChartCreditsAvailable(
              workspaceId,
            );

          throw new HttpException(
            {
              message: `Insufficient org chart credits. Need ${creditsNeeded} credits for ${result.itemCount} employees.`,
              creditsNeeded,
              creditsAvailable,
            },
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
                industry: body.industry,
                industryCategory: body.industryCategory,
                profileSourceFallback: body.candidateSource,
                asOfMonth: body.asOfMonth,
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
                industry: body.industry,
                industryCategory: body.industryCategory,
                profileSourceFallback: body.candidateSource,
                asOfMonth: body.asOfMonth,
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
    const requestedSources = this.normalizeMultiSources(body.sources);
    const isMultiSourceRequested =
      body.multiSource === true && requestedSources.length > 0;
    // Multi-source orchestration runs later, after we derive mode/searchType/companyName.
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

    if (isMultiSourceRequested) {
      if (requestId) {
        this.orgchartCancelRegistry.register(requestId);
      }

      const jobData: OrgchartMultiSourceBuildJobData = {
        apiToken,
        requestId,
        body: body as unknown as Record<string, unknown>,
        canonicalCompanyLinkedinUrl,
        requestedSources,
        resolvedCompanyName,
        companyId,
        jobTitles,
        mode,
        searchType,
      };

      await this.orgchartApifyQueue.add(
        'OrgchartMultiSourceBuildProcessor',
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
          message:
            'Multi-source org chart job queued. Waiting for worker pickup…',
          candidateSource: 'multi',
        },
      });

      return {
        success: true,
        queued: true,
        candidateSource: 'multi' as const,
        requestId,
        mode,
        searchType,
        companyName: resolvedCompanyName,
        companyId,
        jobTitles,
        linkedinCompanyUrl:
          canonicalCompanyLinkedinUrl ?? body.linkedinCompanyUrl,
        itemCount: 0,
        items: [],
        orgChart: undefined,
        isCached: false,
        cacheSource: 'none' as const,
      };
    }

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
        profileSourceFallback: body.candidateSource,
        industry: body.industry,
        industryCategory: body.industryCategory,
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

    const linkedinXrayQueued = await this.maybeQueueLinkedinXrayOrgChartBuild({
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
        candidateSource: 'm7kq' as const,
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

    const result = await this.orgChartSearchService.runOrgchartLinkedInSearch(
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

  async enqueueApolloOrgChartBuildJob(
    jobData: OrgchartApolloBuildJobData,
  ): Promise<void> {
    await this.orgchartApifyQueue.add(
      'OrgchartApolloBuildProcessor',
      jobData,
      { retryLimit: 0 },
    );
  }

  async handleApolloOrgChartJob(
    jobData: OrgchartApolloBuildJobData,
  ): Promise<void> {
    const {
      apiToken,
      requestId,
      companyId,
      companyName,
      country,
      functionRoot,
      linkedinCompanyUrl,
      companyDomain: companyDomainFromJob,
      website: websiteFromJob,
      shouldWriteCompanyOrgChartCache,
    } = jobData;

    const resolvedCompanyDomain =
      companyDomainFromJob?.trim() ||
      this.extractDomainFromWebsite(websiteFromJob);
    const normalizedDomain = resolvedCompanyDomain?.trim().toLowerCase();

    const body: SearchOrgchartLinkedInBody = {
      rawQuery: `Find all people currently working at ${companyName}.`,
      cleanedQuery: `Find all people currently working at ${companyName}.`,
      companyName,
      companyId,
      mode: 'entire_company',
      searchType: 'classic',
      requestId,
      candidateSource: 'apollo',
      country,
      functionRoot,
      ...(linkedinCompanyUrl ? { linkedinCompanyUrl } : {}),
      ...(websiteFromJob?.trim() ? { website: websiteFromJob.trim() } : {}),
      ...(normalizedDomain ? { companyDomain: normalizedDomain } : {}),
    };

    try {
      const apolloPeopleResult = await this.runApolloOrgChartPeopleSearch({
        body,
        apiToken,
        mode: 'entire_company',
        resolvedCompanyName: companyName,
        companyId,
        requestId,
        searchType: 'classic',
        jobTitles: [],
        canonicalCompanyLinkedinUrl: linkedinCompanyUrl,
      });

      if (!apolloPeopleResult || apolloPeopleResult.itemCount <= 0) {
        if (requestId) {
          this.orgchartCancelRegistry.setFailed(
            requestId,
            'Apollo returned no matching employees.',
          );
        }
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: 'entire_company',
          searchType: 'classic',
          companyName,
          event: 'error',
          data: {
            message: 'Apollo returned no matching employees.',
            candidateSource: 'm7kq',
          },
        });
        return;
      }

      const { orgChart, orgChartError } =
        await this.buildOrgChartAfterLinkedInSearch({
          apiToken,
          body,
          mode: 'entire_company',
          resolvedCompanyName: companyName,
          companyId,
          searchType: 'classic',
          requestId,
          canonicalCompanyLinkedinUrl: linkedinCompanyUrl,
          shouldWriteCompanyOrgChartCache,
          result: apolloPeopleResult,
        });

      if (orgChartError) {
        if (requestId) {
          this.orgchartCancelRegistry.setFailed(requestId, orgChartError);
        }
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: 'entire_company',
          searchType: 'classic',
          companyName,
          event: 'error',
          data: {
            message: orgChartError,
            candidateSource: 'm7kq',
          },
        });
        return;
      }

      if (requestId) {
        this.orgchartCancelRegistry.setCompleted(requestId);
      }

      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: 'entire_company',
        searchType: 'classic',
        companyName,
        event: 'complete',
        data: {
          itemCount: apolloPeopleResult.itemCount,
          items: apolloPeopleResult.items as unknown as Record<string, unknown>[],
          orgChart: orgChart ?? undefined,
          candidateSource: 'm7kq',
          message: `Org chart ready for ${companyName} (${apolloPeopleResult.itemCount} people)`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Apollo org chart build failed.';
      this.logger.error(
        `Apollo org chart worker job failed for company="${companyName}": ${message}`,
        error as Error,
      );
      if (requestId) {
        this.orgchartCancelRegistry.setFailed(requestId, message);
      }
      await this.emitOrgchartSearchProgressForToken(apiToken, {
        requestId,
        mode: 'entire_company',
        searchType: 'classic',
        companyName,
        event: 'error',
        data: {
          message,
          candidateSource: 'm7kq',
        },
      });
    }
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

    console.log('Org Chart Build :', jobData);
    const modeForOrgChartBuild: OrgchartSearchMode = jobData.mode;

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
        message:
          jobData.includeOrgIntelligence === true
            ? 'Running Apify employee search scraper (current + past)…'
            : 'Running Apify company employee scraper…',
        candidateSource: 'apify',
      },
    });

    const apifyStrategyId = 'orgchart-apify-company-scraper';
    const apifyStrategyLabel = 'Apify company employees';
    let apifyReportedTotalProfiles: number | undefined;

    let items: TransformedCandidateForTable[] = [];

    try {
      items =
        jobData.includeOrgIntelligence === true
          ? await this.linkedInSearchService.fetchCompanyEmployeesViaApifyEmployeeSearchActorCurrentAndPast(
              {
                linkedinCompanyUrl: jobData.linkedinCompanyUrl,
                maxProfiles: jobData.maxItems,
                profileScraperMode: jobData.profileScraperMode ?? 'Full',
                defaultCompanyName: resolvedCompanyName,
                companyLinkedinUrl: jobData.linkedinCompanyUrl,
                onProgress: async (message) => {
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
              },
            ).then(({ current, past }) =>
              dedupeAndMergeOrgChartCandidates([
                ...(current as unknown as Array<Record<string, unknown>>),
                ...(past as unknown as Array<Record<string, unknown>>),
              ]) as unknown as TransformedCandidateForTable[],
            )
          : await this.linkedInSearchService.fetchCompanyEmployeesViaApifyActor(
              {
                linkedinCompanyUrl: jobData.linkedinCompanyUrl,
                maxItems: jobData.maxItems,
                profileScraperMode: jobData.profileScraperMode,
                defaultCompanyName: resolvedCompanyName,
                companyLinkedinUrl: jobData.linkedinCompanyUrl,
                jobTitles: jobData.jobTitles,
                onProgress: async (message) => {
                  const parsed = parseApifyLinkedinCompanyScraperLogLine(message);

                  console.log('This is parsed', parsed);
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
                      ? Math.min(apifyReportedTotalProfiles, parsed.page * 25)
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
              },
            );
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
    const sourceTag = APIFY_ORG_INTELLIGENCE_SOURCE_TAG;

    await this.orgChartCacheService.setCachedCompanyCandidateList({
      companyName: resolvedCompanyName,
      companyId,
      mode: cacheListMode,
      searchType,
      sourceTag,
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
            profileSourceFallback: 'apify',
            asOfMonth: (jobData as any).asOfMonth,
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
            sourceTag,
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
        const creditsAvailable =
          await this.workspaceCreditsService.getOrgChartCreditsAvailable(
            workspaceId,
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
            creditsNeeded,
            creditsAvailable,
          },
        });

        return;
      }
      const creditMetaFresh = await this.buildOrgChartCreditMetadata(
        apiToken,
        companyId,
        resolvedCompanyName,
        sourceTag,
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
        sourceTag,
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
        this.orgChartS3Service.saveOrgChart(s3CompanyId, orgChart, sourceTag),
        this.orgChartS3Service.saveCandidates(
          s3CompanyId,
          result.items,
          sourceTag,
        ),
      ]);

      const creditMetaForRowApify = await this.buildOrgChartCreditMetadata(
        apiToken,
        companyId,
        resolvedCompanyName,
        sourceTag,
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
          sourceTag,
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

      console.log('REsult:', result);

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

    console.log('Job Data for Org chart build:', jobData);
    const requestedSources = this.normalizeMultiSources(jobData.sources);
    const isMultiSourceRequested =
      jobData.multiSource === true && requestedSources.length > 0;

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
      industry: jobData.industry,
      industryCategory: jobData.industryCategory,
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

      let mergedResult = result;

      if (isMultiSourceRequested && requestedSources.includes('apollo')) {
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'status',
          data: {
            message: 'Fetching additional employees from Apollo…',
            candidateSource: 'm7kq',
          },
        });

        const apolloBody: SearchOrgchartLinkedInBody = {
          ...bodyForBuild,
          candidateSource: 'apollo',
        };
        const apolloPeopleResult = await this.runApolloOrgChartPeopleSearch({
          body: apolloBody,
          apiToken,
          mode: modeForOrgChartBuild,
          resolvedCompanyName,
          companyId,
          requestId,
          searchType,
          jobTitles: jobData.jobTitles ?? [],
          canonicalCompanyLinkedinUrl: linkedinCompanyUrl,
        });

        if (apolloPeopleResult) {
          const combined = dedupeAndMergeOrgChartCandidates([
            ...(Array.isArray(result.items)
              ? (result.items as Array<Record<string, unknown>>)
              : []),
            ...(Array.isArray(apolloPeopleResult.items)
              ? (apolloPeopleResult.items as Array<Record<string, unknown>>)
              : []),
          ]);

          mergedResult = {
            ...result,
            items: combined as unknown as typeof result.items,
            itemCount: combined.length,
          };
        }
      }

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
          result: mergedResult,
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
          message: isMultiSourceRequested
            ? `Org chart ready (${mergedResult.itemCount} employees via multi-source).`
            : `Org chart ready (${result.itemCount} employees via LinkedIn).`,
          itemCount: isMultiSourceRequested
            ? mergedResult.itemCount
            : result.itemCount,
          candidateSource: isMultiSourceRequested ? 'multi' : 'unipile',
          orgChart,
          items: isMultiSourceRequested ? mergedResult.items : result.items,
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

  async handleMultiSourceOrgChartJob(
    jobData: OrgchartMultiSourceBuildJobData,
  ): Promise<void> {
    const {
      apiToken,
      requestId,
      mode,
      searchType,
      resolvedCompanyName,
      companyId,
      jobTitles,
    } = jobData;

    const modeForOrgChartBuild: OrgchartSearchMode = mode;

    if (requestId && this.orgchartCancelRegistry.isCancelled(requestId)) {
      this.logger.log(
        `Multi-source org chart job skipped (cancelled) requestId=${requestId}`,
      );

      return;
    }

    const rawBody = jobData.body as SearchOrgchartLinkedInBody;
    const canonicalCompanyLinkedinUrl =
      jobData.canonicalCompanyLinkedinUrl ||
      rawBody.linkedinCompanyUrl?.trim().replace(/\/+$/, '') ||
      undefined;

    const requestedSources = Array.isArray(jobData.requestedSources)
      ? jobData.requestedSources
      : this.normalizeMultiSources((rawBody as any).sources);

    const aggregated: Array<Record<string, unknown>> = [];

    const addCandidates = async (
      sourceLabel: string,
      next: Array<Record<string, unknown>>,
      message: string,
    ) => {
      aggregated.push(...next);
      await this.emitMergedPartialOrgChart({
        apiToken,
        requestId,
        mode: modeForOrgChartBuild,
        searchType,
        resolvedCompanyName,
        companyId,
        candidates: aggregated,
        candidateSourceLabel: sourceLabel,
        message,
      });
    };

    if (requestedSources.includes('apollo')) {
      const apolloResult = await this.runApolloOrgChartPeopleSearch({
        body: { ...rawBody, candidateSource: 'apollo' },
        apiToken,
        mode: modeForOrgChartBuild,
        resolvedCompanyName,
        companyId,
        requestId,
        searchType,
        jobTitles,
        canonicalCompanyLinkedinUrl,
      });

      if (apolloResult) {
        await addCandidates(
          'apollo',
          apolloResult.items as unknown as Array<Record<string, unknown>>,
          `Apollo fetched ${apolloResult.itemCount} people; merging…`,
        );
      }
    }

    if (requestedSources.includes('contactout')) {
      try {
        const companyDomain =
          typeof (rawBody as any).companyDomain === 'string'
            ? (rawBody as any).companyDomain.trim()
            : '';
        const companyName =
          (rawBody.companyName ?? resolvedCompanyName ?? '').trim() ||
          resolvedCompanyName;
        const maxScanProfilesRaw = (rawBody as any).contactoutMaxScanProfiles;
        const throttleMsRaw = (rawBody as any).contactoutThrottleMs;
        const maxScanProfiles =
          typeof maxScanProfilesRaw === 'number' &&
          Number.isFinite(maxScanProfilesRaw)
            ? maxScanProfilesRaw
            : 2000;
        const throttleMs =
          typeof throttleMsRaw === 'number' && Number.isFinite(throttleMsRaw)
            ? throttleMsRaw
            : 1100;

        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'status',
          data: {
            message: 'ContactOut: searching people…',
            candidateSource: 'contactout',
          },
        });

        const found =
          await this.contactOutPeopleSearchService.searchCompanyPeople({
            companyName,
            domain: companyDomain || undefined,
            maxScanProfiles,
            throttleMs,
          });
        const contactOutCandidates = this.contactOutProfilesToCandidates(
          found.profiles,
          companyName,
          canonicalCompanyLinkedinUrl ?? rawBody.linkedinCompanyUrl,
        );

        await addCandidates(
          'contactout',
          contactOutCandidates,
          `ContactOut fetched ${contactOutCandidates.length} people (scanned=${found.scanned}); merging…`,
        );
      } catch {
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'status',
          data: {
            message: 'ContactOut fetch failed (skipping).',
            candidateSource: 'contactout',
          },
        });
      }
    }

    if (requestedSources.includes('theorg')) {
      try {
        const slug =
          (rawBody.companyId ?? rawBody.companyName ?? '').trim() ||
          resolvedCompanyName;
        const theOrgData =
          await this.theOrgService.fetchCompanyDetailsResolvingSlug(slug, {
            mode: 'combined',
            persist: false,
            linkedinCompanySlug: rawBody.companyId ?? undefined,
          } as any);
        const theOrgCandidates = this.theOrgPeopleToCandidates(
          theOrgData.people ?? [],
          theOrgData.companyName ?? resolvedCompanyName,
          canonicalCompanyLinkedinUrl ?? rawBody.linkedinCompanyUrl,
        );

        await addCandidates(
          'theorg',
          theOrgCandidates,
          `TheOrg fetched ${theOrgCandidates.length} people; merging…`,
        );
      } catch {
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'status',
          data: {
            message: 'TheOrg fetch failed (skipping).',
            candidateSource: 'theorg',
          },
        });
      }
    }

    if (requestedSources.includes('officialboard')) {
      try {
        const slug =
          (rawBody.companyId ?? rawBody.companyName ?? '').trim() ||
          resolvedCompanyName;
        const official =
          await this.theOfficialBoardService.fetchCompanyDetailsResolvingSlug(
            slug,
            { persist: false },
          );
        const officialCandidates = this.officialBoardCandidatesToCandidates(
          official.candidates ?? [],
          official.companyName ?? resolvedCompanyName,
        );

        await addCandidates(
          'officialboard',
          officialCandidates,
          `OfficialBoard fetched ${officialCandidates.length} people; merging…`,
        );
      } catch {
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'status',
          data: {
            message: 'OfficialBoard fetch failed (skipping).',
            candidateSource: 'officialboard',
          },
        });
      }
    }

    if (requestedSources.includes('unipile')) {
      const li = await this.orgChartSearchService.runOrgchartLinkedInSearch(
        rawBody.rawQuery,
        rawBody.cleanedQuery,
        searchType,
        apiToken,
        undefined,
        {
          mode: modeForOrgChartBuild,
          companyName: resolvedCompanyName,
          companyId,
          requestId,
          jobTitles: rawBody.jobTitles,
          country: rawBody.country,
          functionRoot: rawBody.functionRoot,
          stdFunction: rawBody.stdFunction,
          stdGrade: rawBody.stdGrade,
          selectedNodeStdScopes: rawBody.selectedNodeStdScopes,
          linkedinCompanyUrl:
            canonicalCompanyLinkedinUrl ?? rawBody.linkedinCompanyUrl,
          linkedinUnipileAccountId: rawBody.linkedinUnipileAccountId,
          businessDivisionRawQuery: rawBody.businessDivisionRawQuery,
        },
      );

      await addCandidates(
        'unipile',
        (li.items ?? []) as Array<Record<string, unknown>>,
        `LinkedIn fetched ${li.itemCount} people; merging…`,
      );
    }

    if (requestedSources.includes('apify')) {
      const linkedinCompanyUrl =
        rawBody.linkedinCompanyUrl?.trim() || canonicalCompanyLinkedinUrl || '';

      if (!linkedinCompanyUrl) {
        await this.emitOrgchartSearchProgressForToken(apiToken, {
          requestId,
          mode: modeForOrgChartBuild,
          searchType,
          companyName: resolvedCompanyName,
          event: 'status',
          data: {
            message: 'Apify skipped: missing linkedinCompanyUrl',
            candidateSource: 'apify',
          },
        });
      } else {
        const apifyMaxItemsRaw = (rawBody as any).apifyMaxItems;
        const apifyMaxItems =
          typeof apifyMaxItemsRaw === 'number' && apifyMaxItemsRaw > 0
            ? Math.min(apifyMaxItemsRaw, 10000)
            : 2500;

        const includeOrgIntelligence =
          String((rawBody as any).includeOrgIntelligence ?? '').toLowerCase() ===
          'true';

        const useEmployeeSearchActor =
          process.env.APIFY_LINKEDIN_EMPLOYEE_SEARCH_ACTOR_ID?.trim().length ||
          String((rawBody as any).apifyActor ?? '').toLowerCase() ===
            'employee_search';

        const onProgress = async (message: string) => {
          await this.emitOrgchartSearchProgressForToken(apiToken, {
            requestId,
            mode: modeForOrgChartBuild,
            searchType,
            companyName: resolvedCompanyName,
            event: 'status',
            data: { message, candidateSource: 'apify' },
          });
        };

        const apifyItems = useEmployeeSearchActor
          ? await this.linkedInSearchService
              .fetchCompanyEmployeesViaApifyEmployeeSearchActor({
                linkedinCompanyUrl,
                defaultCompanyName: resolvedCompanyName,
                companyLinkedinUrl: linkedinCompanyUrl,
                profileScraperMode:
                  (rawBody as any).profileScraperMode ?? 'Full',
                maxProfiles: apifyMaxItems,
                employment: 'current',
                onProgress,
              })
              .then(async (current) => {
                if (!includeOrgIntelligence) {
                  return current;
                }
                await onProgress('Apify: fetching past employees…');
                const past =
                  await this.linkedInSearchService.fetchCompanyEmployeesViaApifyEmployeeSearchActor(
                    {
                      linkedinCompanyUrl,
                      defaultCompanyName: resolvedCompanyName,
                      companyLinkedinUrl: linkedinCompanyUrl,
                      profileScraperMode:
                        (rawBody as any).profileScraperMode ?? 'Full',
                      maxProfiles: apifyMaxItems,
                      employment: 'past',
                      onProgress,
                    },
                  );

                return dedupeAndMergeOrgChartCandidates([
                  ...(current as unknown as Array<Record<string, unknown>>),
                  ...(past as unknown as Array<Record<string, unknown>>),
                ]) as unknown as typeof current;
              })
          : await this.linkedInSearchService.fetchCompanyEmployeesViaApifyActor(
              {
                linkedinCompanyUrl,
                maxItems: apifyMaxItems,
                profileScraperMode: (rawBody as any).profileScraperMode,
                defaultCompanyName: resolvedCompanyName,
                companyLinkedinUrl: linkedinCompanyUrl,
                jobTitles: rawBody.jobTitles,
                onProgress,
              },
            );

        await addCandidates(
          'apify',
          apifyItems as unknown as Array<Record<string, unknown>>,
          `Apify fetched ${apifyItems.length} people; merging…`,
        );
      }
    }

    const mergedDeduped = dedupeAndMergeOrgChartCandidates(aggregated);
    const mergedResult = {
      items: mergedDeduped,
      itemCount: mergedDeduped.length,
      isCached: false,
      cacheSource: 'none' as const,
      strategyResults: [],
    };

    const { orgChart, orgChartError } =
      await this.buildOrgChartAfterLinkedInSearch({
        apiToken,
        body: {
          ...(rawBody as any),
          candidateSource: requestedSources.includes('unipile')
            ? 'unipile'
            : 'm7kq',
        },
        mode: modeForOrgChartBuild,
        resolvedCompanyName,
        companyId,
        searchType,
        requestId,
        canonicalCompanyLinkedinUrl,
        shouldWriteCompanyOrgChartCache: true,
        result: mergedResult as any,
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
        data: { message: orgChartError, candidateSource: 'multi' },
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
        message: `Org chart ready (${mergedResult.itemCount} people via multi-source).`,
        itemCount: mergedResult.itemCount,
        candidateSource: 'multi',
        orgChart,
        items: mergedResult.items,
      },
    });
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

      console.log('Payload : ', payload);
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
