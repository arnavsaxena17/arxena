import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import { ContactOutPeopleSearchService } from 'src/engine/core-modules/org-chart/services/contactout-people-search.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import { PdlPersonOrgMovementService } from 'src/engine/core-modules/org-chart/services/pdl-person-org-movement.service';
import { PeopleEsService } from 'src/engine/core-modules/org-chart/services/people-es.service';

import {
  resolveApolloFilters,
} from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';
import {
  PEOPLE_DATA_SOURCE_CATEGORIES,
  type PeopleDataSourceAlias,
} from './constants/people-data-source-aliases';
import {
  TAXONOMY_FUNCTION_ROOT_CONSTANTS,
  TAXONOMY_GRADE_CATEGORY_CONSTANTS,
  TAXONOMY_GRADE_LEVEL_CONSTANTS,
  type TaxonomyConstantsResponse,
} from './constants/taxonomy-constants';
import type { ExpandJobTitlesDto } from './dto/expand-job-titles.dto';
import type { PeopleSearchByTaxonomyDto } from './dto/people-search-by-taxonomy.dto';
import type { PeopleSearchDto } from './dto/people-search.dto';
import type { TaxonomyBooleanStringsDto } from './dto/taxonomy-boolean-strings.dto';
import type { TitleFromJobSearchDto } from './dto/title-from-job-search.dto';
import type {
  DataSourcesStatusResponse,
  ExpandJobTitlesResponse,
  PeopleSearchByTaxonomyResponse,
  PeopleSearchByTitleResponse,
  PeopleSearchResponse,
  TaxonomyBooleanStringsResponse,
  TaxonomyItem,
  TaxonomyTreeResponse,
} from './people-api.types';
import { PeopleLinkedInSourcingService } from './services/people-linkedin-sourcing.service';
import { buildTaxonomyTreeFromFlatLists } from './utils/build-taxonomy-tree.util';
import { extractCandidateJobTitle } from './utils/extract-candidate-job-title.util';
import { extractTaxonomyItemValue } from './utils/extract-taxonomy-item-value.util';
import {
  classificationToResolvedFields,
  matchesTaxonomyFilter,
} from './utils/filter-people-by-taxonomy.util';

@Injectable()
export class PeopleApiService {
  private readonly logger = new Logger(PeopleApiService.name);

  constructor(
    private readonly peopleEsService: PeopleEsService,
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
    private readonly apolloIoRestService: ApolloIoRestService,
    private readonly pdlPersonOrgMovementService: PdlPersonOrgMovementService,
    private readonly contactOutPeopleSearchService: ContactOutPeopleSearchService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly peopleLinkedInSourcingService: PeopleLinkedInSourcingService,
  ) {}

  getDataSourcesStatus(): DataSourcesStatusResponse {
    const configuredByAlias: Record<PeopleDataSourceAlias, boolean> = {
      index: this.peopleEsService.isEnabled(),
      apollo: this.apolloIoRestService.isConfigured(),
      pdl: this.pdlPersonOrgMovementService.isConfigured(),
      contactout: this.contactOutPeopleSearchService.isConfigured(),
      harvest: this.harvestLinkedinService.isConfigured(),
      unipile: this.peopleLinkedInSourcingService.isUnipileConfigured(),
      pool: this.peopleLinkedInSourcingService.isUnipileConfigured(),
    };

    return {
      status: 'ok',
      sources: PEOPLE_DATA_SOURCE_CATEGORIES.map((category) => ({
        alias: category.alias,
        label: category.label,
        description: category.description,
        supportsStdFunctionFilter: category.supportsStdFunctionFilter,
        supportsStdGradeFilter: category.supportsStdGradeFilter,
        configured: configuredByAlias[category.alias],
      })),
    };
  }

  getTaxonomyConstants(): TaxonomyConstantsResponse {
    return {
      status: 'ok',
      gradeLevels: TAXONOMY_GRADE_LEVEL_CONSTANTS,
      gradeCategories: TAXONOMY_GRADE_CATEGORY_CONSTANTS,
      functionRoots: TAXONOMY_FUNCTION_ROOT_CONSTANTS,
    };
  }

  async getTaxonomyTree(): Promise<TaxonomyTreeResponse> {
    const [rootsResult, functionsResult] = await Promise.all([
      this.titleTaxonomyRemoteService.getFunctionRoots(),
      this.titleTaxonomyRemoteService.getFunctions(),
    ]);

    const roots = Array.isArray(rootsResult) ? rootsResult : [];
    const functions = Array.isArray(functionsResult) ? functionsResult : [];

    return {
      status: 'ok',
      gradeLevels: TAXONOMY_GRADE_LEVEL_CONSTANTS,
      functionRoots: buildTaxonomyTreeFromFlatLists(roots, functions),
    };
  }

  async getFunctionRoots(title?: string): Promise<{
    status: 'ok';
    items?: TaxonomyItem[];
    item?: TaxonomyItem | null;
  }> {
    const result = await this.titleTaxonomyRemoteService.getFunctionRoots(title);
    if (Array.isArray(result)) {
      return { status: 'ok', items: result };
    }
    return { status: 'ok', item: result };
  }

  async getFunctions(
    functionRoot?: string,
    title?: string,
  ): Promise<{
    status: 'ok';
    items?: TaxonomyItem[];
    item?: TaxonomyItem | null;
  }> {
    const result = await this.titleTaxonomyRemoteService.getFunctions(
      functionRoot,
      title,
    );
    if (Array.isArray(result)) {
      return { status: 'ok', items: result };
    }
    return { status: 'ok', item: result };
  }

  async getGrades(
    gradeLevel?: string,
    title?: string,
  ): Promise<{
    status: 'ok';
    items?: TaxonomyItem[];
    item?: TaxonomyItem | null;
  }> {
    const result = await this.titleTaxonomyRemoteService.getGrades(
      gradeLevel,
      title,
    );
    if (Array.isArray(result)) {
      return { status: 'ok', items: result };
    }
    return { status: 'ok', item: result };
  }

  async searchPeopleByJobTitle(
    body: TitleFromJobSearchDto,
    apiToken?: string,
  ): Promise<PeopleSearchByTitleResponse> {
    const jobTitle = body.jobTitle?.trim();
    if (!jobTitle) {
      throw new HttpException('jobTitle is required', HttpStatus.BAD_REQUEST);
    }

    const hasCompanyScope =
      !!body.companyId?.trim() ||
      !!body.companyName?.trim() ||
      !!body.website?.trim();

    if (!hasCompanyScope) {
      throw new HttpException(
        'At least one of companyId, companyName, or website is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const classification =
      await this.titleTaxonomyRemoteService.classifyTitle(jobTitle);

    if (!classification) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const stdFunction = extractTaxonomyItemValue(classification.function);
    const stdFunctionRoot = extractTaxonomyItemValue(
      classification.function_root,
    );
    const stdGrade = extractTaxonomyItemValue(classification.grade);

    if (!stdFunction && !stdGrade) {
      throw new HttpException(
        `Could not resolve std_function or std_grade from job title: "${jobTitle}"`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    this.logger.log(
      `Title resolve jobTitle="${jobTitle}" stdFunction=${stdFunction ?? ''} stdGrade=${stdGrade ?? ''} stdFunctionRoot=${stdFunctionRoot ?? ''}`,
    );

    const searchResult = await this.searchPeople(
      {
        dataSource: body.dataSource,
        candidateSource: body.candidateSource,
        accountId: body.accountId,
        linkedInAccountId: body.linkedInAccountId,
        companyId: body.companyId,
        companyName: body.companyName,
        website: body.website,
        country: body.country,
        stdFunction: stdFunction ?? undefined,
        stdFunctionRoot: stdFunctionRoot ?? undefined,
        stdGrade: stdGrade ?? undefined,
        jobTitle,
        limit: body.limit,
        offset: body.offset,
      },
      apiToken,
    );

    return {
      ...searchResult,
      resolved: {
        jobTitle,
        normalizedTitle: classification.normalized_title?.trim() || null,
        stdFunction,
        stdFunctionRoot,
        stdGrade,
        confidence: classification.confidence ?? 0,
      },
    };
  }

  async searchPeople(
    body: PeopleSearchDto,
    apiToken?: string,
  ): Promise<PeopleSearchResponse> {
    const dataSource = body.dataSource ?? 'index';

    this.logger.log(
      `People API search dataSource=${dataSource} stdFunction=${body.stdFunction ?? ''} stdGrade=${body.stdGrade ?? ''}`,
    );

    if (dataSource === 'index') {
      return this.searchPeopleFromIndex(body, dataSource);
    }

    if (dataSource === 'apollo') {
      return this.searchPeopleFromApollo(body, dataSource);
    }

    if (dataSource === 'contactout') {
      return this.searchPeopleFromContactOut(body, dataSource);
    }

    if (dataSource === 'pdl') {
      throw new HttpException(
        `People search via data source "pdl" is not yet exposed on this endpoint.`,
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    if (
      dataSource === 'harvest' ||
      dataSource === 'unipile' ||
      dataSource === 'pool'
    ) {
      return this.searchPeopleFromLinkedIn(body, dataSource, apiToken);
    }

    throw new HttpException(
      `Unknown data source "${dataSource}"`,
      HttpStatus.BAD_REQUEST,
    );
  }

  async searchPeopleByTaxonomy(
    body: PeopleSearchByTaxonomyDto,
    apiToken: string,
  ): Promise<PeopleSearchByTaxonomyResponse> {
    const stdFunction = body.stdFunction?.trim() || undefined;
    const stdFunctionRoot = body.stdFunctionRoot?.trim() || undefined;
    const stdGrade = body.stdGrade?.trim() || undefined;

    this.assertTaxonomySearchInput({
      stdFunction,
      stdFunctionRoot,
      stdGrade,
      website: body.website,
      companyId: body.companyId,
      companyName: body.companyName,
    });

    const dataSource =
      body.candidateSource ??
      (body as { dataSource?: PeopleDataSourceAlias }).dataSource ??
      'unipile';
    const searchResult = await this.searchPeople(
      {
        dataSource:
          dataSource === 'harvest' ||
          dataSource === 'unipile' ||
          dataSource === 'pool'
            ? dataSource
            : 'unipile',
        candidateSource: body.candidateSource,
        accountId: body.accountId,
        linkedInAccountId: body.linkedInAccountId,
        website: body.website,
        companyId: body.companyId,
        companyName: body.companyName,
        stdFunction,
        stdFunctionRoot,
        stdGrade,
        country: body.country,
        limit: body.limit,
      },
      apiToken,
    );

    if (
      searchResult.dataSource !== 'harvest' &&
      searchResult.dataSource !== 'unipile' &&
      searchResult.dataSource !== 'pool'
    ) {
      throw new HttpException(
        `Unexpected data source "${searchResult.dataSource}" for taxonomy search`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      status: 'ok',
      dataSource: searchResult.dataSource,
      query: {
        keywords: searchResult.query?.keywords ?? null,
        company: searchResult.query?.company ?? {
          name: null,
          slug: null,
          linkedinUrl: null,
        },
        ...(stdFunction ? { stdFunction } : {}),
        ...(stdFunctionRoot ? { stdFunctionRoot } : {}),
        ...(stdGrade ? { stdGrade } : {}),
        ...(searchResult.query?.appliedFilters
          ? { appliedFilters: searchResult.query.appliedFilters }
          : {}),
      },
      total: searchResult.total,
      totalBeforeFilter:
        searchResult.totalBeforeFilter ?? searchResult.total,
      items: searchResult.items as PeopleSearchByTaxonomyResponse['items'],
    };
  }

  private async searchPeopleFromIndex(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
  ): Promise<PeopleSearchResponse> {
    if (!this.peopleEsService.isEnabled()) {
      throw new HttpException(
        'People index is not configured (set ES_ENDPOINT)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const hasFilter =
      !!body.query?.trim() ||
      !!body.personName?.trim() ||
      !!body.jobTitle?.trim() ||
      !!body.companyId?.trim() ||
      !!body.companyName?.trim() ||
      !!body.website?.trim() ||
      !!body.stdFunction?.trim() ||
      !!body.stdGrade?.trim() ||
      !!body.country?.trim() ||
      !!body.linkedinUrl?.trim();

    if (!hasFilter) {
      throw new HttpException(
        'At least one search filter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.peopleEsService.searchPeople({
      query: body.query,
      personName: body.personName,
      jobTitle: body.jobTitle,
      companyId: body.companyId,
      companyName: body.companyName,
      website: body.website,
      stdFunction: body.stdFunction,
      stdGrade: body.stdGrade,
      country: body.country,
      linkedinUrl: body.linkedinUrl,
      limit: body.limit,
      offset: body.offset,
    });

    return {
      status: 'ok',
      dataSource,
      total: result.total,
      items: result.items,
    };
  }

  private async searchPeopleFromApollo(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
  ): Promise<PeopleSearchResponse> {
    if (!this.apolloIoRestService.isConfigured()) {
      throw new HttpException(
        'Apollo data source is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const domain = body.website?.trim();
    const companyName = body.companyName?.trim();
    if (!domain && !companyName) {
      throw new HttpException(
        'companyName or website is required for apollo data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const stdFunction = body.stdFunction?.trim() || undefined;
    const stdFunctionRoot = body.stdFunctionRoot?.trim() || undefined;
    const stdGrade = body.stdGrade?.trim() || undefined;

    const apolloFilters = resolveApolloFilters({
      functionRoot: stdFunctionRoot,
      stdFunction,
      stdGrade,
    });

    const titleParts = [stdFunction, stdGrade, body.jobTitle]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    const raw = await this.apolloIoRestService.peopleSearch({
      q_keywords: body.query,
      person_titles:
        apolloFilters.person_department_or_subdepartments.length === 0 &&
        titleParts.length > 0
          ? titleParts
          : undefined,
      person_locations: body.country?.trim()
        ? [body.country.trim()]
        : undefined,
      q_organization_domains_list: domain ? [domain] : undefined,
      person_seniorities:
        apolloFilters.person_seniorities.length > 0
          ? apolloFilters.person_seniorities
          : undefined,
      person_department_or_subdepartments:
        apolloFilters.person_department_or_subdepartments.length > 0
          ? apolloFilters.person_department_or_subdepartments
          : undefined,
      per_page: body.limit ?? 20,
      page:
        body.offset && body.limit
          ? Math.floor(body.offset / body.limit) + 1
          : 1,
    });

    const people = Array.isArray((raw as { people?: unknown }).people)
      ? ((raw as { people: Record<string, unknown>[] }).people ?? [])
      : [];

    const queryMeta = {
      keywords: body.query?.trim() || null,
      company: {
        name: companyName || null,
        slug: null,
        linkedinUrl: null,
      },
      ...(stdFunction ? { stdFunction } : {}),
      ...(stdFunctionRoot ? { stdFunctionRoot } : {}),
      ...(stdGrade ? { stdGrade } : {}),
      appliedFilters: {
        person_department_or_subdepartments:
          apolloFilters.person_department_or_subdepartments,
        person_seniorities: apolloFilters.person_seniorities,
      },
    };

    if (stdFunction || stdFunctionRoot) {
      const filtered = await this.filterCandidatesByTaxonomy(people, {
        stdFunction,
        stdFunctionRoot,
        stdGrade,
      });

      return {
        status: 'ok',
        dataSource,
        total: filtered.length,
        totalBeforeFilter: people.length,
        query: queryMeta,
        items: filtered,
      };
    }

    return {
      status: 'ok',
      dataSource,
      total: people.length,
      totalBeforeFilter: people.length,
      query: queryMeta,
      items: people,
    };
  }

  private async searchPeopleFromLinkedIn(
    body: PeopleSearchDto,
    dataSource: 'harvest' | 'unipile' | 'pool',
    apiToken?: string,
  ): Promise<PeopleSearchResponse> {
    if (!apiToken?.trim()) {
      throw new HttpException(
        'Authorization token is required for LinkedIn people search',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hasTaxonomy =
      !!body.stdFunction?.trim() ||
      !!body.stdFunctionRoot?.trim() ||
      !!body.stdGrade?.trim();
    const hasCompany =
      !!body.website?.trim() ||
      !!body.companyId?.trim() ||
      !!body.companyName?.trim();

    if (!hasCompany) {
      throw new HttpException(
        'companyName, companyId, or website is required for LinkedIn search',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !hasTaxonomy &&
      !body.jobTitle?.trim() &&
      !body.query?.trim()
    ) {
      throw new HttpException(
        'At least one of stdFunction, stdFunctionRoot, stdGrade, jobTitle, or query is required for LinkedIn search',
        HttpStatus.BAD_REQUEST,
      );
    }

    const stdFunction = body.stdFunction?.trim() || undefined;
    const stdFunctionRoot = body.stdFunctionRoot?.trim() || undefined;
    const stdGrade = body.stdGrade?.trim() || undefined;

    const sourcingResult = await this.peopleLinkedInSourcingService.search({
      apiToken,
      website: body.website,
      companyId: body.companyId,
      companyName: body.companyName,
      stdFunction,
      stdFunctionRoot,
      stdGrade,
      country: body.country,
      candidateSource: body.candidateSource ?? dataSource,
      accountId: body.accountId,
      linkedInAccountId: body.linkedInAccountId,
      limit: body.limit ?? 20,
      linkedinSearchKeywords:
        body.jobTitle?.trim() || body.query?.trim() || undefined,
    });

    const queryMeta = {
      keywords: sourcingResult.keywords,
      company: sourcingResult.company,
      ...(stdFunction ? { stdFunction } : {}),
      ...(stdFunctionRoot ? { stdFunctionRoot } : {}),
      ...(stdGrade ? { stdGrade } : {}),
      appliedFilters: sourcingResult.appliedFilters,
    };

    const responseDataSource = sourcingResult.candidateSource;

    if (stdFunction || stdFunctionRoot) {
      const filtered = await this.filterCandidatesByTaxonomy(
        sourcingResult.items,
        {
          stdFunction,
          stdFunctionRoot,
          stdGrade,
        },
      );

      return {
        status: 'ok',
        dataSource: responseDataSource,
        total: filtered.length,
        totalBeforeFilter: sourcingResult.items.length,
        query: queryMeta,
        items: filtered,
      };
    }

    return {
      status: 'ok',
      dataSource: responseDataSource,
      total: sourcingResult.items.length,
      totalBeforeFilter: sourcingResult.items.length,
      query: queryMeta,
      items: sourcingResult.items,
    };
  }

  private assertTaxonomySearchInput(args: {
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
    website?: string;
    companyId?: string;
    companyName?: string;
  }): void {
    const hasCompany =
      !!args.website?.trim() ||
      !!args.companyId?.trim() ||
      !!args.companyName?.trim();
    if (!hasCompany) {
      throw new HttpException(
        'At least one of website, companyId, or companyName is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hasFunction = !!args.stdFunction?.trim();
    const hasRoot = !!args.stdFunctionRoot?.trim();
    if (hasFunction === hasRoot) {
      throw new HttpException(
        'Provide exactly one of stdFunction or stdFunctionRoot',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (args.stdGrade?.trim() && !hasFunction && !hasRoot) {
      throw new HttpException(
        'stdGrade requires stdFunction or stdFunctionRoot',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async filterCandidatesByTaxonomy(
    items: Array<Record<string, unknown>>,
    criteria: {
      stdFunction?: string;
      stdFunctionRoot?: string;
      stdGrade?: string;
    },
  ): Promise<
    Array<
      Record<string, unknown> & {
        resolved: {
          stdFunction: string | null;
          stdFunctionRoot: string | null;
          stdGrade: string | null;
          confidence: number;
        };
      }
    >
  > {
    const titles = items.map(
      (item) => extractCandidateJobTitle(item) ?? '',
    );
    const classifications =
      await this.titleTaxonomyRemoteService.classifyTitles(titles);

    if (!classifications) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return items.reduce<
      Array<
        Record<string, unknown> & {
          resolved: {
            stdFunction: string | null;
            stdFunctionRoot: string | null;
            stdGrade: string | null;
            confidence: number;
          };
        }
      >
    >((accumulator, item, index) => {
      const resolved = classificationToResolvedFields(classifications[index]);
      if (!matchesTaxonomyFilter(resolved, criteria)) {
        return accumulator;
      }
      accumulator.push({
        ...item,
        resolved,
      });
      return accumulator;
    }, []);
  }

  async expandJobTitles(
    dto: ExpandJobTitlesDto,
  ): Promise<ExpandJobTitlesResponse> {
    const jobTitle = dto.jobTitle?.trim();
    if (!jobTitle) {
      throw new HttpException('jobTitle is required', HttpStatus.BAD_REQUEST);
    }

    const classification =
      await this.titleTaxonomyRemoteService.classifyTitle(jobTitle);

    if (!classification) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const stdFunction = extractTaxonomyItemValue(classification.function);
    const stdFunctionRoot = extractTaxonomyItemValue(
      classification.function_root,
    );
    const stdGrade = extractTaxonomyItemValue(classification.grade);

    // Build a structured query from the classified taxonomy fields for keyword generation.
    const queryParts = [stdFunction, stdGrade, stdFunctionRoot, jobTitle]
      .filter((value): value is string => !!value)
      .slice(0, 2);

    const keywordsResult =
      queryParts.length > 0
        ? await this.titleTaxonomyRemoteService.searchKeywordsFromQuery({
            query: queryParts.join(' '),
            companyName: dto.companyName,
            resolvedIntent: {
              std_function: stdFunction,
              std_function_root: stdFunctionRoot,
              std_grade: stdGrade,
            },
          })
        : null;

    return {
      status: 'ok',
      jobTitle,
      normalizedTitle: classification.normalized_title?.trim() || null,
      stdFunction,
      stdFunctionRoot,
      stdGrade,
      confidence: classification.confidence ?? 0,
      booleanQuery: keywordsResult?.boolean_query ?? null,
      keywordGroups: keywordsResult?.keyword_groups ?? [],
    };
  }

  async getTaxonomyBooleanStrings(
    dto: TaxonomyBooleanStringsDto,
  ): Promise<TaxonomyBooleanStringsResponse> {
    const hasInput =
      !!dto.stdFunction?.trim() ||
      !!dto.stdGrade?.trim() ||
      !!dto.stdFunctionRoot?.trim();

    if (!hasInput) {
      throw new HttpException(
        'At least one of stdFunction, stdGrade, or stdFunctionRoot is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Compose a natural-language query from the taxonomy values for the keyword service.
    const queryParts = [dto.stdFunction, dto.stdGrade, dto.stdFunctionRoot]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);
    const query = queryParts.join(' ');

    const result = await this.titleTaxonomyRemoteService.searchKeywordsFromQuery(
      {
        query,
        companyName: dto.companyName,
        resolvedIntent: {
          std_function: dto.stdFunction?.trim() ?? null,
          std_function_root: dto.stdFunctionRoot?.trim() ?? null,
          std_grade: dto.stdGrade?.trim() ?? null,
        },
      },
    );

    if (!result) {
      throw new HttpException(
        'Title taxonomy service is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ok',
      query,
      booleanQuery: result.boolean_query ?? null,
      keywordGroups: result.keyword_groups ?? [],
    };
  }

  private async searchPeopleFromContactOut(
    body: PeopleSearchDto,
    dataSource: PeopleDataSourceAlias,
  ): Promise<PeopleSearchResponse> {
    if (!this.contactOutPeopleSearchService.isConfigured()) {
      throw new HttpException(
        'ContactOut data source is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const companyName = body.companyName?.trim();
    const domain = body.website?.trim();
    if (!companyName && !domain) {
      throw new HttpException(
        'companyName or website is required for contactout data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.contactOutPeopleSearchService.searchCompanyPeople({
      companyName,
      domain,
      maxScanProfiles: body.limit ?? 20,
    });

    const items = result.profiles.map(({ linkedinUrl, profile }) => ({
      linkedin_url: linkedinUrl,
      full_name: profile.full_name,
      job_title: profile.title ?? profile.headline,
      location_country: profile.country ?? profile.location,
      data_source: dataSource,
    }));

    return {
      status: 'ok',
      dataSource,
      total: result.totalResults,
      items,
    };
  }
}
