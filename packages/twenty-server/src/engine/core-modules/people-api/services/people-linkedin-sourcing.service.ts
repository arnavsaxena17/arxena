import { randomUUID } from 'crypto';

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import {
  getLinkedInUnipileSearchPageLimit,
  isValidUuid,
} from 'twenty-shared/utils';

import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
import {
  extractLinkedinCompanyIdFromUnipileProfile,
  UnipileCompanyService,
} from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';
import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';
import type { LinkedInSearchResponse } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import {
  classifyLinkedInSearchUrl,
  isHarvestSalesNavigatorPeopleSearchUrl,
  isPeopleLinkedInSearchUrl,
} from 'src/engine/core-modules/linkedin-search/utils/classify-linkedin-search-url.util';
import { HarvestLinkedinTransformerService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin-transformer.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import {
  OrgChartSuperImposeService,
  type SuperImposeFetchContext,
} from 'src/engine/core-modules/org-chart/services/org-chart-super-impose.service';
import type { SuperImposeInputs } from 'src/engine/core-modules/org-chart/types/super-impose.types';
import {
  randomOrgChartLinkedInPageDelayMs,
  sleepMs,
} from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';
import { normalizeLinkedinCompanyUrl } from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import {
  andMergeBooleanSearchClauses,
  extractJobTitleClauseFromGeneratedSearchParameters,
  extractKeywordsClauseFromGeneratedSearchParameters,
} from 'src/engine/core-modules/org-chart/utils/super-impose-keyword-merge.util';

import { resolveSalesNavFilters } from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';

import {
  buildUnipileSalesNavSearchRequest,
  shouldOmitSalesNavKeywords,
} from '../utils/build-unipile-sales-nav-search-request.util';
import { pickManualLinkedInBooleanQuery } from '../utils/pick-manual-linkedin-boolean-query.util';
import type { ManualLinkedInQuery } from '../utils/pick-manual-linkedin-boolean-query.util';
import { usablePeopleTaxonomyLabel } from '../utils/extract-taxonomy-item-value.util';
import {
  extractUnipilePeopleSearchIntent,
  parseSalesNavUrlSearchIntent,
} from '../utils/extract-unipile-search-intent.util';
import {
  PeopleSalesNavAccountResolver,
  type PeopleSalesNavAccountSource,
} from './people-sales-nav-account.resolver';

export type PeopleLinkedInCandidateSource = PeopleSalesNavAccountSource;

export type PeopleLinkedInSourcingInput = {
  apiToken: string;
  website?: string;
  companyId?: string;
  linkedinCompanyUrl?: string;
  companyName?: string;
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
  country?: string;
  locationIds?: string[];
  dataSource?: PeopleLinkedInCandidateSource;
  accountId?: string;
  limit?: number;
  linkedinSearchKeywords?: string;
  searchUrl?: string;
};

export type PeopleLinkedInSourcingResult = {
  dataSource: PeopleLinkedInCandidateSource;
  keywords: string | null;
  jobTitle: string | null;
  appliedFilters: {
    functionIds: string[];
    seniorities: LinkedInSeniorityType[];
  };
  company: {
    name: string | null;
    slug: string | null;
    linkedinUrl: string | null;
    id?: string | null;
    ids?: string[];
  };
  items: Array<Record<string, unknown>>;
};

const PEOPLE_UNIPILE_SEARCH_MAX_PAGES = 20;

@Injectable()
export class PeopleLinkedInSourcingService {
  private readonly logger = new Logger(PeopleLinkedInSourcingService.name);

  constructor(
    private readonly orgChartSuperImposeService: OrgChartSuperImposeService,
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly peopleSalesNavAccountResolver: PeopleSalesNavAccountResolver,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly linkedinUnipileSessionService: LinkedinUnipileSessionService,
    private readonly unipileCompanyService: UnipileCompanyService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly harvestLinkedinTransformer: HarvestLinkedinTransformerService,
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
  ) {}

  isUnipileConfigured(): boolean {
    return this.peopleSalesNavAccountResolver.isUnipileConfigured();
  }

  async search(
    input: PeopleLinkedInSourcingInput,
  ): Promise<PeopleLinkedInSourcingResult> {
    const searchUrl = input.searchUrl?.trim();
    if (searchUrl) {
      return this.searchFromUrl(input, searchUrl);
    }

    const companyName = input.companyName?.trim() || '';
    const website = input.website?.trim();
    const companyId = input.companyId?.trim();
    const linkedinCompanyUrl = input.linkedinCompanyUrl?.trim();

    if (!website && !companyId && !companyName && !linkedinCompanyUrl) {
      throw new HttpException(
        'At least one of website, companyId, linkedinCompanyUrl, or companyName is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const account = await this.peopleSalesNavAccountResolver.resolve({
      candidateSource: input.dataSource,
      accountId: input.accountId,
    });

    const stdFunction = usablePeopleTaxonomyLabel(input.stdFunction);
    const stdFunctionRoot = usablePeopleTaxonomyLabel(input.stdFunctionRoot);
    const stdGrade = input.stdGrade?.trim() || undefined;
    const fallbackJobTitle = input.linkedinSearchKeywords?.trim() || undefined;

    const salesNavFilters = resolveSalesNavFilters({
      functionRoot: stdFunctionRoot,
      stdFunction,
      stdGrade,
    });

    const manualLinkedInQuery = await this.resolveManualBooleanQuery({
      stdFunction,
      stdFunctionRoot,
      stdGrade,
    });
    const hasManualLinkedInQuery = !!manualLinkedInQuery;

    const omitGeneratedKeywords =
      !hasManualLinkedInQuery &&
      account.candidateSource !== 'harvest' &&
      shouldOmitSalesNavKeywords(salesNavFilters);

    const inputs = this.buildSuperImposeInputs({
      website,
      companyId,
      linkedinCompanyUrl,
      companyName,
    });
    const primaryLinkedinCompanyUrl =
      this.toLinkedinCompanyUrl(linkedinCompanyUrl) ??
      this.toLinkedinCompanyUrl(companyId);

    const resolved = await this.orgChartSuperImposeService.resolveInputs({
      inputs,
      primaryCompanyId: this.toLinkedinCompanyId(
        primaryLinkedinCompanyUrl ?? companyId,
      ),
      primaryCompanyName: companyName || undefined,
      primaryLinkedinCompanyUrl,
      apiToken: input.apiToken,
    });

    this.logger.log(
      `People API resolved companies=${
        resolved.resolvedCompanies.map((company) => company.slug).join(',') ||
        'none'
      } website=${website ?? ''} companyId=${companyId ?? ''} linkedinCompanyUrl=${linkedinCompanyUrl ?? primaryLinkedinCompanyUrl ?? ''} dataSource=${account.candidateSource}`,
    );

    if (resolved.errors.length > 0 && resolved.resolvedCompanies.length === 0) {
      throw new HttpException(
        `Could not resolve company: ${resolved.errors.join('; ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const primaryCompany = resolved.resolvedCompanies[0];
    const primaryCompanyName =
      primaryCompany?.companyName?.trim() ||
      companyName ||
      primaryCompany?.slug ||
      'company';

    const appliedFilters = hasManualLinkedInQuery
      ? { functionIds: [], seniorities: [] }
      : salesNavFilters;

    const keywordPlan = await this.buildKeywordPlan({
      stdFunction,
      stdFunctionRoot,
      stdGrade,
      primaryCompanyName,
      linkedinSearchKeywords: hasManualLinkedInQuery
        ? (manualLinkedInQuery?.keywords ??
          manualLinkedInQuery?.jobTitle)
        : omitGeneratedKeywords
          ? undefined
          : fallbackJobTitle,
      skipGeneratedKeywords: hasManualLinkedInQuery,
    });

    const functionRoot =
      keywordPlan.functionRoot ||
      input.stdFunctionRoot?.trim() ||
      input.stdFunction?.trim();

    // Harvest + keyword Unipile path via super-impose (Sales Nav)
    if (account.candidateSource === 'harvest') {
      const context: SuperImposeFetchContext = {
        apiToken: input.apiToken,
        primaryCompanyName,
        companyId: primaryCompany?.slug ?? companyId,
        country: input.country,
        functionRoot,
        leadershipOnly: keywordPlan.leadershipOnly,
        linkedinSearchKeywords: this.mergeManualQueryForSingleSearchField(
          manualLinkedInQuery,
        ) ??
          andMergeBooleanSearchClauses([
            keywordPlan.jobTitle ?? fallbackJobTitle,
            keywordPlan.linkedinSearchKeywords,
          ]),
        candidateSource: 'harvest',
        searchType: 'sales_navigator',
        maxProfiles: input.limit ?? 20,
        salesNavFunctionIds: appliedFilters.functionIds,
        salesNavSeniorities: appliedFilters.seniorities,
      };

      const plan =
        await this.orgChartSuperImposeService.buildQueryPlanFromContext(
          context,
          resolved.resolvedCompanies,
          resolved.salesNavigatorSearchUrls,
        );

      if (appliedFilters.functionIds.length > 0) {
        const functionIdsJoined = appliedFilters.functionIds.join(',');
        for (const batch of plan.harvestBatches) {
          if (!batch.salesNavUrl) {
            batch.functionIds = functionIdsJoined;
          }
        }
      }

      const items =
        await this.orgChartSuperImposeService.fetchCandidatesForPlan(
          plan,
          context,
        );

      return {
        dataSource: 'harvest',
        keywords:
          plan.mergedSearchClause ??
          keywordPlan.linkedinSearchKeywords ??
          null,
        jobTitle: manualLinkedInQuery?.jobTitle ?? fallbackJobTitle ?? null,
        appliedFilters,
        company: {
          name: primaryCompanyName,
          slug: primaryCompany?.slug ?? null,
          linkedinUrl: primaryCompany?.linkedinUrl ?? null,
          id: null,
        },
        items: items.map((item) =>
          this.normalizePersonItem(item, 'harvest'),
        ),
      };
    }

    // Unipile / pool: facet-mapped Sales Nav people search
    const accountId = account.linkedinUnipileAccountId;
    if (!accountId) {
      throw new HttpException(
        'Resolved Unipile Sales Navigator account id is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const unipileJobTitle =
      manualLinkedInQuery?.jobTitle ??
      keywordPlan.jobTitle ??
      fallbackJobTitle;
    const unipileKeywords =
      manualLinkedInQuery?.keywords ?? keywordPlan.linkedinSearchKeywords;

    const unipileSearch = await this.searchUnipileSalesNavWithFacets({
      apiToken: input.apiToken,
      accountId,
      primaryCompanyName,
      companyLinkedinUrls: resolved.resolvedCompanies
        .map((company) => company.linkedinUrl)
        .filter((url): url is string => !!url?.trim()),
      country: input.country,
      locationIds: input.locationIds,
      keywords: unipileKeywords,
      jobTitle: unipileJobTitle,
      functionIds: appliedFilters.functionIds,
      seniorities: appliedFilters.seniorities,
      limit: input.limit ?? 20,
      includeManualLinkedInQuery:
        hasManualLinkedInQuery || !!unipileJobTitle,
    });

    return {
      dataSource: account.candidateSource,
      keywords: unipileKeywords ?? null,
      jobTitle: unipileJobTitle ?? null,
      appliedFilters,
      company: {
        name: primaryCompanyName,
        slug: primaryCompany?.slug ?? null,
        linkedinUrl: primaryCompany?.linkedinUrl ?? null,
        id: unipileSearch.companyParameterIds[0] ?? null,
        ids: unipileSearch.companyParameterIds,
      },
      items: unipileSearch.items.map((item) =>
        this.normalizePersonItem(item, account.candidateSource),
      ),
    };
  }

  private async searchFromUrl(
    input: PeopleLinkedInSourcingInput,
    searchUrl: string,
  ): Promise<PeopleLinkedInSourcingResult> {
    const classified = classifyLinkedInSearchUrl(searchUrl);
    if (!isPeopleLinkedInSearchUrl(classified) || !classified) {
      throw new HttpException(
        'searchUrl must be a LinkedIn people search URL (classic /search/results/people, Sales Navigator /sales/search/people, or Recruiter /talent/search)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const account = await this.peopleSalesNavAccountResolver.resolve({
      candidateSource: input.dataSource,
      accountId: input.accountId,
    });
    const limit = input.limit ?? 20;
    const emptyCompany = {
      name: input.companyName?.trim() || null,
      slug: input.companyId?.trim() || null,
      linkedinUrl: null,
      id: null as string | null,
      ids: [] as string[],
    };

    if (account.candidateSource === 'harvest') {
      if (!isHarvestSalesNavigatorPeopleSearchUrl(classified)) {
        throw new HttpException(
          'Harvest only accepts Sales Navigator people search URLs (linkedin.com/sales/search/people). Use dataSource unipile or pool for classic/premium or Recruiter URLs.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const leads =
        await this.harvestLinkedinService.fetchAllLeadsFromQueryParams({
          params: {
            salesNavUrl: classified.url,
            sessionId: randomUUID(),
          },
          maxProfiles: limit,
        });
      const items =
        this.harvestLinkedinTransformer.transformCurrentLeadsToCandidates(
          leads,
          emptyCompany.name ?? '',
        );

      const fromUrl = parseSalesNavUrlSearchIntent(classified.url);

      return {
        dataSource: 'harvest',
        keywords: null,
        jobTitle: null,
        appliedFilters: { functionIds: [], seniorities: fromUrl.seniorities },
        company: {
          ...emptyCompany,
          id: fromUrl.companyIds[0] ?? emptyCompany.id,
          ids: fromUrl.companyIds,
        },
        items: items.map((item) =>
          this.normalizePersonItem(
            item as unknown as Record<string, unknown>,
            'harvest',
          ),
        ),
      };
    }

    const accountId = account.linkedinUnipileAccountId;
    if (!accountId) {
      throw new HttpException(
        'Resolved Unipile account id is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const fromUrl = parseSalesNavUrlSearchIntent(classified.url);
    const { items, config } =
      await this.linkedinUnipileSessionService.withLinkedinSession(
        input.apiToken,
        accountId,
        async (session) =>
          this.collectUnipilePeoplePages({
            limit,
            searchType: classified.product,
            fetchFirstPage: (pageLimit) =>
              this.linkedInSearchService.searchFromUrl(
                classified.url,
                session.accountId,
                { limit: pageLimit },
              ),
            fetchNextPage: (cursor, pageLimit) =>
              this.linkedInSearchService.searchWithCursor(
                cursor,
                session.accountId,
                { limit: pageLimit },
              ),
          }),
      );
    const fromConfig = extractUnipilePeopleSearchIntent(config);
    const companyIds =
      fromConfig.companyIds.length > 0
        ? fromConfig.companyIds
        : fromUrl.companyIds;
    const seniorities =
      fromConfig.seniorities.length > 0
        ? fromConfig.seniorities
        : fromUrl.seniorities;

    return {
      dataSource: account.candidateSource,
      keywords: null,
      jobTitle: null,
      appliedFilters: { functionIds: [], seniorities },
      company: {
        ...emptyCompany,
        id: companyIds[0] ?? emptyCompany.id,
        ids: companyIds,
      },
      items: items.map((item) =>
        this.normalizePersonItem(item, account.candidateSource),
      ),
    };
  }

  private async searchUnipileSalesNavWithFacets(input: {
    apiToken: string;
    accountId: string;
    primaryCompanyName: string;
    companyLinkedinUrls: string[];
    country?: string;
    locationIds?: string[];
    keywords?: string;
    jobTitle?: string;
    functionIds: string[];
    seniorities: LinkedInSeniorityType[];
    limit: number;
    includeManualLinkedInQuery?: boolean;
  }): Promise<{
    items: Array<Record<string, unknown>>;
    companyParameterIds: string[];
  }> {
    return this.linkedinUnipileSessionService.withLinkedinSession(
      input.apiToken,
      input.accountId,
      async (session) => {
        const companyParameterIds: string[] = [];
        const seenCompanyParameterIds = new Set<string>();

        for (const companyLinkedinUrl of input.companyLinkedinUrls) {
          const slug =
            this.unipileCompanyService.extractPublicIdentifier(
              companyLinkedinUrl,
            ) ?? undefined;
          if (!slug || isValidUuid(slug)) {
            continue;
          }
          try {
            const profile =
              await this.unipileCompanyService.getCompanyProfile(
                slug,
                session.accountId,
              );
            const companyParameterId =
              extractLinkedinCompanyIdFromUnipileProfile(profile) ??
              undefined;
            if (
              companyParameterId &&
              !seenCompanyParameterIds.has(companyParameterId)
            ) {
              seenCompanyParameterIds.add(companyParameterId);
              companyParameterIds.push(companyParameterId);
            }
          } catch (error) {
            this.logger.warn(
              `People API Unipile company profile lookup failed for ${slug}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        const request = buildUnipileSalesNavSearchRequest({
          keywords: input.keywords,
          jobTitle: input.jobTitle,
          companyParameterIds,
          primaryCompanyName: input.primaryCompanyName,
          country: input.country,
          locationIds: input.locationIds,
          functionIds: input.functionIds,
          seniorities: input.seniorities,
          includeManualLinkedInQuery: input.includeManualLinkedInQuery,
        });

        this.logger.log(
          `People API Sales Nav search account=${session.accountId} companies=${companyParameterIds.join(',')} functionIds=${input.functionIds.join(',')} seniorities=${input.seniorities.join(',')} keywords=${request.keywords ?? 'omitted'} jobTitle=${request.role?.include?.[0] ?? 'omitted'} limit=${input.limit}`,
        );

        const paged = await this.collectUnipilePeoplePages({
          limit: input.limit,
          searchType: 'sales_navigator',
          fetchFirstPage: (pageLimit) =>
            this.linkedInSearchService.searchPeopleSalesNavigator(
              request,
              session.accountId,
              { limit: pageLimit },
            ),
          fetchNextPage: (cursor, pageLimit) =>
            this.linkedInSearchService.searchWithCursor(
              cursor,
              session.accountId,
              { limit: pageLimit },
            ),
        });

        return {
          items: paged.items,
          companyParameterIds,
        };
      },
    );
  }

  private async collectUnipilePeoplePages(input: {
    limit: number;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    fetchFirstPage: (pageLimit: number) => Promise<LinkedInSearchResponse>;
    fetchNextPage: (
      cursor: string,
      pageLimit: number,
    ) => Promise<LinkedInSearchResponse>;
  }): Promise<{
    items: Array<Record<string, unknown>>;
    config: LinkedInSearchResponse['config'] | undefined;
  }> {
    const desired = Math.max(1, input.limit);
    const pageSize = getLinkedInUnipileSearchPageLimit(input.searchType);
    const collected: Array<Record<string, unknown>> = [];
    const seenKeys = new Set<string>();
    let cursor: string | undefined;
    let config: LinkedInSearchResponse['config'] | undefined;

    for (
      let page = 0;
      page < PEOPLE_UNIPILE_SEARCH_MAX_PAGES && collected.length < desired;
      page += 1
    ) {
      if (page > 0) {
        await sleepMs(randomOrgChartLinkedInPageDelayMs());
      }

      const remaining = desired - collected.length;
      const pageLimit = Math.min(pageSize, remaining);
      let response: LinkedInSearchResponse;

      if (page === 0) {
        response = await input.fetchFirstPage(pageLimit);
      } else if (!cursor) {
        break;
      } else {
        response = await input.fetchNextPage(cursor, pageLimit);
      }

      if (page === 0) {
        config = response.config;
      }

      const items = (response.items ?? []) as Array<Record<string, unknown>>;
      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        if (collected.length >= desired) {
          break;
        }
        const key = this.unipilePersonIdentityKey(item);
        if (key) {
          if (seenKeys.has(key)) {
            continue;
          }
          seenKeys.add(key);
        }
        collected.push(item);
      }

      const nextCursor = response.cursor?.trim();
      if (!nextCursor || collected.length >= desired) {
        break;
      }
      cursor = nextCursor;
    }

    this.logger.log(
      `People API Unipile people search collected=${collected.length} requested=${desired} pageSize=${pageSize} searchType=${input.searchType}`,
    );

    return { items: collected, config };
  }

  private unipilePersonIdentityKey(
    item: Record<string, unknown>,
  ): string | undefined {
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (id) {
      return `id:${id}`;
    }

    const publicIdentifier =
      typeof item.public_identifier === 'string'
        ? item.public_identifier.trim()
        : '';
    if (publicIdentifier) {
      return `pub:${publicIdentifier}`;
    }

    const urlValue =
      (typeof item.public_profile_url === 'string' &&
        item.public_profile_url.trim()) ||
      (typeof item.linkedin_url === 'string' && item.linkedin_url.trim()) ||
      '';
    if (urlValue) {
      return `url:${urlValue}`;
    }

    return undefined;
  }

  private async resolveManualBooleanQuery(args: {
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
  }): Promise<ManualLinkedInQuery | undefined> {
    const stdFunction = args.stdFunction?.trim();
    const stdFunctionRoot = args.stdFunctionRoot?.trim();
    const stdGrade = args.stdGrade?.trim();

    if (!stdFunction && !stdFunctionRoot) {
      return undefined;
    }

    try {
      const result =
        await this.titleTaxonomyRemoteService.getManualBooleanQueries({
          stdFunction,
          stdFunctionRoot,
          stdGrade,
        });
      const query = pickManualLinkedInBooleanQuery(
        (result?.items ?? []).map((item) => ({
          kind: item.kind,
          label: item.label,
          stdGrade: item.std_grade,
          booleanQuery: item.boolean_query,
          keywords: item.keywords,
        })),
        {
          stdFunction,
          stdFunctionRoot,
          stdGrade,
        },
      );

      if (query) {
        this.logger.log(
          `People API using manual LinkedIn query stdFunction=${stdFunction ?? ''} stdFunctionRoot=${stdFunctionRoot ?? ''} stdGrade=${stdGrade ?? ''} jobTitle=${query.jobTitle ?? 'omitted'} keywords=${query.keywords ?? 'omitted'}`,
        );
      }

      return query;
    } catch (error) {
      this.logger.warn(
        `People API manual boolean query lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }

  private mergeManualQueryForSingleSearchField(
    query: ManualLinkedInQuery | undefined,
  ): string | undefined {
    if (!query) {
      return undefined;
    }

    const parts = [query.jobTitle, query.keywords].filter(
      (value): value is string => !!value?.trim(),
    );
    if (parts.length === 0) {
      return undefined;
    }
    if (parts.length === 1) {
      return parts[0];
    }

    return parts.map((part) => `(${part})`).join(' AND ');
  }

  private toLinkedinCompanyId(companyId?: string): string | undefined {
    const trimmed = companyId?.trim();
    if (!trimmed || isValidUuid(trimmed)) {
      return undefined;
    }

    return trimmed;
  }

  private toLinkedinCompanyUrl(value?: string): string | undefined {
    const identifier = this.toLinkedinCompanyId(value);
    if (!identifier) {
      return undefined;
    }

    return (
      normalizeLinkedinCompanyUrl(identifier) ??
      `https://www.linkedin.com/company/${identifier}/`
    );
  }

  private buildSuperImposeInputs(args: {
    website?: string;
    companyId?: string;
    linkedinCompanyUrl?: string;
    companyName?: string;
  }): SuperImposeInputs {
    const inputs: SuperImposeInputs = {};

    if (args.website?.trim()) {
      inputs.websiteUrls = [args.website.trim()];
    }

    const linkedinCompanyUrl =
      this.toLinkedinCompanyUrl(args.linkedinCompanyUrl) ??
      this.toLinkedinCompanyUrl(args.companyId);
    if (linkedinCompanyUrl) {
      inputs.linkedinCompanyUrls = [linkedinCompanyUrl];
    }

    return inputs;
  }

  private async buildKeywordPlan(args: {
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
    primaryCompanyName: string;
    linkedinSearchKeywords?: string;
    skipGeneratedKeywords?: boolean;
  }): Promise<{
    functionRoot?: string;
    leadershipOnly?: boolean;
    linkedinSearchKeywords?: string;
    jobTitle?: string;
  }> {
    const stdFunction = args.stdFunction?.trim();
    const stdFunctionRoot = args.stdFunctionRoot?.trim();
    const stdGrade = args.stdGrade?.trim();
    const companyNames = args.primaryCompanyName
      ? [args.primaryCompanyName]
      : [];

    let functionRoot: string | undefined;
    let linkedinSearchKeywords =
      args.linkedinSearchKeywords?.trim() || undefined;
    let jobTitle: string | undefined;
    let leadershipOnly = false;

    if (stdFunctionRoot) {
      functionRoot = stdFunctionRoot;
    }

    if (args.skipGeneratedKeywords) {
      if (stdGrade?.toLowerCase() === 'leadership') {
        leadershipOnly = true;
      }

      return {
        functionRoot,
        leadershipOnly,
        linkedinSearchKeywords: undefined,
        jobTitle: undefined,
      };
    }

    if (stdFunction) {
      try {
        const generated =
          await this.pythonQueryGenerationService.generateSearchParameters(
            {
              functions: [{ name: stdFunction, exclude: false }],
              ...(stdGrade
                ? { grades: [{ name: stdGrade, exclude: false }] }
                : {}),
              company_names: companyNames,
            },
            'sales_navigator',
            `People API std_function search for ${args.primaryCompanyName}`,
          );
        linkedinSearchKeywords =
          extractKeywordsClauseFromGeneratedSearchParameters(generated) ??
          linkedinSearchKeywords;
        jobTitle =
          extractJobTitleClauseFromGeneratedSearchParameters(generated);
      } catch (error) {
        this.logger.warn(
          `People API std_function keyword generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if (stdFunctionRoot) {
      try {
        const generated =
          await this.pythonQueryGenerationService.generateSearchParameters(
            {
              function_root: [
                { name: stdFunctionRoot, exclude: false },
              ],
              ...(stdGrade
                ? { grades: [{ name: stdGrade, exclude: false }] }
                : {}),
              company_names: companyNames,
            },
            'sales_navigator',
            `People API std_function_root search for ${args.primaryCompanyName}`,
          );
        linkedinSearchKeywords =
          extractKeywordsClauseFromGeneratedSearchParameters(generated) ??
          linkedinSearchKeywords;
        jobTitle =
          extractJobTitleClauseFromGeneratedSearchParameters(generated);
      } catch (error) {
        this.logger.warn(
          `People API std_function_root keyword generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if (stdGrade && stdGrade.toLowerCase() !== 'leadership') {
      try {
        const generated =
          await this.pythonQueryGenerationService.generateSearchParameters(
            {
              grades: [{ name: stdGrade, exclude: false }],
              company_names: companyNames,
            },
            'sales_navigator',
            `People API std_grade search for ${args.primaryCompanyName}`,
          );
        const gradeClause =
          extractKeywordsClauseFromGeneratedSearchParameters(generated);
        jobTitle =
          extractJobTitleClauseFromGeneratedSearchParameters(generated);
        if (gradeClause) {
          linkedinSearchKeywords = linkedinSearchKeywords
            ? `(${linkedinSearchKeywords}) AND (${gradeClause})`
            : gradeClause;
        }
      } catch (error) {
        this.logger.warn(
          `People API std_grade keyword generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (stdGrade?.toLowerCase() === 'leadership') {
      leadershipOnly = true;
    }

    return {
      functionRoot,
      leadershipOnly,
      linkedinSearchKeywords,
      jobTitle,
    };
  }

  private normalizePersonItem(
    item: Record<string, unknown>,
    source: PeopleLinkedInCandidateSource,
  ): Record<string, unknown> {
    return {
      ...item,
      source,
      data_source: source,
    };
  }
}
